// Boot and the one loop: Solmar Heat. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over. Save/load lives here too, and so does the
// stepWorld() core the screenshot scenes drive with their autopilot.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|chase|mission|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__solmar exposes the live state for tests.
import { PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, exitCarSpot, hurtPlayer, updatePlayerOnFoot } from './player.js';
import { driveCar, nearestCar, spawnParkedCars, updateTrafficCar } from './vehicles.js';
import { maintainPopulation, scarePeds, spawnInitialPeds, updatePeds } from './traffic.js';
import { addWanted, updatePolice, updateWantedDecay } from './police.js';
import { createMissionState, missionStartPoint, missionTarget, startMission, updateMissions } from './missions.js';
import { createCombatState, fireBullet, playerPunch, spawnEnemy, spawnPickup, updateCombat } from './combat.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const audio = createAudio();
const city = createCity(rng);
const player = createPlayer(city);
let cars = spawnParkedCars(city, rng, 26);
const peds = spawnInitialPeds(city, rng, 22);
const combat = createCombatState();
const mission = createMissionState();
const renderer = createRenderer(canvas);
let screen = SCREEN_TITLE;

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

const saveRecord = loadSave() || { cash: PLAYER.startCash, ammo: PLAYER.startAmmo, missionsDone: 0, bestCash: 0, carsStolen: 0, kills: 0 };

const state = {
  time: 0,
  rng,
  city,
  player,
  cars,
  peds,
  combat,
  mission,
  wanted: 0,
  lastCrimeAt: -999,
  crimeCooldown: 0,
  decayTimer: 6,
  spawnTimer: 0,
  popTimer: 0,
  stats: { kills: 0, carsStolen: 0, missionsDone: saveRecord.missionsDone || 0 },
  storyDone: false,
  busted: false,
  particles: [],
  messages: [],
  audio,
  save: null, // set below
  hurtPlayer: (p, d) => hurtPlayer(p, d),
  spawnEnemy: (x, y) => spawnEnemy(combat, x, y),
  missionTarget: () => missionTarget(state),
  stepWorld: null, // set below
  message(text, life) {
    state.messages.push({ text, at: state.time, life: life || 4 });
    if (state.messages.length > 5) state.messages.shift();
  },
  sparks(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color: ['#ffd23f', '#ff8c42', '#ffffff'][i % 3],
      });
    }
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  },
};

// Apply the save: cash, ammo and the mission chain continue where they left off.
state.cameraForHud = renderer.camera;
player.cash = typeof saveRecord.cash === 'number' ? saveRecord.cash : PLAYER.startCash;
player.ammo = typeof saveRecord.ammo === 'number' ? saveRecord.ammo : PLAYER.startAmmo;
mission.index = Math.min(4, typeof saveRecord.missionIndex === 'number' ? saveRecord.missionIndex : 0);
mission.done = Array.isArray(saveRecord.done) ? saveRecord.done : [];
if (typeof saveRecord.bestCash === 'number') state.stats.bestCash = saveRecord.bestCash;

function saveGame() {
  const record = {
    cash: player.cash,
    ammo: player.ammo,
    missionsDone: state.stats.missionsDone,
    missionIndex: mission.index,
    done: mission.done,
    bestCash: Math.max(saveRecord.bestCash || 0, player.cash),
    carsStolen: (saveRecord.carsStolen || 0) + state.stats.carsStolen,
    kills: (saveRecord.kills || 0) + state.stats.kills,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(record));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
  saveRecord.cash = record.cash;
  saveRecord.bestCash = record.bestCash;
}
state.save = saveGame;

// A few pickups scattered around the city so the player always has something to grab.
for (let i = 0; i < 6; i += 1) {
  const rx = city.roadsV[Math.floor(rng() * city.roadsV.length)];
  const ry = city.roadsH[Math.floor(rng() * city.roadsH.length)];
  spawnPickup(combat, rx + (rng() < 0.5 ? -60 : 60), ry + (rng() < 0.5 ? -60 : 60), i % 2 === 0 ? 'ammo' : 'health');
}

/** Enter the nearest car, or steal it (with a wanted star) when it has a driver. */
function enterCar() {
  const car = nearestCar(cars, player.x, player.y, 64);
  if (!car) return;
  if (car.kind === 'traffic' && car.driver) {
    car.driver = false;
    const flee = { x: car.x + 30, y: car.y + 30, angle: 0, color: '#f2e394', panic: 4, speed: 60, walkPhase: 0 };
    peds.push(flee);
    scarePeds(peds, car.x, car.y, 200);
    addWanted(state, 1, 'WANTED — car stolen!');
  } else if (car.kind === 'police') {
    addWanted(state, 2, 'WANTED — you stole a cop car!');
  }
  car.kind = 'player';
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  state.stats.carsStolen += 1;
  audio.pickup();
}

/** Step out of the car to the side of it. */
function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const spot = exitCarSpot(car);
  player.x = spot.x;
  player.y = spot.y;
  player.angle = car.angle;
  car.kind = 'parked';
  car.speed = 0;
  player.inCar = null;
}

/** The one world step every system runs through, live or in a screenshot scene. */
function stepWorld(dt, drive, move, mouse) {
  state.time += dt;
  const p = player;
  if (p.inCar) {
    driveCar(p.inCar, city, cars, drive.throttle, drive.steer, dt);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    if (p.inCar.hp <= 0) {
      state.sparks(p.inCar.x, p.inCar.y, 24);
      audio.crash();
      p.inCar.removed = true;
      const spot = exitCarSpot(p.inCar);
      p.x = spot.x;
      p.y = spot.y;
      p.inCar = null;
      hurtPlayer(p, 20);
      state.message('Your car blew up!', 3);
    }
    // Running over a pedestrian is a crime — and it scares everyone nearby.
    if (Math.abs(p.inCar.speed) > 150) {
      for (const ped of peds) {
        if (Math.hypot(ped.x - p.x, ped.y - p.y) < 26) {
          ped.panic = 4;
          ped.x += (ped.x - p.x) * 0.4;
          ped.y += (ped.y - p.y) * 0.4;
          state.sparks(ped.x, ped.y, 6);
          if (state.crimeCooldown <= 0) addWanted(state, 1, 'WANTED — you hit a pedestrian!');
        }
      }
    }
  } else {
    updatePlayerOnFoot(p, city, move, Boolean(move.run), dt);
  }
  // Shooting: mouse aim, click to fire, only on foot.
  if (mouse && mouse.down && !p.inCar && p.shootTimer <= 0 && p.ammo > 0) {
    const scale = renderer.view.scale;
    const lx = (mouse.x - renderer.view.x) / scale;
    const ly = (mouse.y - renderer.view.y) / scale;
    const wx = lx + renderer.camera.x;
    const wy = ly + renderer.camera.y;
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
    p.angle = p.aimAngle;
    p.shootTimer = PLAYER.shootCooldown;
    p.ammo -= 1;
    fireBullet(combat, p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle, true);
    audio.shot();
    if (state.crimeCooldown <= 0) addWanted(state, 1, 'WANTED — shots fired!');
    scarePeds(peds, p.x, p.y, 320);
  }
  for (const car of state.cars) {
    if (car.removed) continue;
    if (car.kind === 'traffic') updateTrafficCar(car, city, state.cars, rng, dt);
    else if (car.kind === 'parked' && car.hp <= 0) {
      car.removed = true;
      state.sparks(car.x, car.y, 20);
    }
  }
  state.cars = state.cars.filter((car) => !car.removed);
  cars = state.cars;
  updatePeds(peds, city, { x: p.x, y: p.y }, dt);
  maintainPopulation(state, rng, dt);
  cars = state.cars;
  updatePolice(state, rng, dt);
  updateWantedDecay(state, dt);
  updateMissions(state, dt);
  updateCombat(state, dt);
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  state.messages = state.messages.filter((msg) => state.time - msg.at < msg.life);
  if (state.spawnTimer > 0) state.spawnTimer -= dt;
  audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 540 : 0, Boolean(p.inCar));
  audio.siren(state.wanted, state.time);
}
state.stepWorld = stepWorld;

/** The small contextual prompt line above the minimap. */
function hintFor() {
  const p = player;
  if (!p.inCar) {
    const nearCar = nearestCar(cars, p.x, p.y, 64);
    if (nearCar) return 'Press E to steal the car';
    if (!mission.started && mission.index < 5) {
      const g = missionStartPoint(state);
      if (Math.hypot(p.x - g.x, p.y - g.y) < 90) return 'Press ENTER to start: ' + ['First Wheels', 'Hot Delivery', 'Shake the Tail', 'The Pickup', 'Bay Heist'][mission.index];
    }
    if (mission.started && mission.index === 4 && mission.stage === 1) return 'Stay in the vault — grabbing the cash…';
    return 'WASD walk · E steal a car · Click shoot · F punch';
  }
  return 'WASD drive · E exit the car';
}

function resetRun() {
  player.x = city.spawn.x;
  player.y = city.spawn.y;
  player.angle = -Math.PI / 2;
  player.health = PLAYER.health;
  player.ammo = Math.max(player.ammo, 12);
  if (player.inCar) {
    player.inCar.kind = 'parked';
    player.inCar = null;
  }
  state.wanted = 0;
  state.busted = false;
  mission.started = false;
  mission.failed = false;
  mission.target = null;
  mission.contact = null;
  mission.objective = '';
  mission.timer = 0;
  mission.rivals = [];
  combat.bullets = [];
  combat.enemies = [];
  state.messages = [];
}

function runShot(name) {
  const scene = stageShot(name, state);
  renderer.snapCamera(state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, hintFor(), saveRecord, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let overReason = null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetRun();
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Steal a car and head to the garage.');
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    overReason = reason;
    saveGame();
    announce(reason === 'busted' ? 'Busted. Game over.' : 'Wasted. Game over.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      state.message(audio.isMuted() ? 'Sound off' : 'Sound on', 1.5);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_CONFIRM) {
      // Start the next mission at the garage.
      if (!mission.started && mission.index < 5) {
        const g = missionStartPoint(state);
        if (Math.hypot(player.x - g.x, player.y - g.y) < 90) startMission(state);
      }
    }
    if (actions & ACTION_ENTER) {
      if (player.inCar) exitCar();
      else enterCar();
    }
    if (actions & ACTION_PUNCH) playerPunch(state);
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const drive = input.drive();
    const move = input.move();
    move.run = input.running();
    stepWorld(STEP, drive, move, input.mouse());
    if (player.health <= 0) endGame('wasted');
    else if (state.busted) endGame('busted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The title screen sits over a living city: traffic and peds keep moving.
      while (accumulator >= STEP) {
        state.time += STEP;
        for (const car of cars) if (car.kind === 'traffic') updateTrafficCar(car, city, cars, rng, STEP);
        updatePeds(peds, city, { x: player.x, y: player.y }, STEP);
        accumulator -= STEP;
      }
      renderer.updateCamera(state);
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
      renderer.updateCamera(state);
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, hintFor(), saveRecord, overReason);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

// Test hook: the live state and screen, for the headless autopilot checks.
window.__solmar = { state, get screen() { return screen; } };

if (shot) runShot(shot);
else runGame();

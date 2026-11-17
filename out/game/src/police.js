// The wanted system and the Solmar Bay Police Department. Crimes raise the star level;
// police cars spawn on the roads around the player, chase and ram, and give up only when
// the player stays hidden and quiet. On foot, a cop who stays on top of you busts you.
import { POLICE, WANTED } from './config.js';
import { nearestRoadPoint } from './city.js';
import { range } from './random.js';
import { driveCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

/** Raise the wanted level (capped at 5) and remember the crime for the decay timer. */
export function addWanted(state, stars, reason) {
  if (state.wanted >= WANTED.max) return;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.lastCrimeAt = state.time;
  state.crimeCooldown = WANTED.crimeCooldown;
  if (reason) state.message(reason, 2.6);
}

/** Lower the wanted level, never below zero. */
export function lowerWanted(state, stars) {
  state.wanted = Math.max(0, state.wanted - stars);
  if (state.wanted === 0) state.message('You lost the cops.', 2.5);
}

/** Decay: after a quiet spell with no cop nearby, one star fades at a time. */
export function updateWantedDecay(state, dt) {
  if (state.wanted === 0) return;
  if (state.crimeCooldown > 0) {
    state.crimeCooldown -= dt;
    return;
  }
  const quietFor = state.time - state.lastCrimeAt;
  if (quietFor < WANTED.decayDelay) return;
  const copNear = state.cars.some((car) => car.kind === 'police' && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 500);
  if (copNear) return;
  state.decayTimer -= dt;
  if (state.decayTimer <= 0) {
    state.decayTimer = WANTED.decayInterval;
    lowerWanted(state, 1);
  }
}

/** How many police cars the current wanted level calls for. */
export function wantedPoliceCount(wanted) {
  return wanted === 0 ? 0 : Math.min(5, wanted);
}

/** Spawn a police car on a road some distance from the player. */
export function spawnPoliceCar(state, random) {
  const px = state.player.x;
  const py = state.player.y;
  const angle = random() * Math.PI * 2;
  const dist = range(random, 650, 950);
  const point = nearestRoadPoint(state.city, px + Math.cos(angle) * dist, py + Math.sin(angle) * dist);
  const car = {
    id: 9000 + Math.floor(random() * 900),
    x: point.x, y: point.y,
    angle: Math.atan2(py - point.y, px - point.x),
    speed: 260,
    color: '#2b6cb0',
    model: 'Interceptor',
    kind: 'police',
    hp: 120,
    driver: false,
    removed: false,
    brakeLight: false,
    sirenPhase: random() * Math.PI * 2,
    ramTimer: 0,
    bustTimer: 0,
  };
  state.cars.push(car);
  return car;
}

/** Keep the right number of police cars on the road, and drive each one at the player. */
export function updatePolice(state, random, dt) {
  const want = wantedPoliceCount(state.wanted);
  const cops = state.cars.filter((car) => car.kind === 'police' && !car.removed);
  if (cops.length < want && state.spawnTimer <= 0) {
    spawnPoliceCar(state, random);
    state.spawnTimer = 1.2;
  }
  if (state.wanted === 0) {
    // No heat: the cops cruise away and leave.
    for (const cop of cops) {
      const away = Math.atan2(cop.y - state.player.y, cop.x - state.player.x);
      let diff = away - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
      cop.speed += (300 - cop.speed) * 0.5 * dt;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (Math.hypot(cop.x - state.player.x, cop.y - state.player.y) > 1300) cop.removed = true;
    }
    return;
  }
  for (const cop of cops) {
    const px = state.player.x;
    const py = state.player.y;
    const dist = Math.hypot(px - cop.x, py - cop.y);
    // Outrun: a cop left far behind gives up and leaves, so the wanted level can decay.
    if (dist > 1400) {
      cop.removed = true;
      continue;
    }
    const wantAngle = Math.atan2(py - cop.y, px - cop.x);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Ease off the gas when close, so the ram lands instead of overshooting.
    const throttle = dist > 120 ? 1 : 0.4;
    driveCar(cop, state.city, state.cars, throttle, 0, dt);
    if (cop.ramTimer > 0) cop.ramTimer -= dt;
    if (dist < 46 && cop.ramTimer <= 0) {
      cop.ramTimer = POLICE.ramCooldown;
      if (state.player.inCar) {
        state.player.inCar.hp -= 10;
        state.player.inCar.speed *= 0.6;
        state.audio.crash();
        state.sparks(cop.x, cop.y, 10);
      } else if (hurtPlayer(state.player, POLICE.ramDamage)) {
        state.audio.crash();
        state.message('The cops are on you!', 1.6);
      }
    }
    // Busted: a cop car parked on top of a player on foot ends the run.
    if (!state.player.inCar && dist < POLICE.bustRange) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= POLICE.bustTime) state.busted = true;
    } else {
      cop.bustTimer = 0;
    }
  }
}

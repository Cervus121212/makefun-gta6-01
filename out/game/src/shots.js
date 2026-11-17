// The deterministic screenshot scenes behind ?shot=cover|chase|mission|title (with &seed=N).
// Each one sets the real game state up — a car on the road, police behind it, a mission in
// progress — then plays the real rules forward for a couple of seconds with a simple
// autopilot (drive along the road, steer toward the marker), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { nearestRoadPoint } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { addWanted, spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';
import { nearestCar } from './vehicles.js';

/** Steer the player's car along its road toward a target point. */
function driveAutopilot(state) {
  const car = state.player.inCar;
  if (!car) return { throttle: 0, steer: 0 };
  const target = state.missionTarget ? state.missionTarget() : null;
  // Waypoints keep the car on the roads: first line up with the target's road, then
  // drive along it, instead of cutting diagonally through the blocks.
  let tx = car.x + Math.cos(car.angle) * 400;
  let ty = car.y + Math.sin(car.angle) * 400;
  if (target) {
    if (Math.abs(car.x - target.x) > 120) {
      tx = target.x;
      ty = car.y;
    } else {
      tx = target.x;
      ty = target.y;
    }
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2)) };
}

/** Run the live loop for `seconds` with the autopilot driving, then freeze the frame. */
function playForward(state, seconds, drive) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = drive ? driveAutopilot(state) : { throttle: 0, steer: 0 };
    state.stepWorld(STEP, input, { x: 0, y: 0 }, false);
  }
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * cover: driving through Downtown with traffic, wanted 2, police behind, mission 2 running.
 * chase: on foot in Old Town with two police cars closing in, wanted 3.
 * mission: Hot Delivery in progress, package on board, timer running, pier ahead.
 * title: the title screen over a living city.
 */
export function stageShot(name, state) {
  const scene = name === 'chase' || name === 'mission' || name === 'title' ? name : 'cover';
  if (scene === 'title') {
    playForward(state, 6, false);
    return { screen: SCREEN_TITLE };
  }
  if (scene === 'chase') {
    const square = state.city.landmarks.oldTown;
    state.player.x = square.x;
    state.player.y = square.y + 60;
    state.player.angle = Math.PI / 2;
    state.wanted = 3;
    state.lastCrimeAt = state.time;
    const cops = [];
    for (let i = 0; i < 2; i += 1) cops.push(spawnPoliceCar(state, state.rng));
    // Bring the cops into the frame: reposition them on roads near the player so the
    // chase is visible, then let the real chase run.
    const spots = [
      { x: square.x + 380, y: square.y },
      { x: square.x - 320, y: square.y + 200 },
    ];
    cops.forEach((cop, i) => {
      const point = nearestRoadPoint(state.city, spots[i].x, spots[i].y);
      cop.x = point.x;
      cop.y = point.y;
    });
    playForward(state, 2.5, false);
    return { screen: SCREEN_PLAY };
  }
  if (scene === 'mission') {
    // Mission 2 (Hot Delivery): start it, grab the package, then drive toward the pier.
    state.mission.index = 1;
    startMission(state);
    state.player.x = state.city.landmarks.garage.x;
    state.player.y = state.city.landmarks.garage.y;
    const car = nearestCar(state.cars, state.player.x, state.player.y, 400)
      || state.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      state.player.inCar = car;
      state.player.x = car.x;
      state.player.y = car.y;
    }
    state.mission.stage = 1;
    state.mission.timer = 62;
    state.mission.target = { x: state.city.landmarks.pier.x, y: state.city.landmarks.pier.y, label: 'Marina Pier' };
    state.mission.objective = 'Deliver the package to the Marina Pier — fast!';
    state.player.x = 1020;
    state.player.y = 660;
    if (state.player.inCar) {
      state.player.inCar.x = 1020;
      state.player.inCar.y = 660;
      state.player.inCar.angle = Math.PI;
    }
    playForward(state, 1.5, true);
    return { screen: SCREEN_PLAY };
  }
  // cover: mission 2 running, player driving west on Coral Row with traffic and police.
  state.mission.index = 1;
  startMission(state);
  state.mission.stage = 1;
  state.mission.timer = 58;
  state.mission.target = { x: state.city.landmarks.pier.x, y: state.city.landmarks.pier.y, label: 'Marina Pier' };
  state.mission.objective = 'Deliver the package to the Marina Pier — fast!';
  addWanted(state, 2, '');
  const car = nearestCar(state.cars, 1740, 1380, 500) || state.cars.find((c) => c.kind === 'parked');
  if (car) {
    car.kind = 'player';
    state.player.inCar = car;
    car.x = 1740;
    car.y = 1380;
    car.angle = Math.PI;
    car.speed = 320;
  }
  state.player.x = 1740;
  state.player.y = 1380;
  for (let i = 0; i < 2; i += 1) spawnPoliceCar(state, state.rng);
  playForward(state, 2, true);
  return { screen: SCREEN_PLAY };
}

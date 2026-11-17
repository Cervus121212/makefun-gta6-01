// Pedestrians and the traffic population. Peds stroll the sidewalks, cross at intersections
// and run away from gunfire, car theft and speeding cars. Traffic cars are kept topped up
// around the player and removed when they drive far away, so the city always feels alive
// without growing without bound.
import { ROAD, WORLD } from './config.js';
import { collideBuildings, nearestRoadPoint, onRoad } from './city.js';
import { range } from './random.js';
import { spawnTrafficCar } from './vehicles.js';

const PED_COLORS = ['#f2e394', '#e8a87c', '#a8c8e8', '#d98c8c', '#c9a8d8', '#8fc7a8'];
const MAX_PEDS = 26;
const MAX_TRAFFIC = 10;

/** A pedestrian standing on a sidewalk near (x, y). */
export function spawnPed(city, random, x, y) {
  const point = nearestRoadPoint(city, x, y);
  const side = random() < 0.5 ? 1 : -1;
  const px = point.vertical ? point.x + side * (ROAD.half + 10) : point.x + range(random, -160, 160);
  const py = point.vertical ? point.y + range(random, -160, 160) : point.y + side * (ROAD.half + 10);
  return {
    x: Math.max(80, Math.min(WORLD.width - 30, px)),
    y: Math.max(30, Math.min(WORLD.height - 30, py)),
    angle: random() * Math.PI * 2,
    speed: range(random, 38, 62),
    color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
    panic: 0,
    walkPhase: random() * Math.PI * 2,
  };
}

/** Scatter pedestrians across the city at the start. */
export function spawnInitialPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    peds.push(spawnPed(city, random, range(random, 300, WORLD.width - 300), range(random, 300, WORLD.height - 300)));
  }
  return peds;
}

/** Peds walk their sidewalk; panicked ones sprint away from the scare point. */
export function updatePeds(peds, city, scare, dt) {
  for (const ped of peds) {
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - scare.y, ped.x - scare.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 190 * dt;
      ped.y += Math.sin(away) * 190 * dt;
    } else {
      ped.walkPhase += dt * 6;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // At an intersection, sometimes pick a new direction along a road.
      const nearV = city.roadsV.some((rx) => Math.abs(ped.x - rx) < ROAD.half + 12);
      const nearH = city.roadsH.some((ry) => Math.abs(ped.y - ry) < ROAD.half + 12);
      if ((nearV || nearH) && Math.random() < dt * 0.3) {
        ped.angle = Math.floor(Math.random() * 4) * Math.PI / 2;
      }
      // Wander off a sidewalk: drift back toward the nearest road.
      if (!onRoad(city, ped.x, ped.y) && Math.abs(ped.x - nearestRoadPoint(city, ped.x, ped.y).x) > 200) {
        const target = nearestRoadPoint(city, ped.x, ped.y);
        ped.angle = Math.atan2(target.y - ped.y, target.x - ped.x);
      }
    }
    const clamped = { x: Math.max(70, Math.min(WORLD.width - 20, ped.x)), y: Math.max(20, Math.min(WORLD.height - 20, ped.y)) };
    ped.x = clamped.x;
    ped.y = clamped.y;
    collideBuildings(city, { x: ped.x, y: ped.y, r: 10 });
  }
}

/** Scare every ped within range of a point (gunfire, theft, a speeding car). */
export function scarePeds(peds, x, y, rangePx) {
  for (const ped of peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < rangePx) ped.panic = 2.5;
  }
}

/** Keep traffic and peds topped up near the player; cull the ones that drove far away. */
export function maintainPopulation(state, random, dt) {
  state.popTimer -= dt;
  if (state.popTimer > 0) return;
  state.popTimer = 1.5;
  const px = state.player.x;
  const py = state.player.y;
  state.cars = state.cars.filter((car) => {
    if (car.kind === 'traffic' && Math.hypot(car.x - px, car.y - py) > 1500) return false;
    return !car.removed;
  });
  const trafficCount = state.cars.filter((car) => car.kind === 'traffic').length;
  for (let i = trafficCount; i < MAX_TRAFFIC; i += 1) {
    state.cars.push(spawnTrafficCar(state.city, random, px, py));
  }
  state.peds = state.peds.filter((ped) => Math.hypot(ped.x - px, ped.y - py) < 1400);
  while (state.peds.length < MAX_PEDS) {
    state.peds.push(spawnPed(state.city, random, px + range(random, -700, 700), py + range(random, -700, 700)));
  }
}

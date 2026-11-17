// Cars: parked cars, traffic cars and police cars share one pool. This module spawns them,
// drives the one the player sits in (arcade physics: accelerate, brake, steer, drift a
// little), and moves traffic along the roads. Collisions with buildings and other cars are
// soft: cars slow and slide rather than stop dead.
import { CAR, ROAD, WORLD } from './config.js';
import { collideBuildings, nearestRoadPoint, onRoad, randomCarModel } from './city.js';
import { range } from './random.js';

let nextCarId = 1;

export function makeCar(x, y, angle, model, kind) {
  const car = {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    color: model.color,
    model: model.name,
    kind: kind || 'parked', // parked | traffic | police | player
    hp: CAR.hp,
    driver: kind === 'traffic',
    removed: false,
    brakeLight: false,
    bumpTimer: 0,
    sirenPhase: Math.random() * Math.PI * 2,
  };
  nextCarId += 1;
  return car;
}

/** Parked cars along the roads and in the parking lots, plus a few starting traffic cars. */
export function spawnParkedCars(city, random, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 20) {
    guard += 1;
    const roadV = random() < 0.5;
    const road = roadV
      ? city.roadsV[Math.floor(random() * city.roadsV.length)]
      : city.roadsH[Math.floor(random() * city.roadsH.length)];
    const along = range(random, 220, roadV ? WORLD.height - 220 : WORLD.width - 220);
    const x = roadV ? road + (random() < 0.5 ? -ROAD.lane : ROAD.lane) : along;
    const y = roadV ? along : road + (random() < 0.5 ? -ROAD.lane : ROAD.lane);
    if (Math.hypot(x - city.spawn.x, y - city.spawn.y) < 120) continue;
    const angle = roadV ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    cars.push(makeCar(x, y, angle, randomCarModel(random), 'parked'));
  }
  return cars;
}

/** A traffic car entering a road near the player, driving along it. */
export function spawnTrafficCar(city, random, nearX, nearY) {
  const roadV = random() < 0.5;
  const road = roadV
    ? city.roadsV[Math.floor(random() * city.roadsV.length)]
    : city.roadsH[Math.floor(random() * city.roadsH.length)];
  const dir = random() < 0.5 ? 1 : -1;
  const along = (roadV ? nearY : nearX) + dir * range(random, 500, 900);
  const x = roadV ? road + dir * ROAD.lane : Math.max(160, Math.min(WORLD.width - 160, along));
  const y = roadV ? Math.max(160, Math.min(WORLD.height - 160, along)) : road + dir * ROAD.lane;
  const angle = roadV ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = makeCar(x, y, angle, randomCarModel(random), 'traffic');
  car.speed = range(random, 140, 210);
  return car;
}

/** The nearest car to a point within range, or null. */
export function nearestCar(cars, x, y, rangePx) {
  let best = null;
  let bestD = rangePx;
  for (const car of cars) {
    if (car.removed) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Drive the player's car one step: throttle, steering, drag, buildings and other cars. */
export function driveCar(car, city, cars, throttle, steer, dt) {
  const maxSpeed = car.kind === 'police' ? CAR.policeMaxSpeed : CAR.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    // S (or Down) brakes while moving forward, reverses once nearly stopped.
    if (car.speed > 10) car.speed -= CAR.brake * 0.6 * dt;
    else car.speed -= CAR.reverseAccel * dt * 0.6;
  }
  car.speed = Math.max(-170, Math.min(maxSpeed, car.speed));
  // Drag and rolling resistance pull the car back toward a stop.
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steerAmount * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(60, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  // Soft bumps against other cars: the cars push apart, and a hard hit (once per half
  // second, not once per frame) dents both. The player and police cars are heavier, so
  // traffic gets shoved aside instead of pinning them against a building.
  if (car.bumpTimer > 0) car.bumpTimer -= dt;
  for (const other of cars) {
    if (other === car || other.removed) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 42) {
      const push = Math.min(8, (42 - d) / 2);
      const heavy = car.kind === 'player' || car.kind === 'police';
      const myShare = heavy ? 0.25 : 0.75;
      car.x += (dx / d) * push * myShare * 2;
      car.y += (dy / d) * push * myShare * 2;
      other.x -= (dx / d) * push * (2 - myShare * 2);
      other.y -= (dy / d) * push * (2 - myShare * 2);
      if (Math.abs(car.speed) > 260 && car.bumpTimer <= 0) {
        other.hp -= 8;
        car.hp -= 4;
        car.speed *= 0.7;
        car.bumpTimer = 0.5;
      }
    }
  }
  // Buildings are resolved last, so a bump can never leave a car wedged inside one.
  const circle = { x: car.x, y: car.y, r: 20 };
  if (collideBuildings(city, circle)) {
    car.x = circle.x;
    car.y = circle.y;
    if (Math.abs(car.speed) > 220) car.hp -= 6;
    car.speed *= 0.45;
  }
  car.brakeLight = throttle < 0 && car.speed > 10;
  return car;
}

/** A traffic car follows its road: at an intersection it may turn; off-road it steers back. */
export function updateTrafficCar(car, city, cars, random, dt) {
  const onRoadNow = onRoad(city, car.x, car.y);
  if (!onRoadNow) {
    // Drifted off the road (a bump): steer toward the nearest road centre and slow down.
    const target = nearestRoadPoint(city, car.x, car.y);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    car.speed = Math.max(60, car.speed - 120 * dt);
  } else {
    // At an intersection, sometimes turn onto the crossing road.
    const nearV = city.roadsV.some((rx) => Math.abs(car.x - rx) < 6);
    const nearH = city.roadsH.some((ry) => Math.abs(car.y - ry) < 6);
    if (nearV && nearH && random() < dt * 0.35) {
      car.angle += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    // Brake for the car ahead instead of piling into it.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.removed) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 130 && side < 26) {
        blocked = true;
        break;
      }
    }
    if (blocked) car.speed = Math.max(0, car.speed - 700 * dt);
    else car.speed += (170 - car.speed) * 0.4 * dt;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const circle = { x: car.x, y: car.y, r: 20 };
  if (collideBuildings(city, circle)) {
    car.x = circle.x;
    car.y = circle.y;
    car.speed *= 0.5;
    car.angle += Math.PI / 2;
  }
}

// The player on foot: position, facing, health, cash, ammo and the punch. Driving lives in
// vehicles.js; this module only moves the person, and only when they are not in a car.
import { PLAYER } from './config.js';
import { clampWorld, collideBuildings } from './city.js';

export function createPlayer(city) {
  return {
    x: city.spawn.x,
    y: city.spawn.y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    cash: PLAYER.startCash,
    ammo: PLAYER.startAmmo,
    inCar: null,
    punchTimer: 0,
    shootTimer: 0,
    invuln: 0,
    moving: false,
    running: false,
    aimAngle: -Math.PI / 2,
  };
}

/** Move on foot from WASD input; returns true when the player actually moved. */
export function updatePlayerOnFoot(player, city, move, running, dt) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const vx = move.x * speed;
  const vy = move.y * speed;
  player.moving = move.x !== 0 || move.y !== 0;
  player.running = running && player.moving;
  if (player.moving) player.angle = Math.atan2(vy, vx);
  player.x += vx * dt;
  player.y += vy * dt;
  const clamped = clampWorld(player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
  collideBuildings(city, { x: player.x, y: player.y, r: PLAYER.radius });
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  return player.moving;
}

/** Hurt the player (unless briefly invulnerable); returns true when damage landed. */
export function hurtPlayer(player, damage) {
  if (player.invuln > 0 || player.health <= 0) return false;
  player.health = Math.max(0, player.health - damage);
  player.invuln = 0.6;
  return true;
}

/** Heal the player, never past full health. */
export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
}

/** Step the player out of a car to the nearest free spot beside it. */
export function exitCarSpot(car) {
  const side = Math.PI / 2;
  return {
    x: car.x + Math.cos(car.angle + side) * 34,
    y: car.y + Math.sin(car.angle + side) * 34,
  };
}

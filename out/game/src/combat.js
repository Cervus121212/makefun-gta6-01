// Combat: the pistol, the punch, rival gunmen and pickups. Bullets fly straight, hit peds,
// enemies and cars, and spark on buildings. Enemies are the Vultures' gunmen: they stand
// their ground, shoot at the player when close, and drop cash when they fall.
import { PLAYER } from './config.js';
import { collideBuildings } from './city.js';

export function createCombatState() {
  return { bullets: [], enemies: [], pickups: [] };
}

/** Fire a bullet from (x, y) along angle; friendly bullets come from the player. */
export function fireBullet(combat, x, y, angle, friendly) {
  combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    life: 0.9,
    friendly,
  });
}

/** The player's punch: a short arc in front of them that hurts peds and enemies. */
export function playerPunch(state) {
  const player = state.player;
  if (player.punchTimer > 0 || player.inCar) return;
  player.punchTimer = PLAYER.punchCooldown;
  state.audio.punch();
  const px = player.x + Math.cos(player.angle) * 26;
  const py = player.y + Math.sin(player.angle) * 26;
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - px, ped.y - py) < PLAYER.punchRange) {
      ped.panic = 3;
      state.sparks(ped.x, ped.y, 6);
    }
  }
  for (const enemy of state.combat.enemies) {
    if (Math.hypot(enemy.x - px, enemy.y - py) < PLAYER.punchRange + 6) {
      enemy.health -= PLAYER.punchDamage;
      state.sparks(enemy.x, enemy.y, 8);
    }
  }
}

/** Spawn a rival gunman at a point. */
export function spawnEnemy(combat, x, y) {
  combat.enemies.push({
    x, y,
    angle: 0,
    health: 50,
    shootTimer: 1 + Math.random(),
    walkPhase: Math.random() * 6,
  });
}

/** Spawn a pickup: 'ammo' (12 bullets), 'health' (+40) or 'cash' (+$25). */
export function spawnPickup(combat, x, y, kind) {
  combat.pickups.push({ x, y, kind, bob: Math.random() * 6 });
}

function hitBuilding(state, bullet) {
  const circle = { x: bullet.x, y: bullet.y, r: 2 };
  return collideBuildings(state.city, circle);
}

/** Move bullets, resolve hits, move enemies and let them shoot, collect pickups. */
export function updateCombat(state, dt) {
  const combat = state.combat;
  const player = state.player;
  for (const bullet of combat.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (hitBuilding(state, bullet)) {
      bullet.life = 0;
      state.sparks(bullet.x, bullet.y, 4);
      continue;
    }
    if (bullet.friendly) {
      for (const enemy of combat.enemies) {
        if (enemy.health > 0 && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 16) {
          enemy.health -= 34;
          bullet.life = 0;
          state.sparks(enemy.x, enemy.y, 8);
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const car of state.cars) {
        if (car.removed || car === player.inCar) continue;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 24) {
          car.hp -= 20;
          bullet.life = 0;
          state.sparks(bullet.x, bullet.y, 6);
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 12) {
          ped.panic = 4;
          bullet.life = 0;
          state.sparks(ped.x, ped.y, 5);
          break;
        }
      }
    } else if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < 15) {
      bullet.life = 0;
      if (player.inCar) player.inCar.hp -= 8;
      else if (state.hurtPlayer) state.hurtPlayer(player, 8);
      state.sparks(player.x, player.y, 5);
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  for (const enemy of combat.enemies) {
    if (enemy.health <= 0) continue;
    const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.shootTimer -= dt;
    if (d < 420 && enemy.shootTimer <= 0) {
      enemy.shootTimer = 1.1 + Math.random() * 0.7;
      const spread = (Math.random() - 0.5) * 0.25;
      fireBullet(combat, enemy.x, enemy.y, enemy.angle + spread, false);
      state.audio.shot();
    }
    if (d > 60 && d < 500) {
      enemy.x += Math.cos(enemy.angle) * 70 * dt;
      enemy.y += Math.sin(enemy.angle) * 70 * dt;
    }
  }
  const dead = combat.enemies.filter((e) => e.health <= 0);
  for (const enemy of dead) {
    state.sparks(enemy.x, enemy.y, 16);
    spawnPickup(combat, enemy.x, enemy.y, 'cash');
    state.stats.kills += 1;
  }
  combat.enemies = combat.enemies.filter((e) => e.health > 0);
  for (const pickup of combat.pickups) {
    pickup.bob += dt * 3;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 30) {
      pickup.taken = true;
      if (pickup.kind === 'ammo') {
        player.ammo += 12;
        state.message('Picked up ammo (+12)', 2);
      } else if (pickup.kind === 'health') {
        player.health = Math.min(100, player.health + 40);
        state.message('Picked up a medkit (+40 HP)', 2);
      } else {
        player.cash += 25;
        state.message('Picked up $25', 2);
      }
      state.audio.pickup();
    }
  }
  combat.pickups = combat.pickups.filter((p) => !p.taken);
}

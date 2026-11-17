// The renderer: a camera that follows the player, the city painted sun-soaked (sand,
// grass, asphalt with lane dashes, pastel rooftops, the marina water), the cars, peds,
// bullets and particles, and the screens — title, pause, game over and mission banners.
// It draws; it never changes the rules. The 1280x720 view is scaled to fit the window.
import { FONT, MISSIONS, PALETTE, ROAD, VIEW, WORLD } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(state) {
    const target = state.player.inCar || state.player;
    const tx = target.x - VIEW.width / 2;
    const ty = target.y - VIEW.height / 2;
    camera.x += (tx - camera.x) * 0.12;
    camera.y += (ty - camera.y) * 0.12;
    camera.x = Math.max(-40, Math.min(WORLD.width - VIEW.width + 40, camera.x));
    camera.y = Math.max(-40, Math.min(WORLD.height - VIEW.height + 40, camera.y));
  }

  /** Jump the camera straight onto the player (screenshot scenes have no frames to lerp over). */
  function snapCamera(state) {
    const target = state.player.inCar || state.player;
    camera.x = Math.max(-40, Math.min(WORLD.width - VIEW.width + 40, target.x - VIEW.width / 2));
    camera.y = Math.max(-40, Math.min(WORLD.height - VIEW.height + 40, target.y - VIEW.height / 2));
  }

  function drawCity(state) {
    const city = state.city;
    const x0 = Math.max(0, camera.x - 60);
    const y0 = Math.max(0, camera.y - 60);
    const x1 = Math.min(WORLD.width, camera.x + VIEW.width + 60);
    const y1 = Math.min(WORLD.height, camera.y + VIEW.height + 60);
    // Ground: grass everywhere, sand and water at the west edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = PALETTE.water;
    if (x0 < 60) ctx.fillRect(x0, y0, Math.min(60, x1) - x0, y1 - y0);
    ctx.fillStyle = PALETTE.sand;
    if (x1 > 60) ctx.fillRect(Math.max(60, x0), y0, Math.min(190, x1) - Math.max(60, x0), y1 - y0);
    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Sidewalks and roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsV) ctx.fillRect(rx - ROAD.half - 10, y0, ROAD.width + 20, y1 - y0);
    for (const ry of city.roadsH) ctx.fillRect(x0, ry - ROAD.half - 10, x1 - x0, ROAD.width + 20);
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of city.roadsV) ctx.fillRect(rx - ROAD.half, y0, ROAD.width, y1 - y0);
    for (const ry of city.roadsH) ctx.fillRect(x0, ry - ROAD.half, x1 - x0, ROAD.width);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of city.roadsV) {
      for (let y = Math.floor(y0 / 48) * 48; y < y1; y += 48) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of city.roadsH) {
      for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Buildings: shadow, roof, and a darker court for tall downtown towers.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
      }
    }
    // Trees.
    for (const tree of city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(tree.x + 3, tree.y + 4, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmark labels, faint, for orientation.
    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = 'rgba(29,39,51,0.55)';
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
      ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y - 52);
    }
  }

  function drawMarker(state) {
    const target = state.missionTarget ? state.missionTarget() : null;
    if (target) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.15;
      ctx.save();
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '700 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1d2733';
      ctx.fillText(target.label, target.x, target.y - 44);
      ctx.restore();
    }
    // The garage start marker when a mission is waiting.
    if (!state.mission.started && state.mission.index < MISSIONS.length) {
      const g = state.city.landmarks.garage;
      const pulse = 1 + Math.sin(state.time * 4) * 0.2;
      ctx.save();
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 30 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '700 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1d2733';
      ctx.fillText('M', g.x, g.y + 5);
      ctx.restore();
    }
  }

  function drawCars(state) {
    const allCars = state.mission.rivals.length > 0 ? state.cars.concat(state.mission.rivals) : state.cars;
    for (const car of allCars) {
      if (car.removed) continue;
      if (car.x < camera.x - 80 || car.x > camera.x + VIEW.width + 80 || car.y < camera.y - 80 || car.y > camera.y + VIEW.height + 80) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.roundRect(-22, -10, 48, 24, 7);
      ctx.fill();
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 24, 7);
      ctx.fill();
      // Windshield, roof and headlights.
      ctx.fillStyle = 'rgba(20,40,60,0.85)';
      ctx.fillRect(6, -9, 10, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(-8, -9, 12, 18);
      ctx.fillStyle = '#fff8c9';
      ctx.fillRect(22, -10, 3, 5);
      ctx.fillRect(22, 5, 3, 5);
      if (car.brakeLight) {
        ctx.fillStyle = '#ff2d2d';
        ctx.fillRect(-25, -10, 3, 5);
        ctx.fillRect(-25, 5, 3, 5);
      }
      ctx.restore();
      if (car.kind === 'police') {
        const flashing = Math.sin(state.time * 9 + car.sirenPhase) > 0;
        ctx.fillStyle = flashing ? '#ff2d2d' : '#2b6cb0';
        ctx.beginPath();
        ctx.arc(car.x - Math.cos(car.angle) * 4, car.y - Math.sin(car.angle) * 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flashing ? '#2b6cb0' : '#ff2d2d';
        ctx.beginPath();
        ctx.arc(car.x + Math.cos(car.angle) * 4, car.y + Math.sin(car.angle) * 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (car.hp < 40 && car.hp > 0) {
        ctx.fillStyle = 'rgba(60,60,60,0.5)';
        ctx.beginPath();
        ctx.arc(car.x + (Math.random() - 0.5) * 10, car.y - 8, 5 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      if (ped.x < camera.x - 40 || ped.x > camera.x + VIEW.width + 40 || ped.y < camera.y - 40 || ped.y > camera.y + VIEW.height + 40) continue;
      const bob = ped.panic > 0 ? 2 : Math.sin(ped.walkPhase) * 1.5;
      ctx.save();
      ctx.translate(ped.x, ped.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2733';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (state.mission.contact) {
      const c = state.mission.contact;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('MARA', 0, -16);
      ctx.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    if (player.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) return; // hit flash
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(player.angle);
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(10, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.fillRect(-13, -9, 5, 18);
    ctx.restore();
  }

  function drawEnemies(state) {
    for (const enemy of state.combat.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(enemy.angle);
      ctx.fillStyle = '#8b2f39';
      ctx.beginPath();
      ctx.roundRect(-11, -9, 22, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(8, -2, 12, 4);
      ctx.restore();
      ctx.fillStyle = '#33302d';
      ctx.fillRect(enemy.x - 14, enemy.y - 24, 28, 5);
      ctx.fillStyle = '#e53e3e';
      ctx.fillRect(enemy.x - 14, enemy.y - 24, 28 * Math.max(0, enemy.health / 50), 5);
    }
  }

  function drawBulletsAndPickups(state) {
    for (const bullet of state.combat.bullets) {
      ctx.fillStyle = '#fff3a0';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pickup of state.combat.pickups) {
      const bob = Math.sin(pickup.bob) * 2;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.fillStyle = pickup.kind === 'ammo' ? '#ffd23f' : pickup.kind === 'health' ? '#2ecc71' : '#7ee787';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1d2733';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'ammo' ? 'A' : pickup.kind === 'health' ? '+' : '$', 0, 4);
      ctx.restore();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(state) {
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawCity(state);
    drawMarker(state);
    drawCars(state);
    drawPeds(state);
    drawEnemies(state);
    drawPlayer(state);
    drawBulletsAndPickups(state);
    ctx.restore();
  }

  function drawTitle(state, save) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(20, 28, 40, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 84px ' + FONT;
    ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 22px ' + FONT;
    ctx.fillText('An open-world crime story in Solmar Bay', VIEW.width / 2, 232);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Steal cars. Outrun the cops. Run five jobs for Mara and the Coral Kings.', VIEW.width / 2, 268);
    ctx.fillText('WASD drive & walk  ·  E steal / exit car  ·  Mouse aim, click shoot  ·  F punch', VIEW.width / 2, 296);
    ctx.fillText('Esc pause  ·  M mute  ·  Your progress saves automatically', VIEW.width / 2, 320);
    if (save && save.missionsDone > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '700 18px ' + FONT;
      ctx.fillText(`Continue: ${save.missionsDone} of 5 jobs done · $${save.cash.toLocaleString('en-US')} in the bank`, VIEW.width / 2, 372);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px ' + FONT;
    ctx.fillText('PRESS ENTER OR CLICK TO PLAY', VIEW.width / 2, 440);
    ctx.font = '14px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('A completely original game. No Rockstar names, maps, art or music.', VIEW.width / 2, 660);
    if (save && save.bestCash > 0) {
      ctx.fillText(`Best cash: $${save.bestCash.toLocaleString('en-US')}  ·  Cars stolen: ${save.carsStolen}  ·  Jobs done: ${save.missionsDone}`, VIEW.width / 2, 686);
    }
  }

  function drawPaused(state) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(20, 28, 40, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px ' + FONT;
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = '18px ' + FONT;
    ctx.fillText('Esc resume  ·  Enter restart the run  ·  M mute', VIEW.width / 2, 350);
    ctx.fillText(`Cash $${state.player.cash.toLocaleString('en-US')}  ·  Jobs done ${state.stats.missionsDone} of 5`, VIEW.width / 2, 382);
  }

  function drawOver(state, reason) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(40, 10, 10, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '900 64px ' + FONT;
    ctx.fillText(reason === 'busted' ? 'BUSTED!' : 'WASTED!', VIEW.width / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px ' + FONT;
    ctx.fillText(reason === 'busted'
      ? 'The Solmar Bay PD caught up with you. The garage keeps your cash.'
      : 'Solmar Bay is unforgiving. The garage keeps your cash.', VIEW.width / 2, 348);
    ctx.fillText(`Jobs done: ${state.stats.missionsDone} of 5  ·  Cash: $${state.player.cash.toLocaleString('en-US')}`, VIEW.width / 2, 382);
    ctx.font = '700 22px ' + FONT;
    ctx.fillText('PRESS ENTER TO TRY AGAIN', VIEW.width / 2, 440);
  }

  return {
    camera,
    view,
    updateCamera,
    snapCamera,
    /** Paint the current screen; `hint` is the contextual prompt, `save` the save record. */
    draw(state, screen, hint, save, reason) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#f2d8a0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      if (screen === SCREEN_TITLE) {
        drawTitle(state, save);
        return;
      }
      if (screen === SCREEN_OVER) {
        drawOver(state, reason);
        return;
      }
      drawWorld(state);
      if (screen === SCREEN_PLAY) drawHud(ctx, state, hint);
      if (screen === SCREEN_PAUSED) drawPaused(state);
    },
  };
}

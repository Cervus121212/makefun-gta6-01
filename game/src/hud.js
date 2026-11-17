// The HUD: health, cash, ammo, wanted stars, the mission objective, speed, the district
// name and a live minimap — all drawn on the canvas so the screenshots show the whole game.
// The minimap paints the city small: roads, water, the player, cars, police and the marker.
import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { districtAt } from './city.js';

const MAP_W = 208;
const MAP_H = 156;

function drawStars(ctx, wanted, x, y) {
  ctx.font = '28px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.gold : 'rgba(255,255,255,0.35)';
    ctx.fillText('\u2605', x + i * 30, y);
  }
}

function drawMinimap(ctx, state) {
  const x0 = VIEW.width - MAP_W - 16;
  const y0 = VIEW.height - MAP_H - 16;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x0 - 6, y0 - 6, MAP_W + 12, MAP_H + 12);
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_W, MAP_H);
  ctx.clip();
  ctx.fillStyle = '#7cad58';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  // Water and sand at the west edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0, 190 * sx, MAP_H);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0 + 60 * sx, y0, 130 * sx, MAP_H);
  // Roads.
  ctx.strokeStyle = '#5a554f';
  ctx.lineWidth = 4;
  for (const rx of state.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + MAP_H);
    ctx.stroke();
  }
  for (const ry of state.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + MAP_W, y0 + ry * sy);
    ctx.stroke();
  }
  // Mission marker, pulsing.
  const target = state.missionTarget ? state.missionTarget() : null;
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x0 + target.x * sx, y0 + target.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars, police flashing.
  for (const car of state.cars) {
    if (car.removed) continue;
    if (car.kind === 'police') {
      ctx.fillStyle = Math.sin(state.time * 8) > 0 ? '#e53e3e' : '#2b6cb0';
    } else if (car.kind === 'rival') {
      ctx.fillStyle = '#8b2f39';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
    }
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  // Rival chase cars live outside state.cars; show them too.
  for (const car of state.mission.rivals) {
    ctx.fillStyle = '#8b2f39';
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  // The player, on top of everything.
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.font = '600 11px ' + FONT;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SOLMAR BAY', x0 + MAP_W, y0 - 10);
}

/** Draw the whole HUD over the world. `hint` is the small contextual prompt line. */
export function drawHud(ctx, state, hint) {
  const player = state.player;
  ctx.save();
  // Top-left panel: health, cash, ammo.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(14, 14, 250, 74);
  ctx.font = '700 15px ' + FONT;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HP', 26, 32);
  ctx.fillStyle = '#33302d';
  ctx.fillRect(58, 24, 150, 14);
  ctx.fillStyle = player.health > 30 ? '#2ecc71' : '#e53e3e';
  ctx.fillRect(58, 24, 150 * (player.health / 100), 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px ' + FONT;
  ctx.fillText('$' + player.cash.toLocaleString('en-US'), 26, 58);
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('AMMO ' + player.ammo + (player.inCar ? '   \u25B2 ' + player.inCar.model : ''), 130, 58);
  ctx.font = '12px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(districtAt(state.city, player.x, player.y), 26, 78);
  // Top-right: wanted stars.
  drawStars(ctx, state.wanted, VIEW.width - 170, 34);
  ctx.font = '700 13px ' + FONT;
  ctx.fillStyle = state.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(state.wanted > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 20, 62);
  // Top-centre: the mission objective.
  if (state.mission.objective) {
    ctx.font = '700 15px ' + FONT;
    ctx.textAlign = 'center';
    const text = state.mission.objective + (state.mission.timer > 0 ? '  \u23F1 ' + Math.ceil(state.mission.timer) + 's' : '');
    const w = ctx.measureText(text).width + 28;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect((VIEW.width - w) / 2, 12, w, 30);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(text, VIEW.width / 2, 28);
  }
  // Bottom-left: speed while driving, car health under it.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.36);
    ctx.font = '700 26px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(kmh + ' km/h', 22, VIEW.height - 34);
    ctx.fillStyle = '#33302d';
    ctx.fillRect(22, VIEW.height - 24, 120, 8);
    ctx.fillStyle = player.inCar.hp > 30 ? '#2ecc71' : '#e53e3e';
    ctx.fillRect(22, VIEW.height - 24, 120 * Math.max(0, player.inCar.hp / 100), 8);
  }
  // Edge arrow: when the mission target is off-screen, point toward it.
  const target = state.missionTarget ? state.missionTarget() : null;
  if (target) {
    const cam = state.cameraForHud;
    if (cam) {
      const tx = target.x - cam.x;
      const ty = target.y - cam.y;
      if (tx < 0 || tx > VIEW.width || ty < 0 || ty > VIEW.height) {
        const cx = VIEW.width / 2;
        const cy = VIEW.height / 2;
        const angle = Math.atan2(ty - cy, tx - cx);
        const ax = cx + Math.cos(angle) * 300;
        const ay = cy + Math.sin(angle) * 200;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // Contextual hint above the minimap.
  if (hint) {
    ctx.font = '600 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hint, VIEW.width / 2, VIEW.height - 186);
  }
  // Toast messages, newest last, fading.
  ctx.textAlign = 'center';
  let line = 0;
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const msg = state.messages[i];
    const age = state.time - msg.at;
    if (age > msg.life) continue;
    const alpha = Math.min(1, (msg.life - age) / 0.5);
    ctx.font = '600 15px ' + FONT;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(msg.text, VIEW.width / 2, 96 + line * 22);
    line += 1;
  }
  ctx.globalAlpha = 1;
  drawMinimap(ctx, state);
  ctx.restore();
}

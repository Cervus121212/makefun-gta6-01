// The city of Solmar Bay: a sun-soaked coastal grid of roads, blocks, buildings, parks and
// a beach, generated once from the seed. It also answers the questions the rest of the game
// asks every step: is this point on a road, does this circle hit a building, where is the
// nearest road point. Nothing here draws or listens to input.
import { CAR_MODELS, ROAD, WORLD } from './config.js';
import { pick, range } from './random.js';

const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 1080, y1: 2700, tint: '#e8f4f8' },
  { name: 'Old Town', x0: 1080, y0: 0, x1: 2160, y1: 1080, tint: '#f6ead2' },
  { name: 'Downtown', x0: 1080, y0: 1080, x1: 2520, y1: 2160, tint: '#efe6da' },
  { name: 'Hills', x0: 2160, y0: 0, x1: 3600, y1: 2700, tint: '#e9f0dc' },
];

const ROOF_COLORS = ['#e8a87c', '#d98c8c', '#a8c8e8', '#f2e394', '#c9a8d8', '#8fc7a8', '#e8b64c'];

function roadLines(start, end, step) {
  const lines = [];
  for (let at = start; at <= end; at += step) lines.push(at);
  return lines;
}

/** Build the whole city from a seeded generator. Returns the city object the game keeps. */
export function createCity(random) {
  const roadsV = roadLines(300, 3300, ROAD.spacing);
  const roadsH = roadLines(300, 2400, ROAD.spacing);
  const buildings = [];
  const parks = [];
  const trees = [];
  const parkingLots = [];

  // Every block between four roads gets buildings, a park, or a parking lot.
  for (let vi = 0; vi < roadsV.length - 1; vi += 1) {
    for (let hi = 0; hi < roadsH.length - 1; hi += 1) {
      const x0 = roadsV[vi] + ROAD.half + 14;
      const x1 = roadsV[vi + 1] - ROAD.half - 14;
      const y0 = roadsH[hi] + ROAD.half + 14;
      const y1 = roadsH[hi + 1] - ROAD.half - 14;
      const roll = random();
      if (roll < 0.12) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const treeCount = 3 + Math.floor(random() * 4);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: 12 + random() * 10 });
        }
        continue;
      }
      if (roll < 0.2) {
        parkingLots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = 2;
      const rows = 2;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bx = x0 + c * cw + 8 + random() * 10;
          const by = y0 + r * ch + 8 + random() * 10;
          const bw = cw - 24 - random() * 14;
          const bh = ch - 24 - random() * 14;
          const downtown = bx > 1080 && bx < 2520 && by > 1080 && by < 2160;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            tall: downtown && random() < 0.55,
            color: pick(random, ROOF_COLORS),
          });
        }
      }
    }
  }

  // Landmarks the missions and the minimap point at (all on roads, never inside buildings).
  const landmarks = {
    garage: { name: 'Mara\u2019s Garage', x: 660, y: 1380 },
    pier: { name: 'Marina Pier', x: 300, y: 660 },
    bank: { name: 'Solmar Bay Bank', x: 1740, y: 1560 },
    oldTown: { name: 'Old Town Square', x: 1380, y: 660 },
    safehouse: { name: 'Hills Safehouse', x: 2940, y: 660 },
    hideout: { name: 'Hideout', x: 660, y: 1740 },
  };

  return {
    roadsV, roadsH, buildings, parks, trees, parkingLots, landmarks,
    districts: DISTRICTS,
    spawn: { x: 660, y: 1200 },
    beach: { x0: 0, x1: 190 },
  };
}

/** True when the point is on asphalt (inside a road band, or on the beach road). */
export function onRoad(city, x, y) {
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= ROAD.half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= ROAD.half) return true;
  return false;
}

/** True when the point is on the sand or in the water at the west edge. */
export function onBeach(city, x) {
  return x < city.beach.x1;
}

/** The district a point sits in, for the HUD's location line. */
export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar Bay';
}

/** Push a circle out of every building it overlaps; returns true when it hit one. */
export function collideBuildings(city, circle) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(circle.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(circle.y, b.y + b.h));
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= circle.r * circle.r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      circle.x = cx + (dx / d) * circle.r;
      circle.y = cy + (dy / d) * circle.r;
    } else {
      // Centre inside the building: push out along the shortest side.
      const left = circle.x - b.x;
      const right = b.x + b.w - circle.x;
      const top = circle.y - b.y;
      const bottom = b.y + b.h - circle.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) circle.x = b.x - circle.r;
      else if (m === right) circle.x = b.x + b.w + circle.r;
      else if (m === top) circle.y = b.y - circle.r;
      else circle.y = b.y + b.h + circle.r;
    }
  }
  return hit;
}

/** Clamp a point inside the world, with the water at the west edge kept walkable sand. */
export function clampWorld(x, y) {
  return {
    x: Math.max(70, Math.min(WORLD.width - 20, x)),
    y: Math.max(20, Math.min(WORLD.height - 20, y)),
  };
}

/** A road point near (x, y): the nearest road centre, snapped to a lane. */
export function nearestRoadPoint(city, x, y) {
  let bestV = city.roadsV[0];
  for (const rx of city.roadsV) if (Math.abs(rx - x) < Math.abs(bestV - x)) bestV = rx;
  let bestH = city.roadsH[0];
  for (const ry of city.roadsH) if (Math.abs(ry - y) < Math.abs(bestH - y)) bestH = ry;
  if (Math.abs(bestV - x) <= Math.abs(bestH - y)) return { x: bestV, y, vertical: true };
  return { x, y: bestH, vertical: false };
}

/** A random parked-car model and colour. */
export function randomCarModel(random) {
  return pick(random, CAR_MODELS);
}

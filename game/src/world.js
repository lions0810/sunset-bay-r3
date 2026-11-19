// world.js - Sunset Bay's city plan: a sun-soaked grid of avenues over a
// 2400x1600 world, generated deterministically from the run seed.
// Roads run in straight bands; the blocks between them hold buildings
// fronted by a kerb and pavement, car parks, palms and small plazas.

import { Rng } from './rng.js';

export const WORLD_W = 2400;
export const WORLD_H = 1600;
export const ROAD_W = 84;
export const KERB = 7; // pavement lip included in building collision

export const AVENUES_X = [200, 600, 1000, 1400, 1800, 2200];
export const STREETS_Y = [200, 600, 1000, 1400];

const SHOP_NAMES = [
  'Cafe Sol', 'Bay Books', 'Palma Gym', 'Surf Shop', 'Noodle Bar',
  'Hotel Mar', 'Vinyl Den', 'Taco Luna', 'Bay Bakery', 'Ink Studio',
  'Fish Market', 'Jazz Cellar', 'Palm Pharmacy', 'Cycle Works', 'Deli Verde',
  'Sunset Cinema', 'Harbour Bank', 'Mango Mart', 'Sail Repair', 'Gallery Ora',
];

const BUILDING_TONES = [24, 32, 40, 14, 200, 210, 350, 45];

function bands(centres, limit) {
  // Land bands between neighbouring road bands, clipped to the world.
  const out = [];
  let start = 0;
  for (const c of centres) {
    out.push([start, c - ROAD_W / 2]);
    start = c + ROAD_W / 2;
  }
  out.push([start, limit]);
  return out.filter(([a, b]) => b - a > 90);
}

export function generateWorld(seed) {
  const rng = new Rng(`sunset-bay-city-${seed}`);
  const buildings = [];
  const lots = [];
  const palms = [];
  const xBands = bands(AVENUES_X, WORLD_W);
  const yBands = bands(STREETS_Y, WORLD_H);

  for (const [x0, x1] of xBands) {
    for (const [y0, y1] of yBands) {
      const roll = rng.next();
      if (roll < 0.16) {
        // Open car park: asphalt slab with marked bays, no building.
        lots.push({ x: x0 + 10, y: y0 + 10, w: x1 - x0 - 20, h: y1 - y0 - 20 });
        continue;
      }
      if (roll < 0.26) {
        // Palm plaza: open ground the player can cross on foot.
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        for (let i = 0; i < 4; i++) {
          palms.push({ x: cx + rng.range(-70, 70), y: cy + rng.range(-50, 50), s: rng.range(0.8, 1.25) });
        }
        lots.push({ x: x0 + 10, y: y0 + 10, w: x1 - x0 - 20, h: y1 - y0 - 20, plaza: true });
        continue;
      }
      const inset = rng.range(16, 26);
      const b = {
        x: x0 + inset,
        y: y0 + inset,
        w: x1 - x0 - inset * 2,
        h: y1 - y0 - inset * 2,
        tone: BUILDING_TONES[rng.int(0, BUILDING_TONES.length - 1)],
        floors: rng.int(3, 9),
        name: SHOP_NAMES[rng.int(0, SHOP_NAMES.length - 1)],
        lit: rng.next(),
      };
      buildings.push(b);
    }
  }

  // Promenade palms along the southern bay edge.
  for (let x = 60; x < WORLD_W; x += 90) {
    palms.push({ x: x + rng.range(-12, 12), y: 1548 + rng.range(-6, 6), s: rng.range(0.9, 1.3) });
  }

  return { buildings, lots, palms, seed };
}

export function isRoadPoint(x, y) {
  if (AVENUES_X.some((c) => Math.abs(x - c) <= ROAD_W / 2)) return true;
  if (STREETS_Y.some((c) => Math.abs(y - c) <= ROAD_W / 2)) return true;
  return false;
}

// Collision against buildings, kerb included: the solid rectangle is the
// building footprint grown by KERB on every side. Pushes a circle out.
export function collideBuildings(world, pos, radius) {
  for (const b of world.buildings) {
    const minX = b.x - KERB - radius;
    const maxX = b.x + b.w + KERB + radius;
    const minY = b.y - KERB - radius;
    const maxY = b.y + b.h + KERB + radius;
    if (pos.x > minX && pos.x < maxX && pos.y > minY && pos.y < maxY) {
      const left = pos.x - minX;
      const right = maxX - pos.x;
      const top = pos.y - minY;
      const bottom = maxY - pos.y;
      const smallest = Math.min(left, right, top, bottom);
      if (smallest === left) pos.x = minX;
      else if (smallest === right) pos.x = maxX;
      else if (smallest === top) pos.y = minY;
      else pos.y = maxY;
    }
  }
  if (pos.x < radius) pos.x = radius;
  if (pos.y < radius) pos.y = radius;
  if (pos.x > WORLD_W - radius) pos.x = WORLD_W - radius;
  if (pos.y > WORLD_H - radius) pos.y = WORLD_H - radius;
}

export function buildingAt(world, x, y) {
  return world.buildings.some(
    (b) => x >= b.x - KERB && x <= b.x + b.w + KERB && y >= b.y - KERB && y <= b.y + b.h + KERB,
  );
}

// Spawn points that always sit in the middle of a road intersection.
export const INTERSECTIONS = [];
for (const x of AVENUES_X) for (const y of STREETS_Y) INTERSECTIONS.push({ x, y });

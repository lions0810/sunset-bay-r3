// rng.js - deterministic seeded randomness for Sunset Bay.
// The whole city is generated from one numeric seed so that a given
// ?seed=N always builds the exact same streets, colours and traffic.

export function hashSeed(value) {
  // FNV-1a style mixing for strings, then a final integer avalanche.
  let h = 2166136261 >>> 0;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    this.state = hashSeed(seed) || 0x9e3779b9;
  }

  // mulberry32 step: returns a float in [0, 1).
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length) % list.length];
  }

  chance(probability) {
    return this.next() < probability;
  }

  // A soft pastel-to-sunset colour built from three channel ranges.
  colour(hueBase, hueSpread, sat, light) {
    const hue = Math.floor(hueBase + this.next() * hueSpread) % 360;
    return `hsl(${hue} ${sat}% ${light}%)`;
  }
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Shortest signed turn from one angle to another, in (-PI, PI].
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * Deterministic random numbers for the simulation.
 *
 * Every career has a master seed. Each part of the game draws from a *named stream*
 * (for example `worldgen` or `prelim:2031:R3:day4`) derived from the master seed, so a
 * save replays identically and a bug can be reproduced from its seed and stream name.
 */

/** xmur3: turns a string into four 32-bit seed words. */
export function hashSeed(input: string): [number, number, number, number] {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = (): number => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  return [next(), next(), next(), next()];
}

/** One independent, repeatable sequence of random numbers (sfc32). */
export class RandomStream {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spareNormal: number | undefined;

  constructor(seed: [number, number, number, number]) {
    [this.a, this.b, this.c, this.d] = seed;
    for (let i = 0; i < 15; i++) this.next();
  }

  /** A float in [0, 1). */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** A float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** An integer in [min, max], both included. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`int(${min}, ${max}): need integers with max >= min`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** A random item of a non-empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick() needs a non-empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** An item chosen with the given weights (same order as items). */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError('weighted() needs equal-length, non-empty lists');
    }
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (!(total > 0)) throw new RangeError('weighted() needs a positive total weight');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** A normally distributed number (Box-Muller). */
  normal(mean = 0, sd = 1): number {
    if (this.spareNormal !== undefined) {
      const value = this.spareNormal;
      this.spareNormal = undefined;
      return mean + sd * value;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const radius = Math.sqrt(-2 * Math.log(u));
    this.spareNormal = radius * Math.sin(2 * Math.PI * v);
    return mean + sd * radius * Math.cos(2 * Math.PI * v);
  }

  /** A normally distributed number kept inside [min, max]. */
  clampedNormal(mean: number, sd: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, this.normal(mean, sd)));
  }

  /** A new shuffled copy of a list (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }
}

/** The set of named streams for one career. */
export class Rng {
  constructor(readonly masterSeed: string) {}

  /** The stream with this name. The same name always gives the same sequence. */
  stream(name: string): RandomStream {
    return new RandomStream(hashSeed(`${this.masterSeed}|${name}`));
  }
}

export function createRng(masterSeed: string | number): Rng {
  return new Rng(String(masterSeed));
}

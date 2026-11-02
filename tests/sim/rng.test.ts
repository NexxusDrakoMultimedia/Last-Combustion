// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

const take = (n: number, next: () => number) => Array.from({ length: n }, next);

describe('Rng', () => {
  it('repeats the same sequence for the same seed and stream name', () => {
    const a = createRng('2031').stream('worldgen');
    const b = createRng('2031').stream('worldgen');
    expect(take(20, () => a.next())).toEqual(take(20, () => b.next()));
  });

  it('gives different sequences for different seeds or stream names', () => {
    const base = take(10, () => createRng('2031').stream('worldgen').next());
    const otherSeed = createRng('2032').stream('worldgen');
    const otherName = createRng('2031').stream('prelim:2031:R3:day4');
    expect(take(10, () => otherSeed.next())).not.toEqual(base);
    expect(take(10, () => otherName.next())).not.toEqual(base);
  });

  it('keeps streams independent: using one does not change another', () => {
    const rng = createRng('abc');
    const first = take(5, () => rng.stream('a').next());
    const reference = rng.stream('a');
    rng.stream('b').next();
    expect(first[0]).toBe(reference.next());
  });

  it('produces floats in [0, 1)', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const s = createRng(seed).stream('x');
        return take(50, () => s.next()).every((v) => v >= 0 && v < 1);
      }),
    );
  });

  it('produces integers within the requested inclusive range', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -50, max: 50 }),
        fc.nat(100),
        (seed, min, span) => {
          const max = min + span;
          const s = createRng(seed).stream('ints');
          return take(50, () => s.int(min, max)).every((v) => v >= min && v <= max);
        },
      ),
    );
  });

  it('rejects an invalid integer range', () => {
    const s = createRng('x').stream('y');
    expect(() => s.int(5, 4)).toThrow(RangeError);
    expect(() => s.int(0.5, 3)).toThrow(RangeError);
  });

  it('shuffles without losing or duplicating items, and does not change the input', () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.integer()), (seed, items) => {
        const copy = [...items];
        const shuffled = createRng(seed).stream('s').shuffle(items);
        expect(items).toEqual(copy);
        expect([...shuffled].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });

  it('draws a normal distribution with roughly the requested mean and spread', () => {
    const s = createRng('normal').stream('n');
    const values = take(20000, () => s.normal(45, 12));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    expect(mean).toBeGreaterThan(44.5);
    expect(mean).toBeLessThan(45.5);
    expect(Math.sqrt(variance)).toBeGreaterThan(11.5);
    expect(Math.sqrt(variance)).toBeLessThan(12.5);
  });

  it('keeps clamped normals inside their limits', () => {
    const s = createRng('clamp').stream('c');
    expect(take(5000, () => s.clampedNormal(45, 12, 20, 85)).every((v) => v >= 20 && v <= 85)).toBe(
      true,
    );
  });

  it('picks by weight', () => {
    const s = createRng('w').stream('w');
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) counts[s.weighted(['a', 'b'] as const, [1, 3])]++;
    expect(counts.b / counts.a).toBeGreaterThan(2.6);
    expect(counts.b / counts.a).toBeLessThan(3.4);
  });
});

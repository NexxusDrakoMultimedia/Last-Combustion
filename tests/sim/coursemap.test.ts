// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { outlineOf, pointAtKm, spread } from '../../src/sim/courses/map';

const line: [number, number, number][] = [
  [0, 0, 0],
  [100, 0, 10],
  [100, 100, 20],
];

describe('a point at a distance along the lap', () => {
  it('is the start at 0 km and the end at the lap length', () => {
    expect(pointAtKm(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtKm(line, 20)).toEqual({ x: 100, y: 100 });
  });

  it('interpolates between the two points either side', () => {
    expect(pointAtKm(line, 5)).toEqual({ x: 50, y: 0 });
    expect(pointAtKm(line, 15)).toEqual({ x: 100, y: 50 });
  });

  it('keeps a distance outside the lap on its ends', () => {
    expect(pointAtKm(line, -3)).toEqual({ x: 0, y: 0 });
    expect(pointAtKm(line, 99)).toEqual({ x: 100, y: 100 });
  });

  it('copes with points at the same distance', () => {
    const same: [number, number, number][] = [
      [0, 0, 0],
      [10, 10, 5],
      [20, 20, 5],
      [30, 30, 10],
    ];
    const p = pointAtKm(same, 5);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it('always lies inside the box of the points', () => {
    fc.assert(
      fc.property(fc.double({ min: -5, max: 30, noNaN: true }), (km) => {
        const p = pointAtKm(line, km);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }),
    );
  });
});

describe('the saved outlines', () => {
  it('give every course a path, a box and points that run from 0 km to the lap length', () => {
    for (let n = 1; n <= 6; n++) {
      const o = outlineOf(n)!;
      expect(o.path.startsWith('M')).toBe(true);
      expect(o.viewBox).toHaveLength(4);
      expect(o.points.length).toBeGreaterThan(50);
      expect(o.points[0]![2]).toBe(0);
      expect(o.points[o.points.length - 1]![2]).toBeCloseTo(o.lapKm, 0);
    }
  });

  it('are unknown for a course that does not exist', () => {
    expect(outlineOf(99)).toBeUndefined();
  });
});

describe('spreading marks over a lap', () => {
  it('keeps everything when it fits', () => {
    expect(spread([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(spread([], 5)).toEqual([]);
  });

  it('keeps the first and the last and spaces the rest evenly', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const kept = spread(items, 10);
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe(0);
    expect(kept[9]).toBe(99);
    expect(new Set(kept).size).toBe(10);
  });

  it('never gives more than the limit, never repeats and stays in order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 2, max: 80 }), (n, max) => {
        const kept = spread(
          Array.from({ length: n }, (_, i) => i),
          max,
        );
        expect(kept.length).toBe(Math.min(n, max));
        expect(new Set(kept).size).toBe(kept.length);
        expect([...kept].sort((a, b) => a - b)).toEqual(kept);
        if (n > 0) {
          expect(kept[0]).toBe(0);
          expect(kept[kept.length - 1]).toBe(n - 1);
        }
      }),
    );
  });
});

describe('a point on a saved outline', () => {
  it('is exactly the point when the distance is that of a point, whichever one', () => {
    const o = outlineOf(1)!;
    for (const i of [1, 50, 100, 150, o.points.length - 2]) {
      const [x, y, km] = o.points[i]!;
      expect(pointAtKm(o.points, km)).toEqual({ x, y });
    }
  });
});

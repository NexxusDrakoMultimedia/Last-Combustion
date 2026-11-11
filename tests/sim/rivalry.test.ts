// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  closeFinishPairs,
  decayHeat,
  fanMultiplier,
  levelFor,
  settleCap,
  titleFightPair,
} from '../../src/sim/rivalry';

describe('rivalry levels', () => {
  it('reads heat against the thresholds', () => {
    expect(levelFor(29, 0)).toBe('none');
    expect(levelFor(30, 0)).toBe('spark');
    expect(levelFor(60, 0)).toBe('rivalry');
    expect(levelFor(90, 4)).toBe('feud');
    expect(levelFor(90, 5)).toBe('legendary');
  });

  it('never gets lower as heat rises', () => {
    const order = ['none', 'spark', 'rivalry', 'feud', 'legendary'];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 10 }),
        (a, b, seasons) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          expect(order.indexOf(levelFor(high, seasons))).toBeGreaterThanOrEqual(
            order.indexOf(levelFor(low, seasons)),
          );
        },
      ),
    );
  });
});

describe('heat and fans', () => {
  it('decays ten percent a round', () => {
    expect(decayHeat(50)).toBe(45);
  });

  it('keeps decayed heat between zero and the start', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (h) => {
        const d = decayHeat(h);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(h);
      }),
    );
  });

  it('multiplies fans by level', () => {
    expect(fanMultiplier('none')).toBe(1);
    expect(fanMultiplier('spark')).toBe(1.1);
    expect(fanMultiplier('rivalry')).toBe(1.25);
    expect(fanMultiplier('feud')).toBe(1.5);
    expect(fanMultiplier('legendary')).toBe(1.5);
  });
});

describe('shared moments', () => {
  it('pairs adjacent finishers within half a second', () => {
    const pairs = closeFinishPairs([
      { driverId: 9, timeMs: 100_000 },
      { driverId: 4, timeMs: 100_400 },
      { driverId: 2, timeMs: 101_000 },
    ]);
    expect(pairs).toEqual([{ a: 4, b: 9 }]);
  });

  it('ignores a driver with no time', () => {
    expect(
      closeFinishPairs([
        { driverId: 1, timeMs: 100_000 },
        { driverId: 2, timeMs: null },
      ]),
    ).toEqual([]);
  });

  it('pairs the title leaders only when both are in the final', () => {
    expect(titleFightPair([7, 3], [3, 7, 9])).toEqual({ a: 3, b: 7 });
    expect(titleFightPair([7, 3], [3, 9])).toBeNull();
    expect(titleFightPair(null, [3, 7])).toBeNull();
  });
});

describe('the cap', () => {
  it('adds, displaces or refuses', () => {
    expect(settleCap([40, 50], 35, 3)).toBe('add');
    expect(settleCap([40, 50, 60], 55, 3)).toBe('displace');
    expect(settleCap([40, 50, 60], 35, 3)).toBe('refuse');
  });
});

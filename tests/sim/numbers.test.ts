// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isRankedNumber, rankingNumbers, RANKED_NUMBERS } from '../../src/sim/numbers';

const field = (n: number, notRacing: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({ driverId: i + 1, racing: !notRacing.includes(i + 1) }));

describe('ranking numbers', () => {
  it('gives the first 40 drivers numbers 1 to 40 in order, and nobody else a number', () => {
    const numbers = rankingNumbers(field(100));
    expect(numbers.size).toBe(RANKED_NUMBERS);
    for (let i = 1; i <= RANKED_NUMBERS; i++) expect(numbers.get(i)).toBe(i);
    expect(numbers.has(41)).toBe(false);
  });

  it('leaves a number of a driver who is not racing to the best-ranked driver without one', () => {
    const numbers = rankingNumbers(field(100, [3, 10]));
    expect(numbers.has(3)).toBe(false);
    expect(numbers.has(10)).toBe(false);
    expect(numbers.get(41)).toBe(3);
    expect(numbers.get(42)).toBe(10);
    expect(numbers.get(1)).toBe(1);
    expect(numbers.get(4)).toBe(4);
  });

  it('fills as many numbers as there are racing drivers when the field is small', () => {
    expect(rankingNumbers(field(10)).size).toBe(10);
    expect(rankingNumbers([]).size).toBe(0);
    expect(rankingNumbers(field(5, [1, 2, 3, 4, 5])).size).toBe(0);
  });

  it('gives every number once, only to racing drivers, all within 1 to 40', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.array(fc.integer({ min: 1, max: 120 }), { maxLength: 60 }),
        (size, out) => {
          const numbers = rankingNumbers(field(size, out));
          const values = [...numbers.values()];
          expect(new Set(values).size).toBe(values.length);
          for (const [driverId, number] of numbers) {
            expect(isRankedNumber(number)).toBe(true);
            expect(out.includes(driverId)).toBe(false);
          }
          const racing = size - new Set(out.filter((d) => d <= size)).size;
          expect(numbers.size).toBe(Math.min(RANKED_NUMBERS, racing));
        },
      ),
    );
  });

  it('knows which numbers are in the ranked block', () => {
    expect(isRankedNumber(1)).toBe(true);
    expect(isRankedNumber(40)).toBe(true);
    expect(isRankedNumber(41)).toBe(false);
    expect(isRankedNumber(0)).toBe(false);
  });
});

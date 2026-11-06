// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AWARDS, pickWinner } from '../../src/sim/awards';

describe('awards', () => {
  it('are listed once each, with a subject and a minimum', () => {
    expect(new Set(AWARDS.map((a) => a.id)).size).toBe(AWARDS.length);
    expect(AWARDS.map((a) => a.id)).toEqual(
      expect.arrayContaining([
        'fan_favourite',
        'hard_charger',
        'most_improved',
        'rookie_of_the_year',
      ]),
    );
    for (const a of AWARDS) expect(['driver', 'garage']).toContain(a.subject);
  });

  it('go to the highest value, a tie to more points and then the lower id', () => {
    expect(
      pickWinner(
        [
          { id: 1, value: 5, points: 10 },
          { id: 2, value: 7, points: 1 },
        ],
        1,
      )!.id,
    ).toBe(2);
    expect(
      pickWinner(
        [
          { id: 1, value: 5, points: 10 },
          { id: 2, value: 5, points: 30 },
        ],
        1,
      )!.id,
    ).toBe(2);
    expect(
      pickWinner(
        [
          { id: 9, value: 5, points: 10 },
          { id: 4, value: 5, points: 10 },
        ],
        1,
      )!.id,
    ).toBe(4);
  });

  it('are not given when nobody reaches the minimum', () => {
    expect(pickWinner([], 1)).toBeUndefined();
    expect(pickWinner([{ id: 1, value: 0, points: 50 }], 1)).toBeUndefined();
  });

  it('do not depend on the order of the candidates', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            id: fc.integer({ min: 1, max: 500 }),
            value: fc.integer({ min: 0, max: 20 }),
            points: fc.integer({ min: 0, max: 100 }),
          }),
          { selector: (c) => c.id, maxLength: 30 },
        ),
        (list) => {
          expect(pickWinner(list, 1)).toEqual(pickWinner([...list].reverse(), 1));
        },
      ),
    );
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rollDeath } from '../../src/sim/deaths';
import { createRng } from '../../src/sim/rng';
import { seasonBalance } from '../../src/sim/worldgen/data';

describe('non-racing deaths', () => {
  it('are rare, at about the rate in the balance data', () => {
    let died = 0;
    const n = 40_000;
    for (let i = 0; i < n; i++) if (rollDeath(createRng(`d-${i}`).stream('death'))) died++;
    const rate = died / n;
    expect(rate).toBeGreaterThan(seasonBalance.deaths.chancePerYear / 2);
    expect(rate).toBeLessThan(seasonBalance.deaths.chancePerYear * 2);
  });

  it('have a cause from the list and a day that is on every calendar', () => {
    const seen = new Set<string>();
    let found = 0;
    for (let i = 0; i < 400_000 && found < 300; i++) {
      const roll = rollDeath(createRng(`c-${i}`).stream('death'));
      if (!roll) continue;
      found++;
      seen.add(roll.cause);
      expect(seasonBalance.deaths.causes).toContain(roll.cause);
      expect(roll.month).toBeGreaterThanOrEqual(1);
      expect(roll.month).toBeLessThanOrEqual(12);
      expect(roll.day).toBeGreaterThanOrEqual(1);
      expect(roll.day).toBeLessThanOrEqual(28);
    }
    expect(found).toBe(300);
    expect(seen.size).toBe(seasonBalance.deaths.causes.length);
  });

  it('are the same for the same stream', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        expect(rollDeath(createRng('s').stream(name))).toEqual(
          rollDeath(createRng('s').stream(name)),
        );
      }),
    );
  });
});

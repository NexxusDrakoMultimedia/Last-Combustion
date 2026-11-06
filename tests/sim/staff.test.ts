// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import {
  crewStrength,
  mechanicOffers,
  partWearFactor,
  repairFactor,
  wageFor,
  wagePerRound,
} from '../../src/sim/staff';

describe('mechanics’ wages', () => {
  it('are $500 a week for a middling mechanic and rise with skill', () => {
    expect(wageFor(50)).toBe(500);
    expect(wageFor(90)).toBeGreaterThan(wageFor(30));
  });

  it('are a year of weeks shared over the six rounds', () => {
    expect(wagePerRound(500)).toBe(Math.round((500 * 52) / 6));
    expect(wagePerRound(0)).toBe(0);
  });
});

describe('the mechanics on offer', () => {
  it('are four with different skill, each paid by their skill, the same for the same stream', () => {
    const a = mechanicOffers(createRng('staff').stream('x'));
    const b = mechanicOffers(createRng('staff').stream('x'));
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    for (const o of a) {
      expect(o.skill).toBeGreaterThanOrEqual(30);
      expect(o.skill).toBeLessThanOrEqual(90);
      expect(o.wagePerWeek).toBe(wageFor(o.skill));
      expect(o.name).toMatch(/\S+ \S+/);
    }
    const other = mechanicOffers(createRng('staff').stream('y'));
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(a));
  });
});

describe('crew cover', () => {
  it('is skill per entry, from nothing with no mechanics to a full crew at one expert each', () => {
    expect(crewStrength([], 3)).toBe(0);
    expect(crewStrength([100], 1)).toBe(1);
    expect(crewStrength([50, 50], 1)).toBe(1);
    expect(crewStrength([50], 2)).toBeCloseTo(0.25, 8);
    expect(crewStrength([100, 100, 100], 2)).toBe(1);
    expect(crewStrength([80], 0)).toBe(0);
  });

  it('never leaves 0 to 1, and a better or bigger crew never covers less', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 12 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 100 }),
        (skills, entries, extra) => {
          const s = crewStrength(skills, entries);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
          expect(crewStrength([...skills, extra], entries)).toBeGreaterThanOrEqual(s);
        },
      ),
    );
  });

  it('saves up to a quarter of parts wear and a fifth of crash repairs', () => {
    expect(partWearFactor(0)).toBe(1);
    expect(partWearFactor(1)).toBeCloseTo(0.75, 8);
    expect(repairFactor(0)).toBe(1);
    expect(repairFactor(1)).toBeCloseTo(0.8, 8);
    expect(partWearFactor(0.5)).toBeGreaterThan(partWearFactor(1));
  });
});

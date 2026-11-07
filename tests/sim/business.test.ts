// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  businessDividend,
  facilityLevelsFor,
  nextFacility,
  vacantRoles,
  yearlyUpkeep,
} from '../../src/sim/business';
import { facilityDef, type FacilityLevels } from '../../src/sim/facilities';
import { createRng } from '../../src/sim/rng';

describe('computer garage businesses', () => {
  it('fills no more roles than the prestige allows, and none already filled', () => {
    expect(vacantRoles(5, [])).toEqual([]);
    const some = vacantRoles(35, ['chief_executive']);
    expect(some).toHaveLength(2);
    expect(some).not.toContain('chief_executive');
  });

  it('builds facilities until the prestige is used up, always after what they need', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.string(), (prestige, seed) => {
        const rng = createRng(seed).stream('f');
        const held: FacilityLevels = {};
        for (let i = 0; i < 100; i++) {
          const kind = nextFacility(rng, prestige, held);
          if (!kind) break;
          const needs = facilityDef(kind).needs;
          if (needs) expect(held[needs] ?? 0).toBeGreaterThan(0);
          held[kind] = (held[kind] ?? 0) + 1;
        }
        const total = Object.values(held).reduce((s, x) => s + (x ?? 0), 0);
        expect(total).toBeLessThanOrEqual(facilityLevelsFor(prestige));
      }),
    );
  });

  it('adds up the yearly upkeep of the executives and facilities', () => {
    expect(yearlyUpkeep([100, 200], {})).toEqual({ salaries: 300, facilities: 0 });
    expect(yearlyUpkeep([], { workshop_bays: 2 }).facilities).toBe(2 * 600 * 6);
  });

  it('never pays a dividend that takes the garage below its minimum cash', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5_000_000, max: 5_000_000 }),
        fc.integer({ min: -1_000_000, max: 5_000_000 }),
        (profit, cash) => {
          const d = businessDividend(profit, cash);
          expect(d).toBeGreaterThanOrEqual(0);
          if (d > 0) expect(cash - d).toBeGreaterThanOrEqual(150000);
        },
      ),
    );
    expect(businessDividend(1_000_000, 10_000_000)).toBe(500000);
    expect(businessDividend(-1, 10_000_000)).toBe(0);
  });
});

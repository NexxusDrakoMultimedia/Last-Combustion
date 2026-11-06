// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BUILT_ROLES,
  EXECUTIVE_ROLES,
  executiveBonuses,
  executiveOffers,
  executiveSlots,
  fairSalaryFor,
  NO_BONUSES,
  salaryPerRound,
} from '../../src/sim/executives';
import { createRng } from '../../src/sim/rng';

describe('executive slots and pay', () => {
  it('open at prestige 10, one more for every 10 points', () => {
    expect(executiveSlots(1)).toBe(0);
    expect(executiveSlots(9)).toBe(0);
    expect(executiveSlots(10)).toBe(1);
    expect(executiveSlots(19)).toBe(1);
    expect(executiveSlots(20)).toBe(2);
    expect(executiveSlots(80)).toBe(8);
  });

  it('ask $40,000 plus $1,200 a skill point a year, shared over six rounds', () => {
    expect(fairSalaryFor(50)).toBe(100_000);
    expect(fairSalaryFor(90)).toBeGreaterThan(fairSalaryFor(35));
    expect(salaryPerRound(100_000)).toBe(16_667);
  });

  it('are offered three at a time, the same for the same stream', () => {
    const a = executiveOffers(createRng('exec').stream('x'), 'finance_director');
    const b = executiveOffers(createRng('exec').stream('x'), 'finance_director');
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    for (const o of a) {
      expect(o.role).toBe('finance_director');
      expect(o.skill).toBeGreaterThanOrEqual(35);
      expect(o.skill).toBeLessThanOrEqual(90);
      expect(o.salary).toBe(fairSalaryFor(o.skill));
      expect(o.age).toBeGreaterThanOrEqual(38);
      expect(o.name).toMatch(/\S+ \S+/);
    }
  });

  it('leave out the Operations Director until utilities are built', () => {
    expect(EXECUTIVE_ROLES).toContain('operations_director');
    expect(BUILT_ROLES).not.toContain('operations_director');
    expect(BUILT_ROLES).toHaveLength(7);
  });
});

describe('what executives add up to', () => {
  it('is nothing with no executives', () => {
    expect(executiveBonuses([])).toEqual(NO_BONUSES);
  });

  it('is each role’s maximum times skill ÷ 100', () => {
    const full = executiveBonuses([{ role: 'commercial_director', skill: 100 }]);
    expect(full.sponsorFee).toBeCloseTo(0.2, 8);
    expect(full.sponsorPrestige).toBe(10);
    const half = executiveBonuses([{ role: 'head_of_marketing', skill: 50 }]);
    expect(half.fans).toBeCloseTo(0.125, 8);
    expect(half.merchandise).toBeCloseTo(0.15, 8);
    const fin = executiveBonuses([{ role: 'finance_director', skill: 100 }]);
    expect(fin.auctionPremium).toBeCloseTo(0.03, 8);
    expect(fin.auctionFee).toBeCloseTo(0.02, 8);
    const tech = executiveBonuses([{ role: 'technical_director', skill: 100 }]);
    expect(tech.partPrice).toBeCloseTo(0.1, 8);
    expect(tech.partWear).toBeCloseTo(0.15, 8);
    const sport = executiveBonuses([{ role: 'sporting_director', skill: 100 }]);
    expect(sport.training).toBeCloseTo(0.25, 8);
    expect(sport.gearCost).toBeCloseTo(0.2, 8);
  });

  it('gives a Contracts Director’s extra patience only from skill 80', () => {
    expect(executiveBonuses([{ role: 'contracts_director', skill: 79 }]).extraPatience).toBe(false);
    expect(executiveBonuses([{ role: 'contracts_director', skill: 80 }]).extraPatience).toBe(true);
    expect(executiveBonuses([{ role: 'contracts_director', skill: 100 }]).leverage).toBeCloseTo(
      0.05,
      8,
    );
  });

  it('is lifted by up to a tenth for everyone else by a Chief Executive', () => {
    const alone = executiveBonuses([{ role: 'head_of_marketing', skill: 100 }]);
    const led = executiveBonuses([
      { role: 'head_of_marketing', skill: 100 },
      { role: 'chief_executive', skill: 100 },
    ]);
    expect(led.fans).toBeCloseTo(alone.fans * 1.1, 8);
    const weak = executiveBonuses([
      { role: 'head_of_marketing', skill: 100 },
      { role: 'chief_executive', skill: 50 },
    ]);
    expect(weak.fans).toBeCloseTo(alone.fans * 1.05, 8);
  });

  it('never goes negative or past the maximum, whatever the skill', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BUILT_ROLES),
        fc.integer({ min: -50, max: 300 }),
        (role, skill) => {
          const b = executiveBonuses([
            { role, skill },
            { role: 'chief_executive', skill: 100 },
          ]);
          for (const [key, value] of Object.entries(b)) {
            if (typeof value === 'number') {
              expect(value, key).toBeGreaterThanOrEqual(0);
              expect(value, key).toBeLessThanOrEqual(11);
            }
          }
          expect(b.sponsorFee).toBeLessThanOrEqual(0.2 * 1.1 + 1e-9);
        },
      ),
    );
  });
});

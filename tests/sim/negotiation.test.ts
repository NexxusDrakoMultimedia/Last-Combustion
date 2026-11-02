// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampRelationship,
  contractValue,
  counterValue,
  leverageFrom,
  multiplier,
  patienceFor,
  releaseFee,
  respond,
  salaryForValue,
  walkAwayValue,
} from '../../src/sim/negotiation';

const neutral = { leverage: 0, relationship: 0, rivalInterest: 0 };

describe('the walk-away value', () => {
  it('is the fair value when nothing tilts the deal', () => {
    expect(multiplier(neutral)).toBe(1);
    expect(walkAwayValue(100_000, 'wants_more', neutral)).toBe(100_000);
    expect(walkAwayValue(100_000, 'pays', neutral)).toBe(100_000);
  });

  it('rises with leverage and rivals, and falls with a good relationship', () => {
    expect(multiplier({ ...neutral, leverage: 0.2 })).toBeCloseTo(1.2);
    expect(multiplier({ ...neutral, relationship: 100 })).toBeCloseTo(0.9);
    expect(multiplier({ ...neutral, relationship: -100 })).toBeCloseTo(1.1);
    expect(multiplier({ ...neutral, rivalInterest: 1 })).toBeCloseTo(1.2);
    expect(walkAwayValue(100_000, 'wants_more', { ...neutral, rivalInterest: 1 })).toBeCloseTo(
      120_000,
    );
    expect(walkAwayValue(100_000, 'pays', { ...neutral, rivalInterest: 1 })).toBeCloseTo(
      100_000 / 1.2,
    );
  });

  it('caps leverage at 0.2 either way', () => {
    expect(multiplier({ ...neutral, leverage: 5 })).toBeCloseTo(1.2);
    expect(multiplier({ ...neutral, leverage: -5 })).toBeCloseTo(0.8);
    expect(leverageFrom(100, 0)).toBe(0.2);
    expect(leverageFrom(0, 100)).toBe(-0.2);
    expect(leverageFrom(60, 60)).toBe(0);
  });
});

describe('patience and counters', () => {
  it('is 3, 4 at a relationship of 50 and 2 at -50, never under 1', () => {
    expect(patienceFor(0)).toBe(3);
    expect(patienceFor(49)).toBe(3);
    expect(patienceFor(50)).toBe(4);
    expect(patienceFor(-50)).toBe(2);
    expect(patienceFor(-100)).toBe(2);
  });

  it('asks 15%, then 7%, then 2% better than the walk-away value, and stays at 2%', () => {
    expect(counterValue(100_000, 'wants_more', 0)).toBeCloseTo(115_000);
    expect(counterValue(100_000, 'wants_more', 1)).toBeCloseTo(107_000);
    expect(counterValue(100_000, 'wants_more', 2)).toBeCloseTo(102_000);
    expect(counterValue(100_000, 'wants_more', 9)).toBeCloseTo(102_000);
    expect(counterValue(100_000, 'pays', 0)).toBeCloseTo(85_000);
  });
});

describe('responding to an offer', () => {
  it('accepts at or above the walk-away value for a party that wants more', () => {
    expect(respond(100_000, 100_000, 'wants_more', 3, 0)).toEqual({ kind: 'accept' });
    expect(respond(130_000, 100_000, 'wants_more', 3, 0)).toEqual({ kind: 'accept' });
  });

  it('accepts at or below the walk-away value for a party that pays', () => {
    expect(respond(90_000, 100_000, 'pays', 3, 0)).toEqual({ kind: 'accept' });
    expect(respond(110_000, 100_000, 'pays', 3, 0).kind).not.toBe('accept');
  });

  it('counters a near miss for one patience, a lowball for two, a very low offer for three', () => {
    expect(respond(95_000, 100_000, 'wants_more', 3, 0)).toMatchObject({
      kind: 'counter',
      patienceLeft: 2,
    });
    expect(respond(70_000, 100_000, 'wants_more', 3, 0)).toMatchObject({
      kind: 'counter',
      patienceLeft: 1,
    });
    expect(respond(50_000, 100_000, 'wants_more', 4, 0)).toMatchObject({
      kind: 'counter',
      patienceLeft: 1,
    });
    expect(respond(50_000, 100_000, 'wants_more', 3, 0)).toEqual({ kind: 'walk' });
  });

  it('walks away when patience runs out, or for a nonsense offer', () => {
    expect(respond(95_000, 100_000, 'wants_more', 1, 2)).toEqual({ kind: 'walk' });
    expect(respond(0, 100_000, 'wants_more', 3, 0)).toEqual({ kind: 'walk' });
  });

  it('never accepts below the walk-away value and always makes progress', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 500_000 }),
        fc.integer({ min: 1000, max: 500_000 }),
        fc.integer({ min: 1, max: 5 }),
        (offer, walk, patience) => {
          const r = respond(offer, walk, 'wants_more', patience, 0);
          if (r.kind === 'accept') expect(offer).toBeGreaterThanOrEqual(walk);
          if (r.kind === 'counter') {
            expect(offer).toBeLessThan(walk);
            expect(r.patienceLeft).toBeLessThan(patience);
            expect(r.patienceLeft).toBeGreaterThan(0);
            expect(r.value).toBeGreaterThan(walk);
          }
        },
      ),
    );
  });
});

describe('contract terms', () => {
  it('values a longer contract 5% more per extra year, and converts back', () => {
    expect(contractValue(100_000, 1)).toBe(100_000);
    expect(contractValue(100_000, 3)).toBeCloseTo(110_000);
    expect(salaryForValue(110_000, 3)).toBe(100_000);
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 400_000 }),
        fc.integer({ min: 1, max: 5 }),
        (salary, years) => {
          expect(
            Math.abs(salaryForValue(contractValue(salary, years), years) - salary),
          ).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it('charges half the salary for each year left as a release fee', () => {
    expect(releaseFee(100_000, 2)).toBe(100_000);
    expect(releaseFee(100_000, 0)).toBe(0);
    expect(releaseFee(100_000, -1)).toBe(0);
  });

  it('keeps relationships within -100 and 100', () => {
    expect(clampRelationship(250)).toBe(100);
    expect(clampRelationship(-250)).toBe(-100);
    expect(clampRelationship(12.6)).toBe(13);
  });
});

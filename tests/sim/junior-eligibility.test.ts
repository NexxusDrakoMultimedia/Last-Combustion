// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ageOn, juniorEligibility } from '../../src/sim/junior';

const base = {
  birthDate: '2012-06-15',
  qualifiedForFinal: false,
  promoted: false,
  scoredSuperPoints: false,
};

describe('age', () => {
  it('counts whole years on a date', () => {
    expect(ageOn('2010-03-01', '2036-03-01')).toBe(26);
    expect(ageOn('2010-03-02', '2036-03-01')).toBe(25);
    expect(ageOn('2010-12-31', '2036-03-01')).toBe(25);
  });
});

describe('who may race in the Junior Series', () => {
  it('allows a young driver who has never reached a final or moved up', () => {
    expect(juniorEligibility(base, 2036)).toEqual({ eligible: true, reasons: [] });
  });

  it('allows a driver who turns 25 on the first of March but not one who has turned 26', () => {
    expect(juniorEligibility({ ...base, birthDate: '2011-03-01' }, 2036).eligible).toBe(true);
    expect(juniorEligibility({ ...base, birthDate: '2010-03-01' }, 2036)).toEqual({
      eligible: false,
      reasons: ['too_old'],
    });
  });

  it('refuses a driver who has reached a main-series final', () => {
    expect(juniorEligibility({ ...base, qualifiedForFinal: true }, 2036).reasons).toEqual([
      'reached_final',
    ]);
  });

  it('lets a Super Series driver who never scored drop down, but not one who scored a point', () => {
    expect(juniorEligibility(base, 2036).eligible).toBe(true);
    expect(juniorEligibility({ ...base, scoredSuperPoints: true }, 2036)).toEqual({
      eligible: false,
      reasons: ['scored_points'],
    });
  });

  it('refuses a driver who has moved up, however young they still are', () => {
    expect(juniorEligibility({ ...base, promoted: true }, 2037)).toEqual({
      eligible: false,
      reasons: ['promoted'],
    });
  });

  it('lists every reason', () => {
    const out = juniorEligibility(
      { birthDate: '1990-01-01', qualifiedForFinal: true, promoted: true, scoredSuperPoints: true },
      2036,
    );
    expect(out.reasons).toEqual(['too_old', 'reached_final', 'scored_points', 'promoted']);
  });

  it('only ever gets less eligible as a driver gets older', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2036, max: 2060 }), (year) => {
        const a = juniorEligibility(base, year).eligible;
        const b = juniorEligibility(base, year + 1).eligible;
        expect(a || !b).toBe(true);
      }),
    );
  });
});

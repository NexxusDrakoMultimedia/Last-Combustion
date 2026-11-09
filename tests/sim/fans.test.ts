// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { capFans, driverFanGain, seriesGrowth } from '../../src/sim/fans';

const quiet = { finalPos: null, points: 0, pole: false, overtakes: 0, home: false };

describe('fan gains', () => {
  it('follow the table: a win is 1% of the audience, a podium 0.4%, the rest of the final 0.1%', () => {
    expect(driverFanGain(200_000, { ...quiet, finalPos: 1 })).toBe(2000);
    expect(driverFanGain(200_000, { ...quiet, finalPos: 3 })).toBe(800);
    expect(driverFanGain(200_000, { ...quiet, finalPos: 9 })).toBe(200);
    expect(driverFanGain(200_000, { ...quiet, points: 1 })).toBe(20);
    expect(driverFanGain(200_000, quiet)).toBe(0);
  });

  it('add up pole and overtakes, and grow by a fifth at home', () => {
    expect(driverFanGain(200_000, { ...quiet, finalPos: 1, pole: true, overtakes: 5 })).toBe(
      2000 + 600 + 200,
    );
    expect(driverFanGain(200_000, { ...quiet, finalPos: 1, home: true })).toBe(2400);
  });

  it('give 0.6% of the audience for each attention flag', () => {
    expect(driverFanGain(200_000, { ...quiet, attention: 1 })).toBe(1200);
    expect(driverFanGain(200_000, { ...quiet, finalPos: 1, attention: 2 })).toBe(2000 + 2400);
    expect(driverFanGain(200_000, { ...quiet, attention: 0 })).toBe(0);
  });

  it('scale with the series audience and never go negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5_000_000 }),
        fc.option(fc.integer({ min: 1, max: 20 }), { nil: null }),
        fc.integer({ min: 0, max: 40 }),
        fc.boolean(),
        (audience, finalPos, overtakes, home) => {
          const gain = driverFanGain(audience, {
            finalPos,
            points: 0,
            pole: false,
            overtakes,
            home,
          });
          expect(gain).toBeGreaterThanOrEqual(0);
          expect(
            driverFanGain(audience * 2, { finalPos, points: 0, pole: false, overtakes, home }),
          ).toBeGreaterThanOrEqual(gain);
        },
      ),
    );
  });

  it('are capped at 40% of the audience', () => {
    expect(capFans(1_000_000, 200_000)).toBe(80_000);
    expect(capFans(500, 200_000)).toBe(500);
  });
});

describe('series growth', () => {
  it('is 25% a year for the first five seasons and 8% after, plus 1% for the festival', () => {
    expect(seriesGrowth(2032)).toBeCloseTo(0.26, 5);
    expect(seriesGrowth(2036)).toBeCloseTo(0.26, 5);
    expect(seriesGrowth(2037)).toBeCloseTo(0.09, 5);
  });

  it('adds half a percent for each attention flag raised the season before', () => {
    expect(seriesGrowth(2032, 4)).toBeCloseTo(0.28, 5);
    expect(seriesGrowth(2037, 2)).toBeCloseTo(0.1, 5);
  });
});

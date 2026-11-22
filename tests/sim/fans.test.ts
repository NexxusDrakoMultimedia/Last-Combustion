// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { capFans, driverFanGain, seasonBuzz, seriesGrowth } from '../../src/sim/fans';

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

describe('season buzz', () => {
  const dull = { titleGapShare: 0.5, rounds: 6, winners: 0, rivalryPoints: 0 };

  it('is nothing for a dull season', () => {
    expect(seasonBuzz(dull)).toBe(0);
    expect(seasonBuzz({ ...dull, titleGapShare: null })).toBe(0);
  });

  it('rewards a title race that went to the wire, fading out at a 10% gap', () => {
    expect(seasonBuzz({ ...dull, titleGapShare: 0 })).toBeCloseTo(0.03, 5);
    expect(seasonBuzz({ ...dull, titleGapShare: 0.05 })).toBeCloseTo(0.015, 5);
    expect(seasonBuzz({ ...dull, titleGapShare: 0.1 })).toBe(0);
  });

  it('rewards different winners, up to one for every round', () => {
    expect(seasonBuzz({ ...dull, winners: 6 })).toBeCloseTo(0.02, 5);
    expect(seasonBuzz({ ...dull, winners: 3 })).toBeCloseTo(0.01, 5);
    expect(seasonBuzz({ ...dull, winners: 9 })).toBeCloseTo(0.02, 5);
  });

  it('rewards live rivalries, with a cap', () => {
    expect(seasonBuzz({ ...dull, rivalryPoints: 5 })).toBeCloseTo(0.02, 5);
    expect(seasonBuzz({ ...dull, rivalryPoints: 100 })).toBeCloseTo(0.03, 5);
  });

  it('carries half of the last buzz into the next one, as word of mouth', () => {
    expect(seasonBuzz(dull, 0.1)).toBeCloseTo(0.05, 5);
  });

  it('is bounded and never goes down as the season gets more exciting', () => {
    fc.assert(
      fc.property(
        fc.record({
          titleGapShare: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
          rounds: fc.integer({ min: 0, max: 12 }),
          winners: fc.integer({ min: 0, max: 20 }),
          rivalryPoints: fc.integer({ min: 0, max: 60 }),
        }),
        fc.double({ min: 0, max: 0.15, noNaN: true }),
        (story, previous) => {
          const buzz = seasonBuzz(story, previous);
          expect(buzz).toBeGreaterThanOrEqual(0);
          expect(buzz).toBeLessThanOrEqual(0.15);
          expect(
            seasonBuzz({ ...story, rivalryPoints: story.rivalryPoints + 1 }, previous),
          ).toBeGreaterThanOrEqual(buzz);
        },
      ),
    );
  });

  it('adds to the series growth', () => {
    expect(seriesGrowth(2032, 0, 0.05)).toBeCloseTo(0.31, 5);
    expect(seriesGrowth(2032)).toBeCloseTo(0.26, 5);
  });
});

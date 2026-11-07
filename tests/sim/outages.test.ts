// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  OUTAGE_CATEGORIES,
  OUTAGE_EFFECTS,
  outageActive,
  outageChance,
  outageData,
} from '../../src/sim/outages';
import { createRng } from '../../src/sim/rng';
import { simulatePractice } from '../../src/sim/prelim/practice';
import type { DayPlan } from '../../src/sim/prelim/weather';

const seasonOf = (reliability: number, shorten = 0, category = OUTAGE_CATEGORIES[0]) => {
  let hit = 0;
  const rounds = 6;
  const years = 400;
  for (let year = 0; year < years; year++)
    for (let round = 1; round <= rounds; round++)
      if (outageActive('seed', 1, category, 2031 + year, round, reliability, shorten)) hit++;
  return hit / (years * rounds);
};

describe('supply outages', () => {
  it('are more likely the less reliable the supplier is', () => {
    expect(outageChance(1)).toBe(0);
    expect(outageChance(0.9)).toBeCloseTo(0.1, 10);
    expect(seasonOf(1)).toBe(0);
    expect(seasonOf(0.8)).toBeGreaterThan(seasonOf(0.9));
    expect(seasonOf(0.9)).toBeGreaterThan(seasonOf(0.99));
  });

  it('come out the same for the same seed, garage, category and round', () => {
    const a = outageActive('seed', 7, 'electricity', 2032, 3, 0.8);
    expect(outageActive('seed', 7, 'electricity', 2032, 3, 0.8)).toBe(a);
  });

  it('can run on into a second round, less often with an Operations Director', () => {
    // At reliability 0 every round starts an outage, so the rounds after the first only differ by running on.
    const runsOn = (shorten: number) => {
      let n = 0;
      for (let year = 0; year < 600; year++)
        if (outageActive('seed', 2, 'logistics', 2031 + year, 2, 0.7, shorten)) n++;
      return n;
    };
    expect(runsOn(0.3)).toBeLessThan(runsOn(0));
    expect(runsOn(1)).toBeLessThan(runsOn(0.3));
  });

  it('start from the seed alone, whatever supplier the garage has', () => {
    // Whoever the supplier is, the roll for a round is the same: a better supplier only lowers the bar.
    for (let year = 0; year < 200; year++) {
      const worse = outageActive('seed', 3, 'race_fuel', 2031 + year, 1, 0.8);
      const better = outageActive('seed', 3, 'race_fuel', 2031 + year, 1, 0.95);
      if (better) expect(worse).toBe(true);
    }
  });

  it('are about the share the data says for a typical supplier', () => {
    const rate = seasonOf(outageData.spotReliability);
    expect(rate).toBeGreaterThan(0.08);
    expect(rate).toBeLessThan(0.2);
  });
});

describe('practice with an outage', () => {
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i): DayPlan => ({
    date: `2031-01-0${i + 1}`,
    kind: 'practice' as const,
    prelimDay: null,
    weather: 'dry_clear',
    temperatureC: 20,
    temperatureBias: 0,
  }));
  const entries = [
    { entryId: 1, carId: 1, wear: 0 },
    { entryId: 2, carId: 2, wear: 0 },
  ];
  const km = (handicaps?: Map<number, { lapShare: number; daysLost: number }>) =>
    simulatePractice(entries, days, 10, createRng('p').stream('practice'), handicaps).raceKm;

  it('cuts the laps of a garage short of fuel and skips the days its cars are in transport', () => {
    const normal = km();
    const noFuel = km(new Map([[1, { lapShare: OUTAGE_EFFECTS.lapShare, daysLost: 0 }]]));
    const late = km(new Map([[1, { lapShare: 1, daysLost: OUTAGE_EFFECTS.daysLost }]]));
    expect(noFuel.get(1)!).toBeLessThan(normal.get(1)!);
    expect(late.get(1)!).toBeLessThan(normal.get(1)!);
  });
});

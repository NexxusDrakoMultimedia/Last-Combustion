// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  driverNationStandings,
  driverStandings,
  garageNationStandings,
  garageStandings,
  manufacturerStandings,
  type RoundResult,
} from '../../src/sim/standings';

const row = (over: Partial<RoundResult>): RoundResult => ({
  round: 1,
  driverId: 1,
  garageId: 1,
  manufacturerId: 1,
  driverFlag: 'AU',
  garageFlag: 'AU',
  position: 1,
  points: 10,
  prelimTimeMs: 1000,
  ...over,
});

describe('the driver championship', () => {
  it('adds up each driver’s points and ranks them', () => {
    const table = driverStandings([
      row({ driverId: 1, round: 1, points: 10, position: 1 }),
      row({ driverId: 1, round: 2, points: 8.5, position: 3 }),
      row({ driverId: 2, round: 1, points: 9, position: 2 }),
      row({ driverId: 2, round: 2, points: 10, position: 1 }),
      row({ driverId: 3, round: 1, points: 0.1, position: 31 }),
    ]);
    expect(table.map((s) => [s.id, s.points, s.rank])).toEqual([
      [2, 19, 1],
      [1, 18.5, 2],
      [3, 0.1, 3],
    ]);
    expect(table[0]!.wins).toBe(1);
  });

  it('breaks a tie with most wins, then most seconds, then the best last prelim time', () => {
    const wins = driverStandings([
      row({ driverId: 1, round: 1, points: 10, position: 1 }),
      row({ driverId: 1, round: 2, points: 5, position: 10 }),
      row({ driverId: 2, round: 1, points: 7.5, position: 5 }),
      row({ driverId: 2, round: 2, points: 7.5, position: 5 }),
    ]);
    expect(wins.map((s) => s.id)).toEqual([1, 2]);
    const seconds = driverStandings([
      row({ driverId: 1, round: 1, points: 9, position: 2 }),
      row({ driverId: 1, round: 2, points: 1, position: 20 }),
      row({ driverId: 2, round: 1, points: 5, position: 10 }),
      row({ driverId: 2, round: 2, points: 5, position: 10 }),
    ]);
    expect(seconds.map((s) => s.id)).toEqual([1, 2]);
    const time = driverStandings([
      row({ driverId: 1, round: 2, points: 5, position: 10, prelimTimeMs: 2000 }),
      row({ driverId: 2, round: 2, points: 5, position: 10, prelimTimeMs: 1500 }),
    ]);
    expect(time.map((s) => s.id)).toEqual([2, 1]);
  });

  it('always gives each driver one distinct rank from 1', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            driverId: fc.integer({ min: 1, max: 12 }),
            round: fc.integer({ min: 1, max: 6 }),
            points: fc.integer({ min: 0, max: 100 }).map((n) => n / 10),
            position: fc.integer({ min: 1, max: 31 }),
          }),
          { maxLength: 60 },
        ),
        (rows) => {
          const table = driverStandings(rows.map((r) => row(r)));
          expect(table.map((s) => s.rank)).toEqual(table.map((_, i) => i + 1));
          for (let i = 1; i < table.length; i++) {
            expect(table[i - 1]!.points).toBeGreaterThanOrEqual(table[i]!.points);
          }
        },
      ),
    );
  });
});

describe('the garage and manufacturer tables', () => {
  it('count only a garage’s best two results in a round', () => {
    const table = garageStandings([
      row({ garageId: 1, driverId: 1, points: 10 }),
      row({ garageId: 1, driverId: 2, points: 9 }),
      row({ garageId: 1, driverId: 3, points: 8 }),
      row({ garageId: 2, driverId: 4, points: 7 }),
    ]);
    expect(table.map((s) => [s.id, s.points])).toEqual([
      [1, 19],
      [2, 7],
    ]);
  });

  it('count a make’s best two cars in a round, across garages', () => {
    const table = manufacturerStandings([
      row({ manufacturerId: 5, garageId: 1, driverId: 1, points: 10 }),
      row({ manufacturerId: 5, garageId: 2, driverId: 2, points: 9 }),
      row({ manufacturerId: 5, garageId: 3, driverId: 3, points: 8 }),
      row({ manufacturerId: 6, garageId: 4, driverId: 4, points: 8.5 }),
    ]);
    expect(table.map((s) => [s.id, s.points])).toEqual([
      [5, 19],
      [6, 8.5],
    ]);
  });
});

describe('the nation tables', () => {
  it('count a flag’s best two drivers in a round', () => {
    const table = driverNationStandings([
      row({ driverFlag: 'JP', driverId: 1, points: 10 }),
      row({ driverFlag: 'JP', driverId: 2, points: 9 }),
      row({ driverFlag: 'JP', driverId: 3, points: 8 }),
      row({ driverFlag: 'AU', driverId: 4, points: 9.5 }),
    ]);
    expect(table.map((s) => [s.id, s.points])).toEqual([
      ['JP', 19],
      ['AU', 9.5],
    ]);
  });

  it('count a flag’s best two garages in a round, each garage scoring its best two', () => {
    const table = garageNationStandings([
      row({ garageFlag: 'GB', garageId: 1, driverId: 1, points: 10 }),
      row({ garageFlag: 'GB', garageId: 1, driverId: 2, points: 9 }),
      row({ garageFlag: 'GB', garageId: 2, driverId: 3, points: 8 }),
      row({ garageFlag: 'GB', garageId: 3, driverId: 4, points: 7 }),
      row({ garageFlag: 'AU', garageId: 4, driverId: 5, points: 6 }),
    ]);
    // GB: garage 1 scores 19, garage 2 scores 8, garage 3 scores 7: best two garages = 27.
    expect(table.map((s) => [s.id, s.points])).toEqual([
      ['GB', 27],
      ['AU', 6],
    ]);
  });

  it('are empty with no results', () => {
    expect(driverStandings([])).toEqual([]);
    expect(garageNationStandings([])).toEqual([]);
  });
});

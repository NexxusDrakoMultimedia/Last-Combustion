// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { nextFinalRound, playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function careerWithPrelims(seed = 'final-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  playPrelims(db, 1);
  return db;
}

describe('playing the final of a round', () => {
  let db: Database;
  let cashBefore: number;
  let kmBefore: number;
  let summary: ReturnType<typeof playFinal>;
  beforeAll(() => {
    db = careerWithPrelims();
    cashBefore = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    kmBefore = Number(scalar(db, 'SELECT SUM(race_km) FROM car'));
    expect(nextFinalRound(db)).toBe(1);
    summary = playFinal(db, 1);
  });

  it('classifies the fifteen qualifiers and marks the round complete', () => {
    expect(scalar(db, 'SELECT COUNT(*) FROM result WHERE final_pos IS NOT NULL')).toBe(15);
    expect(summary.finishers + summary.retirements).toBe(15);
    expect(summary.podium).toHaveLength(3);
    expect(summary.podium[0]!.position).toBe(1);
    expect(scalar(db, 'SELECT status FROM round WHERE number = 1')).toBe('complete');
    expect(nextFinalRound(db)).toBeNull();
  });

  it('pays prize money into garage cash and the ledger, and the amounts agree', () => {
    const prizes = Number(scalar(db, 'SELECT SUM(prize) FROM result'));
    const bonuses = Number(scalar(db, 'SELECT COALESCE(SUM(amount), 0) FROM season_bonus'));
    expect(prizes).toBeGreaterThan(0);
    const ledger = Number(scalar(db, 'SELECT SUM(amount) FROM ledger'));
    const cashAfter = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    expect(cashAfter - cashBefore).toBe(ledger);
    // Prize money is split by contract: the garage's part is in the ledger, the driver's in their earnings.
    const earnings = Number(scalar(db, 'SELECT SUM(earnings) FROM driver'));
    const garagePrizes = Number(
      scalar(db, "SELECT SUM(amount) FROM ledger WHERE category = 'prize'"),
    );
    expect(garagePrizes + earnings).toBe(prizes);
    expect(earnings).toBeGreaterThan(0);
    expect(garagePrizes).toBeGreaterThan(earnings);
    expect(bonuses).toBeGreaterThanOrEqual(0);
  });

  it('writes timing rows, final events and extra racing kilometres', () => {
    expect(Number(scalar(db, 'SELECT COUNT(*) FROM timing'))).toBeGreaterThan(15 * 10);
    expect(
      Number(scalar(db, "SELECT COUNT(*) FROM event_log WHERE scope = 'final'")),
    ).toBeGreaterThan(0);
    expect(Number(scalar(db, 'SELECT SUM(race_km) FROM car'))).toBeGreaterThan(kmBefore + 15 * 100);
  });

  it('keeps final results on the qualifiers only, with unique positions', () => {
    expect(
      scalar(db, 'SELECT COUNT(*) FROM result WHERE final_pos IS NOT NULL AND prelim_pos > 15'),
    ).toBe(0);
    expect(
      scalar(
        db,
        'SELECT COUNT(DISTINCT final_pos) = COUNT(final_pos) FROM result WHERE final_pos IS NOT NULL',
      ),
    ).toBe(1);
  });

  it('hands out gold borders, the winner’s trophy decals and titles at the flag', () => {
    expect(summary.goldBorders).toBe(15);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE gold_border_year IS NOT NULL')).toBe(15);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM driver WHERE gold_border_year IS NOT NULL AND gold_border_year <> 2031`,
      ),
    ).toBe(0);
    expect(scalar(db, "SELECT COUNT(*) FROM event_log WHERE type = 'gold_border'")).toBe(15);
    const winner = scalar(
      db,
      'SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    );
    const winnerCar = scalar(
      db,
      'SELECT e.car_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    );
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM trophy WHERE kind = 'win' AND owner_type = 'driver' AND owner_id = ${winner}`,
      ),
    ).toBe(1);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM trophy WHERE kind = 'win' AND owner_type = 'car' AND owner_id = ${winnerCar}`,
      ),
    ).toBe(1);
    expect(summary.titlesAwarded).toBeGreaterThan(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM driver_title WHERE driver_id = ${winner} AND title_id = 'race-winner'`,
      ),
    ).toBe(1);
  });

  it('gives a driver who reached the final again no second border or award', () => {
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE gold_border_year IS NOT NULL')).toBe(15);
  });

  it('cannot be run twice, or before the prelims', () => {
    expect(() => playFinal(db, 1)).toThrow();
    expect(() => playFinal(db, 2)).toThrow();
  });

  it('keeps the database consistent and survives a save and load', async () => {
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'final'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM result WHERE final_pos IS NOT NULL')).toBe(15);
  });
});

describe('repeatability', () => {
  it('gives the same result for the same seed', () => {
    const order = (db: Database) =>
      JSON.stringify(
        db.exec(
          'SELECT entry_id, final_pos FROM result WHERE final_pos IS NOT NULL ORDER BY final_pos',
        )[0]!.values,
      );
    const a = careerWithPrelims('same');
    const b = careerWithPrelims('same');
    playFinal(a, 1);
    playFinal(b, 1);
    expect(order(a)).toBe(order(b));
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { computeStandings, endSeason } from '../../src/db/season';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

function playSeason(db: Database, rounds = 6): void {
  for (let n = 1; n <= rounds; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
}

describe('standings through a season', () => {
  let db: Database;
  let end: ReturnType<typeof endSeason>;
  let cashBefore: number;
  let earningsBefore: number;
  let bonuses: number;
  beforeAll(() => {
    db = newCareer('season-db');
    playSeason(db);
    cashBefore = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    earningsBefore = Number(scalar(db, 'SELECT SUM(earnings) FROM driver'));
    bonuses = Number(
      scalar(db, 'SELECT COALESCE(SUM(amount), 0) FROM season_bonus WHERE paid = 0'),
    );
    end = endSeason(db);
  }, 120_000);

  it('ranks every entry and adds up to the points that were awarded', () => {
    const tables = computeStandings(db, 1);
    expect(tables.drivers).toHaveLength(313);
    expect(tables.drivers[0]!.rank).toBe(1);
    const total = tables.drivers.reduce((s, d) => s + d.points, 0);
    expect(total).toBeCloseTo(Number(scalar(db, 'SELECT SUM(points) FROM result')), 5);
    expect(tables.garages.length).toBeGreaterThan(50);
    expect(tables.manufacturers.length).toBeGreaterThan(10);
    expect(tables.driverNations.length).toBeGreaterThan(1);
    expect(tables.garageNations.length).toBeGreaterThan(1);
  });

  it('crowns the points leader, pays the prize and the bonuses, and closes the season', () => {
    const tables = computeStandings(db, 1);
    expect(end.championDriverId).toBe(tables.drivers[0]!.id);
    expect(end.prizePaid).toBe(10_000_000);
    expect(end.bonusesPaid).toBe(bonuses);
    expect(Number(scalar(db, 'SELECT SUM(cash) FROM garage'))).toBe(
      cashBefore +
        10_000_000 +
        bonuses +
        Number(scalar(db, "SELECT SUM(amount) FROM ledger WHERE category = 'merchandise'")) -
        (Number(scalar(db, 'SELECT SUM(earnings) FROM driver')) - earningsBefore),
    );
    // The champion's garage and the champion share the prize by contract: the garage keeps a share, never all of it.
    expect(Number(scalar(db, 'SELECT SUM(earnings) FROM driver')) - earningsBefore).toBeGreaterThan(
      0,
    );
    expect(scalar(db, 'SELECT status FROM season')).toBe('complete');
    expect(scalar(db, 'SELECT champion_driver_id FROM season')).toBe(end.championDriverId);
    expect(scalar(db, 'SELECT COUNT(*) FROM season_bonus WHERE paid = 0')).toBe(0);
  });

  it('left the gold borders, win decals and prizes to each race, and adds only the shield decals', () => {
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM driver WHERE gold_border_year IS NULL AND id IN
           (SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos IS NOT NULL)`,
      ),
    ).toBe(0);
    expect(scalar(db, "SELECT COUNT(*) FROM trophy WHERE kind = 'win'")).toBe(12);
    expect(scalar(db, "SELECT COUNT(*) FROM trophy WHERE kind = 'title'")).toBe(2);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM trophy WHERE kind = 'title' AND owner_type = 'driver' AND owner_id = ${end.championDriverId}`,
      ),
    ).toBe(1);
  });

  it('saves the final tables, and cannot be run twice', () => {
    expect(scalar(db, "SELECT COUNT(*) FROM standing_snapshot WHERE table_kind = 'driver'")).toBe(
      313,
    );
    expect(
      scalar(
        db,
        "SELECT position FROM standing_snapshot WHERE table_kind = 'driver' AND subject = '" +
          String(end.championDriverId) +
          "'",
      ),
    ).toBe(1);
    expect(() => endSeason(db)).toThrow(/already ended/);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('survives a save and load', async () => {
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'season'));
    expect(scalar(loaded, 'SELECT champion_garage_id FROM season')).toBe(end.championGarageId);
  });
});

describe('ending a season too early', () => {
  it('refuses until every round is complete', () => {
    const db = newCareer('early');
    expect(() => endSeason(db)).toThrow(/not complete/);
    playPrelims(db, 1);
    playFinal(db, 1);
    expect(() => endSeason(db)).toThrow(/Round 2 is not complete/);
  });
});

describe('the garage champion and the garage of the drivers’ champion', () => {
  let db: Database;
  let end: ReturnType<typeof endSeason>;
  beforeAll(() => {
    // Most seeds give a season where the drivers' champion does not drive for the Garage
    // Championship winner; use the first one that does.
    for (const seed of ['g1', 'g3', 'g4', 'g5', 'g6', 'g7']) {
      db = newCareer(seed);
      playSeason(db);
      end = endSeason(db);
      if (end.championGarageId !== end.championDriverGarageId) break;
    }
  }, 240_000);

  it('records the Garage Championship winner from the garage table, apart from the drivers’ champion’s garage', () => {
    expect(end.championGarageId).not.toBe(end.championDriverGarageId);
    expect(scalar(db, 'SELECT champion_garage_id FROM season')).toBe(end.championGarageId);
    expect(scalar(db, 'SELECT champion_driver_garage_id FROM season')).toBe(
      end.championDriverGarageId,
    );
    expect(
      Number(
        scalar(
          db,
          "SELECT subject FROM standing_snapshot WHERE table_kind = 'garage' AND position = 1",
        ),
      ),
    ).toBe(end.championGarageId);
    expect(
      scalar(
        db,
        `SELECT garage_id FROM entry WHERE driver_id = ${end.championDriverId} AND series = 'main' AND season_id = 1`,
      ),
    ).toBe(end.championDriverGarageId);
  });

  it('pays the champion’s prize to the drivers’ champion’s garage', () => {
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM ledger WHERE category = 'championship_prize' AND garage_id = ${end.championDriverGarageId}`,
      ),
    ).toBe(1);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM ledger WHERE category = 'championship_prize' AND garage_id = ${end.championGarageId}`,
      ),
    ).toBe(0);
  });
});

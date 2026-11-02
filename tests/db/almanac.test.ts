// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { almanac, closeGarage, retireDriver } from '../../src/db/almanac';
import { createCareer } from '../../src/db/career';
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

function newCareer(seed = 'almanac-db'): Database {
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

describe('before anyone has scored', () => {
  it('lists everyone as a line: no points, the year they started, and no end year while active', () => {
    const db = newCareer();
    const book = almanac(db);
    expect(book.drivers).toHaveLength(313);
    expect(book.garages).toHaveLength(96);
    for (const e of [...book.drivers, ...book.garages]) {
      expect(e.points).toBe(0);
      expect(e.stats).toBeNull();
      expect(e.yearEnded).toBeNull();
    }
    expect(book.drivers.every((d) => d.yearStarted === 2031)).toBe(true);
  });

  it('does not list the hidden market garage', () => {
    const db = newCareer();
    db.run(
      "INSERT INTO garage (name, flag, base_place_id, home_state, primary_colour, secondary_colour, prestige, cash, founded_year, is_player, ai_profile, fans, kind) VALUES ('Used car market', 'AU', 1, 'NSW', '#000000', '#000000', 1, 0, 2031, 0, 'cautious', 0, 'market')",
    );
    expect(almanac(db).garages).toHaveLength(96);
  });
});

describe('after a round', () => {
  let db: Database;
  beforeAll(() => {
    db = newCareer();
    playPrelims(db, 1);
  });

  it('gives every driver and garage that scored full figures, and everyone else a line', () => {
    const book = almanac(db);
    const scorers = Number(
      scalar(
        db,
        'SELECT COUNT(DISTINCT e.driver_id) FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0',
      ),
    );
    expect(scorers).toBe(16);
    expect(book.drivers).toHaveLength(313);
    const full = book.drivers.filter((d) => d.stats !== null);
    expect(full).toHaveLength(scorers);
    expect(book.drivers.filter((d) => d.stats === null).every((d) => d.points === 0)).toBe(true);
    for (const d of full) {
      expect(d.points).toBeGreaterThan(0);
      expect(d.stats).not.toBeNull();
      expect(d.stats!.superPoints).toBe(d.points);
      expect(d.stats!.juniorPoints).toBe(0);
      expect(d.stats!.seasons).toBe(1);
      expect(d.stats!.firstScoringYear).toBe(2031);
      expect(d.yearStarted).toBe(2031);
      expect(d.yearEnded).toBeNull();
    }
    expect(book.garages).toHaveLength(96);
    expect(book.garages.filter((g) => g.stats !== null).every((g) => g.points > 0)).toBe(true);
    expect(book.garages.filter((g) => g.stats !== null).length).toBeGreaterThan(0);
  });

  it('shows an active driver who has not scored as a line with no end year', () => {
    const idle = Number(
      scalar(
        db,
        'SELECT e.driver_id FROM entry e JOIN result r ON r.entry_id = e.id GROUP BY e.driver_id HAVING SUM(r.points) = 0 LIMIT 1',
      ),
    );
    const entry = almanac(db).drivers.find((d) => d.id === idle)!;
    expect(entry).toMatchObject({ points: 0, stats: null, yearStarted: 2031, yearEnded: null });
  });

  it('gives one who retired without ever scoring the same line with an end year', () => {
    const idle = Number(
      scalar(
        db,
        'SELECT e.driver_id FROM entry e JOIN result r ON r.entry_id = e.id GROUP BY e.driver_id HAVING SUM(r.points) = 0 LIMIT 1',
      ),
    );
    retireDriver(db, idle, 2033);
    const entry = almanac(db).drivers.find((d) => d.id === idle)!;
    expect(entry).toMatchObject({
      kind: 'driver',
      points: 0,
      stats: null,
      yearStarted: 2031,
      yearEnded: 2033,
    });
  });

  it('keeps full figures for one who scored and then retired', () => {
    const scorer = almanac(db).drivers.find((d) => d.stats !== null)!;
    retireDriver(db, scorer.id, 2035);
    const entry = almanac(db).drivers.find((d) => d.id === scorer.id)!;
    expect(entry.yearEnded).toBe(2035);
    expect(entry.stats).not.toBeNull();
    expect(entry.points).toBe(scorer.points);
  });

  it('does the same for a garage that stopped operating', () => {
    const idleGarage = Number(
      scalar(
        db,
        "SELECT g.id FROM garage g WHERE g.kind = 'racing' AND g.id NOT IN (SELECT e.garage_id FROM entry e JOIN result r ON r.entry_id = e.id WHERE r.points > 0) LIMIT 1",
      ),
    );
    closeGarage(db, idleGarage, 2034);
    const entry = almanac(db).garages.find((g) => g.id === idleGarage)!;
    expect(entry).toMatchObject({ kind: 'garage', points: 0, stats: null, yearEnded: 2034 });
    expect(entry.yearStarted).toBe(
      Number(scalar(db, `SELECT founded_year FROM garage WHERE id = ${idleGarage}`)),
    );
  });

  it('rejects an unknown driver or garage', () => {
    expect(() => retireDriver(db, 9999, 2040)).toThrow(/no driver/);
    expect(() => closeGarage(db, 9999, 2040)).toThrow(/no racing garage/);
  });

  it('counts Junior points separately from Super Series points', () => {
    const scorer = almanac(db).drivers.find((d) => d.stats !== null)!;
    const row = db.exec(
      `SELECT e.garage_id, e.car_id, r.round_id FROM entry e JOIN result r ON r.entry_id = e.id WHERE e.driver_id = ${scorer.id} LIMIT 1`,
    )[0]!.values[0] as [number, number, number];
    db.run(
      "INSERT INTO entry (season_id, garage_id, driver_id, car_id, race_number, series) VALUES (1, ?, ?, ?, 900, 'junior')",
      [row[0], scorer.id, row[1]],
    );
    const entryId = Number(scalar(db, "SELECT id FROM entry WHERE series = 'junior'"));
    db.run('INSERT INTO result (round_id, entry_id, points) VALUES (?, ?, 3)', [row[2], entryId]);
    const after = almanac(db).drivers.find((d) => d.id === scorer.id)!;
    expect(after.stats!.juniorPoints).toBe(3);
    expect(after.stats!.superPoints).toBe(scorer.stats!.superPoints);
    expect(after.points).toBe(Math.round((scorer.points + 3) * 10) / 10);
  });

  it('survives a save and load', async () => {
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'almanac'));
    expect(almanac(loaded).drivers.length).toBe(almanac(db).drivers.length);
  });
});

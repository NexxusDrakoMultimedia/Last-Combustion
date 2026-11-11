// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { driverRivalryMultiplier, updateRivalries } from '../../src/db/rivalries';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const insertRivalry = (db: Database, a: number, b: number) =>
  db.run(
    `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
     VALUES (?, ?, 40, 40, 'spark', 1, 2031)`,
    [a, b],
  );

describe('rivalry tables', () => {
  it('exist in a fresh database', () => {
    const db = createNewDatabase(SQL);
    const names = db
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'rivalry%'")[0]!
      .values.map((v) => v[0]);
    expect(names).toEqual(expect.arrayContaining(['rivalry', 'rivalry_meeting']));
  });

  it('keep the lower driver id first', () => {
    const db = createNewDatabase(SQL);
    expect(() => insertRivalry(db, 5, 3)).toThrow(/CHECK constraint/);
  });

  it('allow one open rivalry for a pair', () => {
    const db = createNewDatabase(SQL);
    insertRivalry(db, 3, 5);
    expect(() => insertRivalry(db, 3, 5)).toThrow(/UNIQUE constraint/);
    db.run("UPDATE rivalry SET ended_year = 2032, end_reason = 'cooled'");
    expect(() => insertRivalry(db, 3, 5)).not.toThrow();
  });
});

const rows = (db: Database, sql: string): unknown[][] => db.exec(sql)[0]?.values ?? [];

/** A world with the first rounds played. */
function playedWorld(seed: string, rounds = 1): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  for (let n = 1; n <= rounds; n++) {
    playPrelims(db, n);
    playFinal(db, n);
  }
  return db;
}

/** Clears every rivalry so a test can set the scene itself. */
const clear = (db: Database) =>
  db.exec(
    "DELETE FROM rivalry_meeting; DELETE FROM rivalry; DELETE FROM event_log WHERE type = 'rivalry_update'",
  );

/** The driver who finished in a place in a round's final. */
const driverAt = (db: Database, roundId: number, pos: number): number =>
  rows(
    db,
    `SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id
      WHERE r.round_id = ${roundId} AND r.final_pos = ${pos}`,
  )[0]![0] as number;

const setTime = (db: Database, roundId: number, pos: number, ms: number | null) =>
  db.run('UPDATE result SET final_time_ms = ? WHERE round_id = ? AND final_pos = ?', [
    ms,
    roundId,
    pos,
  ]);

/** Spaces every finisher 5 s apart, so only the pairs a test sets close are close. */
const spread = (db: Database, roundId: number) =>
  db.run(
    'UPDATE result SET final_time_ms = 100000 + final_pos * 5000 WHERE round_id = ? AND final_pos IS NOT NULL',
    [roundId],
  );

const pairKey = (x: number, y: number) => [Math.min(x, y), Math.max(x, y)];

const addRivalry = (db: Database, x: number, y: number, heat: number, live: number) =>
  db.run(
    `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
     VALUES (?, ?, ?, ?, 'spark', ?, 2031)`,
    [Math.min(x, y), Math.max(x, y), heat, heat, live],
  );

const driverIds = (db: Database, n: number) =>
  rows(db, `SELECT id FROM driver ORDER BY id LIMIT ${n}`).map((r) => r[0] as number);

describe('a round of rivalries', () => {
  it('starts a rivalry from a close finish', () => {
    const db = playedWorld('rival-close');
    clear(db);
    spread(db, 1);
    setTime(db, 1, 1, 100_000);
    setTime(db, 1, 2, 100_400);
    setTime(db, 1, 3, 101_000);
    updateRivalries(db, 1);
    const pair = pairKey(driverAt(db, 1, 1), driverAt(db, 1, 2));
    expect(rows(db, 'SELECT driver_a, driver_b, heat, live, level FROM rivalry')).toEqual([
      [...pair, 8, 0, 'none'],
    ]);
    expect(rows(db, 'SELECT kind, gain FROM rivalry_meeting')).toEqual([['close_finish', 8]]);
  });

  it('does nothing the second time for the same round', () => {
    const db = playedWorld('rival-twice');
    clear(db);
    spread(db, 1);
    setTime(db, 1, 1, 100_000);
    setTime(db, 1, 2, 100_300);
    updateRivalries(db, 1);
    const dump = () =>
      JSON.stringify([
        rows(db, 'SELECT * FROM rivalry'),
        rows(db, 'SELECT * FROM rivalry_meeting'),
      ]);
    const once = dump();
    updateRivalries(db, 1);
    expect(dump()).toBe(once);
  });

  it('never counts a driver with no final time as a close finish', () => {
    const db = playedWorld('rival-dnf');
    clear(db);
    spread(db, 1);
    setTime(db, 1, 1, 100_000);
    setTime(db, 1, 2, null);
    setTime(db, 1, 3, 100_100);
    updateRivalries(db, 1);
    expect(rows(db, 'SELECT * FROM rivalry_meeting')).toEqual([]);
  });

  it('adds no title-fight heat in the first round of a season', () => {
    const db = playedWorld('rival-first');
    expect(rows(db, "SELECT * FROM rivalry_meeting WHERE kind = 'title_fight'")).toEqual([]);
  });

  it('heats the title leaders when both race the final', () => {
    const db = playedWorld('rival-title', 2);
    clear(db);
    spread(db, 2);
    const first = driverAt(db, 2, 3);
    const second = driverAt(db, 2, 4);
    db.run('UPDATE result SET points = 500 WHERE round_id = 2 AND final_pos = 3');
    db.run('UPDATE result SET points = 400 WHERE round_id = 2 AND final_pos = 4');
    updateRivalries(db, 2);
    expect(rows(db, 'SELECT driver_a, driver_b FROM rivalry WHERE heat = 10')).toEqual([
      pairKey(first, second),
    ]);
    expect(rows(db, "SELECT kind FROM rivalry_meeting WHERE kind = 'title_fight'")).toHaveLength(1);
  });

  it('ends the rivalries of a driver who has retired', () => {
    const db = playedWorld('rival-retire');
    clear(db);
    spread(db, 1);
    const x = driverAt(db, 1, 1);
    addRivalry(db, x, driverAt(db, 1, 2), 50, 1);
    db.run('UPDATE driver SET retired_year = 2031 WHERE id = ?', [x]);
    updateRivalries(db, 1);
    expect(rows(db, 'SELECT ended_year, end_reason FROM rivalry')).toEqual([[2031, 'retired']]);
  });

  it('cools a rivalry that falls under ten and keeps a hotter one', () => {
    const db = playedWorld('rival-cool');
    clear(db);
    spread(db, 1);
    const ids = driverIds(db, 5);
    addRivalry(db, ids[0]!, ids[1]!, 10, 1);
    addRivalry(db, ids[2]!, ids[3]!, 40, 1);
    updateRivalries(db, 1);
    expect(rows(db, 'SELECT heat, end_reason FROM rivalry ORDER BY id')).toEqual([
      [9, 'cooled'],
      [36, null],
    ]);
  });
});

describe('the cap on live rivalries', () => {
  const setup = (seed: string, candidateHeat: number) => {
    const db = playedWorld(seed);
    clear(db);
    spread(db, 1);
    const ids = driverIds(db, 6);
    addRivalry(db, ids[0]!, ids[1]!, 40, 1);
    addRivalry(db, ids[0]!, ids[2]!, 50, 1);
    addRivalry(db, ids[0]!, ids[3]!, 60, 1);
    addRivalry(db, ids[0]!, ids[4]!, candidateHeat, 0);
    return db;
  };
  const live = (db: Database) =>
    rows(db, 'SELECT heat FROM rivalry WHERE live = 1 AND ended_year IS NULL ORDER BY heat').map(
      (r) => r[0] as number,
    );

  it('refuses a cooler newcomer and holds it under Spark', () => {
    const db = setup('cap-refuse', 37);
    updateRivalries(db, 1);
    expect(live(db)).toHaveLength(3);
    expect(rows(db, 'SELECT heat FROM rivalry WHERE live = 0')).toEqual([[29]]);
  });

  it('lets a hotter newcomer displace the coolest', () => {
    const db = setup('cap-displace', 80);
    updateRivalries(db, 1);
    expect(live(db)).toEqual([45, 54, 72]);
    expect(rows(db, 'SELECT end_reason FROM rivalry WHERE end_reason IS NOT NULL')).toEqual([
      ['displaced'],
    ]);
  });
});

describe('rivalries from played finals', () => {
  it('are the same for the same seed', () => {
    const dump = (db: Database) =>
      JSON.stringify([
        rows(db, 'SELECT * FROM rivalry'),
        rows(db, 'SELECT * FROM rivalry_meeting'),
      ]);
    expect(dump(playedWorld('rival-same', 2))).toBe(dump(playedWorld('rival-same', 2)));
  });

  it('never leave a driver with more than three live rivalries', () => {
    const db = playedWorld('rival-cap-play', 3);
    const counts = rows(
      db,
      `SELECT d, COUNT(*) FROM (
         SELECT driver_a AS d FROM rivalry WHERE live = 1 AND ended_year IS NULL
         UNION ALL SELECT driver_b FROM rivalry WHERE live = 1 AND ended_year IS NULL
       ) GROUP BY d`,
    );
    for (const [, n] of counts) expect(n as number).toBeLessThanOrEqual(3);
  });
});

describe('the fans a rivalry draws', () => {
  const addLevel = (db: Database, x: number, y: number, level: string) =>
    db.run(
      `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
       VALUES (?, ?, 70, 70, ?, 1, 2031)`,
      [Math.min(x, y), Math.max(x, y), level],
    );

  it('multiplies by the hottest live rivalry whose rival is in the final', () => {
    const db = createNewDatabase(SQL);
    addLevel(db, 1, 2, 'rivalry');
    expect(driverRivalryMultiplier(db, 1, new Set([1, 2]))).toBe(1.25);
    expect(driverRivalryMultiplier(db, 2, new Set([1, 2]))).toBe(1.25);
    expect(driverRivalryMultiplier(db, 1, new Set([1, 3]))).toBe(1);
    addLevel(db, 1, 3, 'spark');
    addLevel(db, 1, 4, 'feud');
    expect(driverRivalryMultiplier(db, 1, new Set([1, 3]))).toBe(1.1);
    expect(driverRivalryMultiplier(db, 1, new Set([1, 2, 3, 4]))).toBe(1.5);
  });

  it('ignores a rivalry that has ended or is not live yet', () => {
    const db = createNewDatabase(SQL);
    addLevel(db, 1, 2, 'feud');
    db.run("UPDATE rivalry SET ended_year = 2031, end_reason = 'cooled'");
    addLevel(db, 1, 3, 'feud');
    db.run('UPDATE rivalry SET live = 0 WHERE driver_b = 3');
    expect(driverRivalryMultiplier(db, 1, new Set([1, 2, 3]))).toBe(1);
  });

  it('lifts what the winner gains in a final the rival also races', () => {
    const gained = (db: Database, driver: number) =>
      rows(
        db,
        `SELECT gained FROM driver_season_fans WHERE driver_id = ${driver}`,
      )[0]![0] as number;
    const plain = playedWorld('rival-fans');
    const winner = driverAt(plain, 1, 1);
    const second = driverAt(plain, 1, 2);

    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'rival-fans',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('rival-fans'));
    playPrelims(db, 1);
    addLevel(db, winner, second, 'feud');
    playFinal(db, 1);
    expect(gained(db, winner)).toBeGreaterThan(gained(plain, winner));
  });
});

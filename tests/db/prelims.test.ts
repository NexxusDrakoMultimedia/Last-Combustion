// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
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

function newCareer(seed = 'prelim-db'): Database {
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

describe('playing the prelims of a round', () => {
  let db: Database;
  let before: number;
  let summary: ReturnType<typeof playPrelims>;
  beforeAll(() => {
    db = newCareer();
    before = Number(scalar(db, 'SELECT SUM(race_km) FROM car'));
    summary = playPrelims(db, 1);
  });

  it('classifies all 313 entries and qualifies 15', () => {
    expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(313);
    expect(summary.qualifiers).toBe(15);
    expect(summary.finishers + summary.dnfs).toBe(313);
    expect(summary.top).toHaveLength(5);
    expect(summary.top[0]!.position).toBe(1);
    expect(summary.top[0]!.timeMs).toBeLessThan(summary.top[4]!.timeMs);
  });

  it('holds exactly 7 prelim days, pushes the final back after any gap days, and marks the round done', () => {
    expect(summary.prelimDays).toBe(7);
    const row = db.exec('SELECT final_date, status, weather_log FROM round WHERE number = 1')[0]!
      .values[0]!;
    expect(row[0]).toBe(summary.finalDate);
    expect(row[1]).toBe('prelims_done');
    const days = JSON.parse(row[2] as string) as { kind: string }[];
    expect(days.filter((d) => d.kind === 'prelim')).toHaveLength(7);
    expect(days).toHaveLength(14 + summary.gapDays);
  });

  it('awards prelim points only to 16th to 31st, and one pole', () => {
    expect(scalar(db, 'SELECT COUNT(*) FROM result WHERE points > 0')).toBe(16);
    expect(Number(scalar(db, 'SELECT SUM(points) FROM result'))).toBeCloseTo(14, 5);
    expect(scalar(db, 'SELECT COUNT(*) FROM result WHERE pole = 1')).toBe(1);
    expect(scalar(db, 'SELECT COUNT(*) FROM result WHERE points > 0 AND prelim_pos <= 15')).toBe(0);
  });

  it('logs practice and prelim events', () => {
    expect(
      Number(scalar(db, "SELECT COUNT(*) FROM event_log WHERE scope = 'practice'")),
    ).toBeGreaterThan(0);
    expect(scalar(db, "SELECT COUNT(*) FROM event_log WHERE type = 'pole'")).toBe(1);
  });

  it('adds racing kilometres and wear to the cars', () => {
    const after = Number(scalar(db, 'SELECT SUM(race_km) FROM car'));
    expect(after).toBeGreaterThan(before + 313 * 40);
    expect(scalar(db, 'SELECT COUNT(*) FROM car WHERE race_km > 0 AND wear < 0')).toBe(0);
    expect(
      Number(scalar(db, 'SELECT MIN(race_km) FROM car WHERE id IN (SELECT car_id FROM entry)')),
    ).toBeGreaterThan(0);
  });

  it('cannot be run twice, and a missing round is reported', () => {
    expect(() => playPrelims(db, 1)).toThrow(/already been run/);
    expect(() => playPrelims(db, 9)).toThrow(/no round 9/);
  });

  it('keeps the database consistent and survives a save and load', async () => {
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'prelims'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM result')).toBe(313);
  });
});

describe('repeatability', () => {
  it('gives the same results for the same career seed and different ones otherwise', () => {
    const top = (db: Database) =>
      JSON.stringify(
        db.exec('SELECT entry_id, prelim_time_ms FROM result ORDER BY entry_id')[0]!.values,
      );
    const a = newCareer('same');
    const b = newCareer('same');
    const c = newCareer('other');
    playPrelims(a, 1);
    playPrelims(b, 1);
    playPrelims(c, 1);
    expect(top(a)).toBe(top(b));
    expect(top(a)).not.toBe(top(c));
  });

  it('runs every round of the season in order', () => {
    const db = newCareer('season');
    for (let n = 1; n <= 6; n++) expect(playPrelims(db, n).prelimDays).toBe(7);
    expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(313 * 6);
    const finals = db
      .exec('SELECT final_date FROM round ORDER BY number')[0]!
      .values.map((v) => v[0] as string);
    expect([...finals].sort()).toEqual(finals);
  });
});

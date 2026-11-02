// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { applyVyktory, applyWorldChanges, currentFlagName } from '../../src/db/worldchanges';
import { persistWorld } from '../../src/db/world';
import { planWorldChanges, worldChangeData } from '../../src/sim/worldchanges';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function career(seed: string): Database {
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

/** A seed where Scotland and Northern Ireland both leave, so the whole chain can run. */
function findSeed(): string {
  for (let i = 0; i < 500; i++) {
    const plan = planWorldChanges(`uk-${i}`);
    if (
      plan.get('scotland') != null &&
      plan.get('northern-ireland') != null &&
      plan.get('wales') != null
    )
      return `uk-${i}`;
  }
  throw new Error('no seed found');
}

describe('applying world changes', () => {
  it('does nothing before the planned years', () => {
    const db = career('early');
    expect(applyWorldChanges(db, 2032)).toEqual([]);
    expect(scalar(db, 'SELECT COUNT(*) FROM world_event')).toBe(0);
  });

  it('moves people to the new flags, renames them and ends the United Kingdom', () => {
    const seed = findSeed();
    const db = career(seed);
    const before = Number(scalar(db, "SELECT COUNT(*) FROM driver WHERE flag = 'GB'"));
    expect(before).toBeGreaterThan(0);
    const applied = applyWorldChanges(db, worldChangeData.windowEnd);
    const ids = applied.map((a) => a.id);
    expect(ids).toContain('wales');
    expect(ids.indexOf('wales')).toBeGreaterThan(ids.indexOf('scotland'));
    expect(scalar(db, "SELECT COUNT(*) FROM driver WHERE flag = 'GB'")).toBe(0);
    expect(scalar(db, "SELECT COUNT(*) FROM garage WHERE flag = 'GB'")).toBe(0);
    expect(currentFlagName(db, 'gb-sct')).toEqual({
      short: 'Scotland',
      long: 'Republic of Scotland',
    });
    expect(currentFlagName(db, 'gb-wls').long).toBe('Principality of Wales');
    expect(currentFlagName(db, 'gb-eng').long).toBe('Kingdom of England');
    expect(applyWorldChanges(db, worldChangeData.windowEnd)).toEqual([]);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('gives an unchanged flag its original name', () => {
    expect(currentFlagName(career('names'), 'AU')).toEqual({
      short: 'Australia',
      long: 'Commonwealth of Australia',
    });
  });
});

describe('the hidden drivers and Vyktory', () => {
  it('seats twelve hidden drivers with maximum potential, and moves them to the Vyktory flag with the rename', () => {
    const db = career('hidden');
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE easter_egg = 1')).toBe(12);
    expect(scalar(db, 'SELECT MIN(potential) FROM driver WHERE easter_egg = 1')).toBe(99);
    expect(
      scalar(db, "SELECT COUNT(*) FROM driver WHERE easter_egg = 1 AND flag <> 'AU'"),
    ).toBeGreaterThan(5);
    expect(scalar(db, 'SELECT COUNT(DISTINCT identity) FROM driver WHERE easter_egg = 1')).toBe(3);
    const change = applyVyktory(db, 2032);
    expect(change.drivers).toBe(12);
    expect(scalar(db, "SELECT COUNT(*) FROM driver WHERE easter_egg = 1 AND flag = 'AU'")).toBe(12);
    expect(currentFlagName(db, 'AU')).toEqual({
      short: 'Vyktory',
      long: 'Commonwealth of Vyktory',
    });
  });
});

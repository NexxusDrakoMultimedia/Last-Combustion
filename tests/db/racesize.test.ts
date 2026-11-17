// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { startFinal, stepFinal } from '../../src/db/final';
import { startPrelims } from '../../src/db/prelims';
import { stepPrelims } from '../../src/db/raceday';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const sizeOfSaves = (db: Database): number =>
  Number(
    db.exec('SELECT COALESCE(SUM(LENGTH(input) + LENGTH(state)), 0) FROM race_state')[0]!
      .values[0]![0],
  );

describe('how much a race under way adds to a save', () => {
  it('stays small: the prelims of 313 entries and a final of 15 each under a few hundred kilobytes', () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'race-size',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('race-size'));
    startPrelims(db, 1);
    stepPrelims(db, 1, 'day');
    const prelims = sizeOfSaves(db);
    expect(prelims).toBeLessThan(800_000);
    stepPrelims(db, 1, 'end');
    startFinal(db, 1);
    stepFinal(db, 1, 40);
    const final = sizeOfSaves(db);
    expect(final).toBeLessThan(400_000);
  }, 120_000);
});

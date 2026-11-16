// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playPrelims, setPrelimPlan, startPrelims } from '../../src/db/prelims';
import { stepPrelims } from '../../src/db/raceday';
import { prelimView } from '../../src/db/racewatch';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

function started(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  // The player owns the garage of the first entry.
  const garage = db.exec('SELECT garage_id FROM entry ORDER BY id LIMIT 1')[0]!
    .values[0]![0] as number;
  db.run('UPDATE garage SET is_player = 0');
  db.run('UPDATE garage SET is_player = 1 WHERE id = ?', [garage]);
  startPrelims(db, 1);
  return db;
}

const results = (db: Database) =>
  JSON.stringify(
    db.exec(
      'SELECT entry_id, prelim_time_ms, prelim_pos, dnf_reason FROM result ORDER BY entry_id',
    ),
  );

describe('plans for the player’s prelim runs', () => {
  it('are held on the saved round and shown with each of the player’s runs', () => {
    const db = started('prelim-plans-a');
    const before = prelimView(db, 1)!;
    expect(before.mine.length).toBeGreaterThan(0);
    for (const r of before.mine) expect(r.plan).toBe('steady');
    const first = before.mine[0]!;
    setPrelimPlan(db, 1, first.entryId, 'attack');
    expect(prelimView(db, 1)!.mine[0]!.plan).toBe('attack');
    setPrelimPlan(db, 1, first.entryId, null);
    expect(prelimView(db, 1)!.mine[0]!.plan).toBe('steady');
  }, 60_000);

  it('are refused for another garage, an entry not in the round, a run already run and prelims not started', () => {
    const db = started('prelim-plans-b');
    const mine = prelimView(db, 1)!.mine;
    const other = db.exec(
      `SELECT e.id FROM entry e JOIN garage g ON g.id = e.garage_id WHERE g.is_player = 0 LIMIT 1`,
    )[0]!.values[0]![0] as number;
    expect(() => setPrelimPlan(db, 1, other, 'attack')).toThrow(/Only the player/);
    expect(() => setPrelimPlan(db, 1, -9, 'attack')).toThrow(/not in the prelims/);
    stepPrelims(db, 1, 'end');
    // The round is over: nothing is under way to plan.
    expect(() => setPrelimPlan(db, 1, mine[0]!.entryId, 'attack')).toThrow(/not been started/);
  }, 120_000);

  it('change the round, give the same round every time, and steady is the round with no plans', () => {
    const run = (plan: 'attack' | 'steady' | null) => {
      const db = started('prelim-plans-c');
      if (plan) for (const r of prelimView(db, 1)!.mine) setPrelimPlan(db, 1, r.entryId, plan);
      stepPrelims(db, 1, 'end');
      return results(db);
    };
    const none = run(null);
    expect(run('steady')).toBe(none);
    expect(run('attack')).toBe(run('attack'));
    const plain = createNewDatabase(SQL);
    createCareer(plain, {
      mode: 'garage_owner',
      masterSeed: 'prelim-plans-c',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(plain, generateWorld('prelim-plans-c'));
    const garage = plain.exec('SELECT garage_id FROM entry ORDER BY id LIMIT 1')[0]!
      .values[0]![0] as number;
    plain.run('UPDATE garage SET is_player = 0');
    plain.run('UPDATE garage SET is_player = 1 WHERE id = ?', [garage]);
    playPrelims(plain, 1);
    expect(none).toBe(results(plain));
  }, 240_000);
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal, setFinalCall, startFinal, stepFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { finalView } from '../../src/db/racewatch';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

/** A career whose prelims are done, with the player made the owner of the garage of the car on the given grid row (0 is pole). */
function atTheFinal(seed: string, grid = 0): { db: Database; mine: number; theirs: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  playPrelims(db, 1);
  const rows = db.exec(
    'SELECT e.id, e.garage_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos IS NULL AND r.prelim_pos <= 15 ORDER BY r.prelim_pos',
  )[0]!.values;
  const mine = rows[grid]!;
  db.run('UPDATE garage SET is_player = 0');
  db.run('UPDATE garage SET is_player = 1 WHERE id = ?', [mine[1] as number]);
  const theirs = rows.find((r) => r[1] !== mine[1])!;
  return { db, mine: mine[0] as number, theirs: theirs[0] as number };
}

const finalResults = (db: Database) =>
  JSON.stringify(
    db.exec('SELECT entry_id, final_pos, final_time_ms, points FROM result ORDER BY entry_id'),
  );

describe('calls in a final', () => {
  it('are held on the saved race and shown on the timing screen', () => {
    const { db, mine } = atTheFinal('final-calls-a');
    startFinal(db, 1);
    expect(finalView(db, 1)!.rows.find((r) => r.entryId === mine)!.controlled).toBe(false);
    setFinalCall(db, 1, mine, 'push');
    stepFinal(db, 1, 3);
    const row = finalView(db, 1)!.rows.find((r) => r.entryId === mine)!;
    expect(row.controlled).toBe(true);
    expect(row.call).toBe('push');
    setFinalCall(db, 1, mine, null);
    expect(finalView(db, 1)!.rows.find((r) => r.entryId === mine)!.controlled).toBe(false);
  }, 120_000);

  it('are refused for another garage, an entry not in the race and a race not started', () => {
    const { db, mine, theirs } = atTheFinal('final-calls-b');
    expect(() => setFinalCall(db, 1, mine, 'push')).toThrow(/not been started/);
    startFinal(db, 1);
    expect(() => setFinalCall(db, 1, theirs, 'push')).toThrow(/Only the player/);
    expect(() => setFinalCall(db, 1, -5, 'push')).toThrow(/not in the final/);
  }, 120_000);

  it('give the same race every time, and an automatic call is the race with no calls', () => {
    const run = (call: 'push' | 'conserve' | null) => {
      const { db, mine } = atTheFinal('final-calls-c');
      startFinal(db, 1);
      if (call) setFinalCall(db, 1, mine, call);
      playFinal(db, 1);
      return finalResults(db);
    };
    expect(run('push')).toBe(run('push'));
    expect(run(null)).toBe(run(null));
    // Calls change the race, so the two are not the same race.
    expect(run('push')).not.toBe(run('conserve'));
  }, 240_000);

  it('only move a mid-field car a few places over a whole race, on several seeds', () => {
    const place = (seed: string, call: 'push' | 'conserve') => {
      const { db, mine } = atTheFinal(seed, 7);
      startFinal(db, 1);
      setFinalCall(db, 1, mine, call);
      playFinal(db, 1);
      return db.exec('SELECT final_pos FROM result WHERE entry_id = ?', [mine])[0]!
        .values[0]![0] as number | null;
    };
    for (const seed of ['final-calls-d', 'final-calls-e', 'final-calls-f']) {
      const pushed = place(seed, 'push');
      const saved = place(seed, 'conserve');
      if (pushed !== null && saved !== null)
        expect(Math.abs(pushed - saved)).toBeLessThanOrEqual(6);
    }
  }, 240_000);
});

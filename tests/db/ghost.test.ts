// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { ghostOptions, ghostView, setGhost, settleGhosts } from '../../src/db/ghost';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const rows = (db: Database, sql: string): unknown[][] => db.exec(sql)[0]?.values ?? [];
const one = (db: Database, sql: string) => rows(db, sql)[0]?.[0];
const count = (db: Database, sql: string) => Number(one(db, sql));

function newWorld(seed: string): Database {
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

describe('the ghost table', () => {
  it('needs a driver for a Hard ghost and none for an Easy one, and holds one choice for an entry and round', () => {
    const db = newWorld('ghost-table');
    const round = Number(one(db, 'SELECT id FROM round ORDER BY id LIMIT 1'));
    const entry = Number(one(db, 'SELECT id FROM entry ORDER BY id LIMIT 1'));
    const driver = Number(one(db, 'SELECT id FROM driver ORDER BY id LIMIT 1'));
    const add = (mode: string, ghost: number | null) =>
      db.run(
        'INSERT INTO ghost_choice (round_id, entry_id, mode, ghost_driver_id) VALUES (?, ?, ?, ?)',
        [round, entry, mode, ghost],
      );
    expect(() => add('hard', null)).toThrow(/CHECK constraint/);
    expect(() => add('easy', driver)).toThrow(/CHECK constraint/);
    expect(() => add('medium', null)).toThrow(/CHECK constraint/);
    add('easy', null);
    expect(() => add('easy', null)).toThrow(/UNIQUE constraint/);
  });
});

describe('the first season', () => {
  it('has no ghost to offer and refuses a choice', () => {
    const db = newWorld('ghost-first');
    expect(ghostOptions(db, 1)).toEqual([]);
    const entry = Number(one(db, 'SELECT id FROM entry ORDER BY id LIMIT 1'));
    db.run(
      'UPDATE garage SET is_player = 1 WHERE id = (SELECT garage_id FROM entry WHERE id = ?)',
      [entry],
    );
    expect(() => setGhost(db, entry, { mode: 'easy' })).toThrow();
    expect(ghostView(db).available).toBe(false);
  });
});

describe('the second season', () => {
  let db: Database;
  let mine: number[];
  beforeAll(() => {
    db = newWorld('ghost-second');
    for (let n = 1; n <= 6; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
    endSeason(db);
    startNextSeason(db);
    const garage = Number(
      one(
        db,
        `SELECT garage_id FROM entry WHERE season_id = (SELECT MAX(id) FROM season) AND series = 'main'
          ORDER BY id LIMIT 1`,
      ),
    );
    db.run('UPDATE garage SET is_player = 1 WHERE id = ?', [garage]);
    mine = rows(
      db,
      `SELECT id FROM entry WHERE garage_id = ${garage} AND season_id = (SELECT MAX(id) FROM season)
        AND series = 'main' ORDER BY id`,
    ).map((r) => r[0] as number);
  }, 600_000);

  it('offers last year top five, with the time each set on the same course', () => {
    const options = ghostOptions(db, 1);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(5);
    const points = options.map((o) => o.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    for (const o of options) {
      const lastYear = count(
        db,
        `SELECT r.prelim_time_ms FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
          WHERE e.driver_id = ${o.driverId} AND s.year = 2031
            AND ro.course_id = (SELECT course_id FROM round WHERE number = 1 ORDER BY id DESC LIMIT 1)`,
      );
      expect(o.timeMs).toBe(lastYear);
      expect(o.name.length).toBeGreaterThan(0);
    }
  });

  it('keeps a choice for each entry, and a new one replaces the old', () => {
    const [hard] = ghostOptions(db, 1);
    setGhost(db, mine[0]!, { mode: 'easy' });
    setGhost(db, mine[0]!, { mode: 'hard', driverId: hard!.driverId });
    expect(
      rows(db, `SELECT mode, ghost_driver_id FROM ghost_choice WHERE entry_id = ${mine[0]}`),
    ).toEqual([['hard', hard!.driverId]]);
    setGhost(db, mine[0]!, null);
    expect(count(db, 'SELECT COUNT(*) FROM ghost_choice')).toBe(0);
  });

  it('refuses a Hard ghost who is not on offer, an entry that is not the player, and an unknown entry', () => {
    expect(() => setGhost(db, mine[0]!, { mode: 'hard', driverId: 99_999 })).toThrow();
    const other = Number(
      one(
        db,
        `SELECT id FROM entry WHERE garage_id <> (SELECT id FROM garage WHERE is_player = 1)
          AND season_id = (SELECT MAX(id) FROM season) ORDER BY id LIMIT 1`,
      ),
    );
    expect(() => setGhost(db, other, { mode: 'easy' })).toThrow();
    expect(() => setGhost(db, 999_999, { mode: 'easy' })).toThrow();
    expect(count(db, 'SELECT COUNT(*) FROM ghost_choice')).toBe(0);
  });

  it('is settled by the prelims: the Hard ghost is beaten or not, and the Easy one runs two seconds ahead', () => {
    const [hard] = ghostOptions(db, 1);
    setGhost(db, mine[0]!, { mode: 'hard', driverId: hard!.driverId });
    if (mine[1] !== undefined) setGhost(db, mine[1], { mode: 'easy' });
    playPrelims(db, 1);
    const round = Number(one(db, 'SELECT id FROM round WHERE number = 1 ORDER BY id DESC LIMIT 1'));
    const h = rows(
      db,
      `SELECT g.ghost_time_ms, g.own_time_ms, g.beaten, g.settled, r.prelim_time_ms
         FROM ghost_choice g JOIN result r ON r.round_id = g.round_id AND r.entry_id = g.entry_id
        WHERE g.round_id = ${round} AND g.entry_id = ${mine[0]}`,
    )[0]!;
    expect(h[0]).toBe(hard!.timeMs);
    expect(h[1]).toBe(h[4]);
    expect(h[3]).toBe(1);
    expect(h[2]).toBe(h[4] !== null && (h[4] as number) < hard!.timeMs ? 1 : 0);
    if (mine[1] !== undefined) {
      const e = rows(
        db,
        `SELECT g.ghost_time_ms, g.own_time_ms, g.beaten FROM ghost_choice g WHERE g.entry_id = ${mine[1]}`,
      )[0]!;
      expect(e[0]).toBe(e[1] === null ? null : (e[1] as number) - 2000);
      expect(e[2]).toBeNull();
    }
  });

  it('is settled once: a second settling changes nothing', () => {
    const before = JSON.stringify(rows(db, 'SELECT * FROM ghost_choice ORDER BY entry_id'));
    const round = Number(one(db, 'SELECT id FROM round WHERE number = 1 ORDER BY id DESC LIMIT 1'));
    settleGhosts(db, round);
    expect(JSON.stringify(rows(db, 'SELECT * FROM ghost_choice ORDER BY entry_id'))).toBe(before);
  });

  it('refuses a choice for a round whose prelims have been run', () => {
    expect(() => setGhost(db, mine[0]!, { mode: 'easy' })).not.toThrow();
    // Round 1 is done, so the choice is for round 2; run it and the next choice is for round 3.
    expect(ghostView(db).round).toBe(2);
  });

  it('settles an Easy ghost two seconds ahead of the run, and it is never beaten', () => {
    playFinal(db, 1);
    setGhost(db, mine[0]!, { mode: 'easy' });
    playPrelims(db, 2);
    const round = Number(one(db, 'SELECT id FROM round WHERE number = 2 ORDER BY id DESC LIMIT 1'));
    const e = rows(
      db,
      `SELECT ghost_time_ms, own_time_ms, beaten, settled FROM ghost_choice
        WHERE round_id = ${round} AND entry_id = ${mine[0]}`,
    )[0]!;
    expect(e[3]).toBe(1);
    expect(e[2]).toBeNull();
    expect(e[0]).toBe(e[1] === null ? null : (e[1] as number) - 2000);
    const shown = ghostView(db).results.find((r) => r.mode === 'easy')!;
    expect(shown.beaten).toBeNull();
    expect(shown.ghostName).toBeNull();
    expect(shown.deltaMs === null || shown.deltaMs === -2000).toBe(true);
  }, 300_000);

  it('settles a Hard ghost from the times: beaten and by how much, lost to, a tie, and no time', () => {
    playFinal(db, 2);
    const [hard] = ghostOptions(db, 3);
    setGhost(db, mine[0]!, { mode: 'hard', driverId: hard!.driverId });
    const view = ghostView(db);
    expect(view.entries[0]!.pick).toEqual({
      mode: 'hard',
      driverId: hard!.driverId,
      ghostName: hard!.name,
    });
    playPrelims(db, 3);
    const round = Number(one(db, 'SELECT id FROM round WHERE number = 3 ORDER BY id DESC LIMIT 1'));
    const settle = (own: number | null) => {
      db.run('UPDATE result SET prelim_time_ms = ? WHERE round_id = ? AND entry_id = ?', [
        own,
        round,
        mine[0]!,
      ]);
      db.run('UPDATE ghost_choice SET settled = 0 WHERE round_id = ?', [round]);
      settleGhosts(db, round);
      return ghostView(db).results.find((r) => r.mode === 'hard')!;
    };
    const faster = settle(hard!.timeMs - 800);
    expect([faster.beaten, faster.deltaMs, faster.ghostName]).toEqual([true, 800, hard!.name]);
    expect(faster.ghostTimeMs).toBe(hard!.timeMs);
    const slower = settle(hard!.timeMs + 500);
    expect([slower.beaten, slower.deltaMs]).toEqual([false, -500]);
    const tied = settle(hard!.timeMs);
    expect([tied.beaten, tied.deltaMs]).toEqual([false, 0]);
    const none = settle(null);
    expect([none.beaten, none.deltaMs, none.ownTimeMs]).toEqual([false, null, null]);
  }, 300_000);

  it('shows what is on offer, the choices and the results of the last settled ghosts', () => {
    const view = ghostView(db);
    expect(view.available).toBe(true);
    expect(view.options.length).toBeGreaterThan(0);
    expect(view.entries.map((e) => e.entryId)).toEqual(mine);
    expect(view.results.length).toBeGreaterThan(0);
    for (const r of view.results) {
      expect(['easy', 'hard']).toContain(r.mode);
      if (r.mode === 'hard') expect(r.ghostName).not.toBeNull();
    }
  });

  it('still lets an Easy ghost be picked, and a pick be cleared, when no Hard ghost is on offer', () => {
    const round = ghostView(db).round!;
    const course = Number(
      one(
        db,
        `SELECT course_id FROM round WHERE number = ${round}
          AND season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)`,
      ),
    );
    // Nobody set a time on this course last season.
    db.run(
      `UPDATE result SET prelim_time_ms = NULL WHERE round_id IN
         (SELECT ro.id FROM round ro JOIN season s ON s.id = ro.season_id
           WHERE s.year = 2031 AND ro.course_id = ?)`,
      [course],
    );
    expect(ghostOptions(db, round)).toEqual([]);
    expect(() => setGhost(db, mine[0]!, { mode: 'easy' })).not.toThrow();
    expect(ghostView(db).entries[0]!.pick!.mode).toBe('easy');
    expect(() => setGhost(db, mine[0]!, { mode: 'hard', driverId: 1 })).toThrow();
    expect(() => setGhost(db, mine[0]!, null)).not.toThrow();
    expect(ghostView(db).entries[0]!.pick).toBeNull();
  });
});

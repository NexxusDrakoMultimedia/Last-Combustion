// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { bringForwardTo, calendarView, moveDateTo, skipTime } from '../../src/db/calendar';
import { createCareer, readCareer } from '../../src/db/career';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

function world(): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'calendar',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('calendar'));
  return db;
}

describe('the calendar in the database', () => {
  it('starts on 1 February with practice the first event and nothing due', () => {
    const v = calendarView(world())!;
    expect(v.date).toBe('2031-02-01');
    expect(v.year).toBe(2031);
    expect(v.due).toBeNull();
    expect(v.next).toMatchObject({ kind: 'practice', round: 1, date: '2031-03-31' });
  });

  it('skips a day, a week and to the next event, stopping early', () => {
    const db = world();
    expect(skipTime(db, 'day').date).toBe('2031-02-02');
    expect(skipTime(db, 'week').date).toBe('2031-02-09');
    expect(skipTime(db, 'event').date).toBe('2031-03-31');
    expect(skipTime(db, 'week').date).toBe('2031-04-07');
    expect(readCareer(db)!.gameDate).toBe('2031-04-07');
  });

  it('puts the prelims due on their day and refuses to skip until they are run', () => {
    const db = world();
    skipTime(db, 'due');
    expect(calendarView(db)!.date).toBe('2031-03-31');
    skipTime(db, 'due');
    const v = calendarView(db)!;
    expect(v.date).toBe('2031-04-07');
    expect(v.due).toMatchObject({ kind: 'prelims', round: 1 });
    expect(() => skipTime(db, 'day')).toThrow(/needs your attention/);
    // Marking the prelims done clears it, and the final becomes the next thing.
    db.run("UPDATE round SET status = 'prelims_done' WHERE number = 1");
    const after = calendarView(db)!;
    expect(after.due).toBeNull();
    expect(after.next).toMatchObject({ kind: 'final', round: 1, date: '2031-04-14' });
  });

  it('gives the same date whether time moves in one jump or many days', () => {
    const a = world();
    const b = world();
    moveDateTo(a, '2031-03-10');
    for (let i = 0; i < 37; i++)
      moveDateTo(b, `2031-02-${String(Math.min(28, i + 2)).padStart(2, '0')}`);
    moveDateTo(b, '2031-03-10');
    expect(readCareer(a)!.gameDate).toBe(readCareer(b)!.gameDate);
  });

  it('brings the date forward to an event when it is run directly, and never back', () => {
    const db = world();
    bringForwardTo(db, 'prelims', 1);
    expect(readCareer(db)!.gameDate).toBe('2031-04-07');
    bringForwardTo(db, 'prelims', 1);
    moveDateTo(db, '2031-01-01');
    expect(readCareer(db)!.gameDate).toBe('2031-04-07');
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { bringForwardTo, calendarView, moveDateTo, skipTime } from '../../src/db/calendar';
import { playPrelims, startPrelims } from '../../src/db/prelims';
import { playNextPrelimDay, playPrelimsOnTheDays } from '../../src/db/raceday';
import { createCareer, readCareer } from '../../src/db/career';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { chassisWear } from '../../src/sim/wear';
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

describe('the calendar while the prelims are under way', () => {
  it('has a prelim day for each of the seven once the prelims are started, with the final fixed', () => {
    const db = world();
    const before = calendarView(db)!.events.filter((e) => e.round === 1);
    expect(before.some((e) => e.kind === 'prelims')).toBe(true);
    startPrelims(db, 1);
    const events = calendarView(db)!.events.filter((e) => e.round === 1);
    expect(events.some((e) => e.kind === 'prelims')).toBe(false);
    const days = events.filter((e) => e.kind === 'prelim_day');
    expect(days.map((e) => e.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days.every((e) => !e.done && e.blocking)).toBe(true);
    // The weather has settled the days, and the final is the day after the last.
    const final = events.find((e) => e.kind === 'final')!;
    expect(final.date > days[6]!.date).toBe(true);
    expect(days[0]!.date >= '2031-04-07').toBe(true);
  });

  it('moves the date to each prelim day as it is played, and ends with the one prelims event done', () => {
    const db = world();
    let last = readCareer(db)!.gameDate;
    for (let day = 1; day <= 7; day++) {
      const progress = playNextPrelimDay(db, 1);
      const date = readCareer(db)!.gameDate;
      expect(date >= last).toBe(true);
      last = date;
      expect(progress.daysPlayed).toBe(day);
      if (day < 7) {
        const v = calendarView(db)!;
        expect(v.events.filter((e) => e.kind === 'prelim_day' && e.done)).toHaveLength(day);
        // Nothing needs the player until the next day comes round.
        expect(v.due === null || v.due.kind === 'prelim_day').toBe(true);
        expect(progress.summary).toBeNull();
      } else {
        expect(progress.summary?.qualifiers).toBe(15);
      }
    }
    const v = calendarView(db)!;
    expect(v.events.some((e) => e.kind === 'prelim_day')).toBe(false);
    expect(v.events.find((e) => e.kind === 'prelims' && e.round === 1)).toMatchObject({
      done: true,
    });
    expect(v.next).toMatchObject({ kind: 'final', round: 1 });
  });

  it('gives the same results whether the prelims are played on their days or all at once', () => {
    const results = (db: Database) =>
      db.exec(
        'SELECT entry_id, run_day, run_slot, prelim_time_ms, prelim_pos, points, pole, dnf_reason FROM result ORDER BY entry_id',
      );
    const onTheDays = world();
    playPrelimsOnTheDays(onTheDays, 1);
    const atOnce = world();
    playPrelims(atOnce, 1);
    expect(results(onTheDays)).toEqual(results(atOnce));
  }, 60_000);

  it('works the wear out from the car as it stands when the prelims end', () => {
    const db = world();
    playPrelimsOnTheDays(db, 1);
    // The days between prelim days added road kilometres; the wear follows them.
    const row = db.exec(
      'SELECT c.road_km, c.race_km, c.wear_offset, c.restorations, c.wear, m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id JOIN entry e ON e.car_id = c.id LIMIT 1',
    )[0]!.values[0]!;
    expect(Number(row[4])).toBeGreaterThan(0);
    const again = chassisWear(
      Number(row[0]),
      Number(row[1]),
      row[5] as never,
      Number(row[2]),
      Number(row[3]),
    );
    expect(Number(row[4])).toBeCloseTo(again, 6);
  }, 60_000);
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  buildEvents,
  dueEvent,
  nextEvent,
  skipTarget,
  type CalendarEvent,
  type SkipMode,
} from '../sim/calendar';
import { addDays } from '../sim/worldgen/calendar';
import { readCareer } from './career';
import { all } from './entries';

export interface CalendarView {
  /** The game date. */
  date: string;
  year: number;
  events: CalendarEvent[];
  /** What needs the player today, if anything. */
  due: CalendarEvent | null;
  /** The next event after today. */
  next: CalendarEvent | null;
}

/** The game's calendar: today's date, the season's events and what is due or next. Undefined before there is a season. */
export function calendarView(db: Database): CalendarView | undefined {
  const career = readCareer(db);
  const season = all(db, 'SELECT id, year, status FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!career || !season) return undefined;
  const rounds = all(
    db,
    'SELECT number, practice_start, prelim_start, final_date, status FROM round WHERE season_id = ? ORDER BY number',
    [season.id as number],
  ).map((r) => ({
    number: r.number as number,
    practiceStart: r.practice_start as string,
    prelimStart: r.prelim_start as string,
    finalDate: r.final_date as string,
    status: r.status as string,
  }));
  const year = season.year as number;
  const events = buildEvents(year, rounds, season.status === 'complete', career.gameDate);
  return {
    date: career.gameDate,
    year,
    events,
    due: dueEvent(events, career.gameDate) ?? null,
    next: nextEvent(events, career.gameDate) ?? null,
  };
}

/** Moves the game date forward to a later date, one day at a time, so each day's work is the same however far the skip. */
export function moveDateTo(db: Database, target: string): string {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  let date = career.gameDate;
  while (date < target) {
    date = addDays(date, 1);
    db.run('UPDATE career SET game_date = ? WHERE id = 1', [date]);
    // The place for what changes from one day to the next (nothing yet: daily life is settled with
    // each round). Whatever goes here must depend only on the seed and the date, so that skipping a
    // week gives the world that seven single days give.
  }
  return date;
}

/**
 * Skips time: a day, a week or on to the next event. It stops early at any event, and does nothing
 * while an event needs the player. Returns the calendar as it stands.
 */
export function skipTime(db: Database, mode: SkipMode): CalendarView {
  const view = calendarView(db);
  if (!view) throw new Error('There is no season in this database.');
  if (view.due) throw new Error('Something needs your attention before time can move on.');
  moveDateTo(db, skipTarget(view.events, view.date, mode));
  return calendarView(db)!;
}

/** Brings the date forward to an event's date if it has not got there yet (used when an event is run directly). */
export function bringForwardTo(db: Database, kind: CalendarEvent['kind'], round?: number): void {
  const view = calendarView(db);
  const event = view?.events.find((e) => e.kind === kind && e.round === round && !e.done);
  if (view && event && view.date < event.date) moveDateTo(db, event.date);
}

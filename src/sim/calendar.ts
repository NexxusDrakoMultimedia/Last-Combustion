// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { occasionEnd, occasionSchedule } from './social';
import { addDays } from './worldgen/calendar';

/** What a calendar event is. Prelims, finals and the two ends of the season need the player; practice just marks a date. */
export type EventKind = 'practice' | 'prelims' | 'final' | 'occasion' | 'end_season' | 'new_season';

export interface CalendarEvent {
  kind: EventKind;
  date: string;
  /** The round it belongs to, for practice, prelims and finals. */
  round?: number;
  /** Whether it has happened. */
  done: boolean;
  /** Whether time stops until the player has dealt with it. */
  blocking: boolean;
  /** Whether Continue stops at it even though time can move on (a social occasion). */
  notable?: boolean;
  /** For an occasion, which one. */
  occasion?: string;
  /** For an occasion, how many days it is open. */
  days?: number;
}

export interface RoundDates {
  number: number;
  practiceStart: string;
  prelimStart: string;
  finalDate: string;
  status: string;
}

/** The date the financial year, and so the season's books, close. */
export const SEASON_END_MONTH_DAY = '11-11';
/** The date the next season begins. */
export const NEW_SEASON_MONTH_DAY = '02-01';

/** The events of a season in date order: practice, prelims and final of each round, the end of the season and the start of the next. */
export function buildEvents(
  year: number,
  rounds: readonly RoundDates[],
  seasonComplete: boolean,
  today: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const r of [...rounds].sort((a, b) => a.number - b.number)) {
    events.push(
      {
        kind: 'practice',
        date: r.practiceStart,
        round: r.number,
        done: today >= r.practiceStart,
        blocking: false,
      },
      {
        kind: 'prelims',
        date: r.prelimStart,
        round: r.number,
        done: r.status !== 'scheduled',
        blocking: true,
      },
      {
        kind: 'final',
        date: r.finalDate,
        round: r.number,
        done: r.status === 'complete',
        blocking: true,
      },
    );
  }
  const finals: Record<number, string> = {};
  for (const r of rounds) finals[r.number] = r.finalDate;
  for (const o of occasionSchedule(year, finals))
    events.push({
      kind: 'occasion',
      date: o.date,
      occasion: o.id,
      days: o.days,
      done: today > occasionEnd(o),
      blocking: false,
      notable: true,
    });
  events.push(
    {
      kind: 'end_season',
      date: `${year}-${SEASON_END_MONTH_DAY}`,
      done: seasonComplete,
      blocking: true,
    },
    {
      kind: 'new_season',
      date: `${year + 1}-${NEW_SEASON_MONTH_DAY}`,
      done: false,
      blocking: true,
    },
  );
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The event that needs the player now: the first one that is not done, that stops time, and whose
 * date has come. Time cannot move on until it is dealt with.
 */
export function dueEvent(
  events: readonly CalendarEvent[],
  today: string,
): CalendarEvent | undefined {
  const first = events.find((e) => e.blocking && !e.done);
  return first && first.date <= today ? first : undefined;
}

/** The next event that has not happened and lies after today (what Next event goes to). */
export function nextEvent(
  events: readonly CalendarEvent[],
  today: string,
): CalendarEvent | undefined {
  return events.find((e) => !e.done && e.date > today);
}

export type SkipMode = 'day' | 'week' | 'event' | 'due';

/**
 * Where a skip lands. A day moves one day and a week seven, and either stops early at the next
 * event; Next event goes straight to it, and Continue goes to the next thing that needs the player or invites them (a race, an occasion). Nothing moves while an event needs the player, and
 * nothing moves with no event ahead.
 */
export function skipTarget(
  events: readonly CalendarEvent[],
  today: string,
  mode: SkipMode,
): string {
  if (dueEvent(events, today)) return today;
  const next = nextEvent(events, today);
  if (mode === 'event') return next ? next.date : today;
  // Continue goes to the next thing that needs the player, past events that only mark a date.
  if (mode === 'due') {
    const stop = events.find((e) => (e.blocking || e.notable) && !e.done && e.date > today);
    return stop ? stop.date : today;
  }
  const step = addDays(today, mode === 'day' ? 1 : 7);
  return next && next.date < step ? next.date : step;
}

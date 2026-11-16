// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildEvents,
  dueEvent,
  nextEvent,
  skipTarget,
  type RoundDates,
} from '../../src/sim/calendar';
import { buildCalendar } from '../../src/sim/worldgen/calendar';

const rounds = (done: number, prelimsDone = false): RoundDates[] =>
  buildCalendar(2031).map((r, i) => ({
    number: r.number,
    practiceStart: r.practiceStart,
    prelimStart: r.prelimStart,
    finalDate: r.finalDate,
    status: i < done ? 'complete' : i === done && prelimsDone ? 'prelims_done' : 'scheduled',
  }));

describe('the season calendar', () => {
  it('lists practice, prelims and a final for each round, then the end of the season and the next one', () => {
    const events = buildEvents(2031, rounds(0), false, '2031-02-01');
    expect(events).toHaveLength(6 * 3 + 5 + 2);
    expect(events.map((e) => e.date)).toEqual([...events.map((e) => e.date)].sort());
    expect(events[0]).toMatchObject({
      kind: 'practice',
      round: 1,
      date: '2031-03-31',
      done: false,
    });
    expect(events.at(-2)).toMatchObject({ kind: 'end_season', date: '2031-11-11' });
    expect(events.at(-1)).toMatchObject({ kind: 'new_season', date: '2032-02-01' });
    expect(events.filter((e) => e.blocking).map((e) => e.kind)).not.toContain('practice');
    // The five social occasions are on it too: they invite the player but do not hold time up.
    const occasions = events.filter((e) => e.kind === 'occasion');
    expect(occasions.map((e) => e.occasion)).toEqual([
      'season_opening',
      'sponsor_dinner',
      'press_day',
      'paddock_party',
      'closing_ceremony',
    ]);
    expect(occasions.every((e) => !e.blocking && e.notable)).toBe(true);
  });

  it('marks events done from the rounds’ status and the date', () => {
    const e = buildEvents(2031, rounds(1, true), false, '2031-05-20');
    const get = (kind: string, round: number) =>
      e.find((x) => x.kind === kind && x.round === round)!;
    expect(get('final', 1).done).toBe(true);
    expect(get('prelims', 2).done).toBe(true);
    expect(get('final', 2).done).toBe(false);
    expect(get('practice', 2).done).toBe(true);
    expect(get('prelims', 3).done).toBe(false);
    expect(
      buildEvents(2031, rounds(6), true, '2031-11-11').find((x) => x.kind === 'end_season')!.done,
    ).toBe(true);
  });

  it('has something due only when a blocking event’s day has come', () => {
    const events = buildEvents(2031, rounds(0), false, '2031-02-01');
    expect(dueEvent(events, '2031-02-01')).toBeUndefined();
    expect(dueEvent(events, '2031-04-06')).toBeUndefined();
    expect(dueEvent(events, '2031-04-07')).toMatchObject({ kind: 'prelims', round: 1 });
    expect(nextEvent(events, '2031-02-01')).toMatchObject({ kind: 'practice', round: 1 });
  });
});

describe('skipping time', () => {
  const events = buildEvents(2031, rounds(0), false, '2031-02-01');

  it('moves a day or a week, and stops early at an event', () => {
    expect(skipTarget(events, '2031-02-01', 'day')).toBe('2031-02-02');
    expect(skipTarget(events, '2031-02-01', 'week')).toBe('2031-02-08');
    expect(skipTarget(events, '2031-03-28', 'week')).toBe('2031-03-31');
    expect(skipTarget(events, '2031-03-30', 'day')).toBe('2031-03-31');
  });

  it('goes to the next event, or on to the next thing that needs the player', () => {
    expect(skipTarget(events, '2031-02-01', 'event')).toBe('2031-03-31');
    // Continue stops at the season opening, which invites but does not hold time up.
    expect(skipTarget(events, '2031-02-01', 'due')).toBe('2031-03-31');
    expect(skipTarget(events, '2031-03-31', 'due')).toBe('2031-04-07');
  });

  it('does not move while something is due', () => {
    for (const mode of ['day', 'week', 'event', 'due'] as const)
      expect(skipTarget(events, '2031-04-07', mode)).toBe('2031-04-07');
  });

  it('never goes back, never passes an unfinished blocking event, and is the same in steps as at once', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.constantFrom('day', 'week', 'event', 'due') as fc.Arbitrary<
          'day' | 'week' | 'event' | 'due'
        >,
        (offset, mode) => {
          const today = new Date(Date.UTC(2031, 1, 1) + offset * 86_400_000)
            .toISOString()
            .slice(0, 10);
          const target = skipTarget(events, today, mode);
          expect(target >= today).toBe(true);
          const blocking = events.find((e) => e.blocking && !e.done && e.date >= today);
          if (blocking && !dueEvent(events, today)) expect(target <= blocking.date).toBe(true);
        },
      ),
    );
  });
});

describe('a round whose prelims are under way', () => {
  const days = (played: number) =>
    [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      date: `2031-04-${String(6 + day).padStart(2, '0')}`,
      played: day <= played,
    }));
  const underWay = (played: number): RoundDates[] =>
    rounds(0).map((r) => (r.number === 1 ? { ...r, prelimDays: days(played) } : r));

  it('has a prelim day for each of the seven in place of the one prelims event', () => {
    const events = buildEvents(2031, underWay(0), false, '2031-04-07');
    const round1 = events.filter((e) => e.round === 1);
    expect(round1.filter((e) => e.kind === 'prelims')).toHaveLength(0);
    const prelimDays = round1.filter((e) => e.kind === 'prelim_day');
    expect(prelimDays.map((e) => e.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(prelimDays.every((e) => e.blocking && !e.done)).toBe(true);
    expect(events).toHaveLength(6 * 3 + 5 + 2 + 6);
    expect(events.map((e) => e.date)).toEqual([...events.map((e) => e.date)].sort());
  });

  it('is due on the first prelim day not yet played, and only once its date has come', () => {
    const events = (played: number, today: string) =>
      buildEvents(2031, underWay(played), false, today);
    expect(dueEvent(events(0, '2031-04-07'), '2031-04-07')).toMatchObject({
      kind: 'prelim_day',
      day: 1,
    });
    expect(dueEvent(events(1, '2031-04-07'), '2031-04-07')).toBeUndefined();
    expect(dueEvent(events(1, '2031-04-08'), '2031-04-08')).toMatchObject({ day: 2 });
    // Continue goes on to the next prelim day, and Next event does too.
    expect(skipTarget(events(1, '2031-04-07'), '2031-04-07', 'due')).toBe('2031-04-08');
    expect(skipTarget(events(1, '2031-04-07'), '2031-04-07', 'event')).toBe('2031-04-08');
    expect(skipTarget(events(1, '2031-04-07'), '2031-04-07', 'day')).toBe('2031-04-08');
  });

  it('goes back to the one prelims event once the prelims are done, and never mixes the two', () => {
    const finished = rounds(0, true).map((r) =>
      r.number === 1 ? { ...r, prelimDays: days(7) } : r,
    );
    const events = buildEvents(2031, finished, false, '2031-04-14');
    expect(events.filter((e) => e.kind === 'prelim_day')).toHaveLength(0);
    expect(events.find((e) => e.kind === 'prelims' && e.round === 1)).toMatchObject({ done: true });
  });
});

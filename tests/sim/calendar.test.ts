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
    expect(events).toHaveLength(6 * 3 + 2);
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
    expect(skipTarget(events, '2031-02-01', 'due')).toBe('2031-04-07');
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

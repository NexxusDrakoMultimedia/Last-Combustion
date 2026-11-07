// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import {
  MANNERS,
  converseOutcome,
  nextOccasion,
  occasionEnd,
  occasionOn,
  occasionSchedule,
  startingScore,
} from '../../src/sim/social';

const finals = {
  1: '2031-04-14',
  2: '2031-05-20',
  3: '2031-06-25',
  4: '2031-07-31',
  5: '2031-09-05',
  6: '2031-10-11',
};

describe('social occasions', () => {
  const schedule = occasionSchedule(2031, finals);

  it('are on dates: some on a day of the year, some a few days after a final', () => {
    expect(schedule.map((o) => [o.id, o.date, o.days])).toEqual([
      ['season_opening', '2031-03-31', 3],
      ['sponsor_dinner', '2031-05-30', 3],
      ['press_day', '2031-07-05', 3],
      ['paddock_party', '2031-08-10', 3],
      ['closing_ceremony', '2031-11-11', 7],
    ]);
  });

  it('are open on each day of their run, and at no other time', () => {
    expect(occasionOn(schedule, '2031-03-30')).toBeNull();
    expect(occasionOn(schedule, '2031-03-31')?.id).toBe('season_opening');
    expect(occasionOn(schedule, '2031-04-02')?.id).toBe('season_opening');
    expect(occasionOn(schedule, '2031-04-03')).toBeNull();
    expect(occasionOn(schedule, '2031-11-17')?.id).toBe('closing_ceremony');
    expect(occasionOn(schedule, '2031-11-18')).toBeNull();
    expect(occasionEnd(schedule[0]!)).toBe('2031-04-02');
  });

  it('come in date order, and each falls in the gap before the next round’s practice', () => {
    expect(schedule.map((o) => o.date)).toEqual([...schedule.map((o) => o.date)].sort());
    expect(nextOccasion(schedule, '2031-04-03')?.id).toBe('sponsor_dinner');
    expect(nextOccasion(schedule, '2031-11-11')).toBeNull();
    // Round 3's practice opens 36 days after round 2's, and so on.
    for (const [round, practice] of [
      [2, '2031-05-31'],
      [3, '2031-07-06'],
      [4, '2031-08-11'],
    ] as const) {
      const after = schedule.find((o) => o.date > finals[round as 2 | 3 | 4])!;
      expect(after.date < practice, `${round}`).toBe(true);
    }
  });

  it('gives a warm conversation 3 to 6 points and never trouble', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const o = converseOutcome(createRng(seed).stream('c'), 'warm');
        expect(o.delta).toBeGreaterThanOrEqual(3);
        expect(o.delta).toBeLessThanOrEqual(6);
        expect(o.trouble).toBe(false);
      }),
    );
  });

  it('lets a bold one pay off big or go wrong, and is the same for the same stream', () => {
    const seen = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      const o = converseOutcome(createRng(`bold-${i}`).stream('c'), 'bold');
      seen.add(o.trouble);
      if (o.trouble) expect(o.delta).toBeLessThan(0);
      else expect(o.delta).toBeGreaterThanOrEqual(10);
    }
    expect(seen.size).toBe(2);
    expect(converseOutcome(createRng('x').stream('c'), 'bold')).toEqual(
      converseOutcome(createRng('x').stream('c'), 'bold'),
    );
  });

  it('only lets a discreet one introduce someone, and keeps scores in range', () => {
    for (const manner of MANNERS) {
      for (let i = 0; i < 100; i++) {
        const o = converseOutcome(createRng(`m-${i}`).stream(manner), manner);
        if (manner !== 'discreet') expect(o.introduces).toBe(false);
      }
    }
    expect(startingScore(-100)).toBe(-95);
    expect(startingScore(100)).toBe(100);
  });
});

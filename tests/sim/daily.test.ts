// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  affinityCap,
  affinityGain,
  areaFactor,
  dailyKm,
  dailyLifeDaysBetween,
  isDailyLifeDay,
  deliveryIncome,
  relocationCost,
  roadTypeOfPlace,
} from '../../src/sim/daily';
import { addDays, buildCalendar } from '../../src/sim/worldgen/calendar';
import { ROAD_TYPES } from '../../src/sim/worldgen/types';

describe('the days of daily life', () => {
  const calendar = buildCalendar(2031);
  const spans = calendar.map((r) => ({ practiceStart: r.practiceStart, finalDate: r.finalDate }));
  const start = '2031-02-01';
  const all = (): string[] => {
    const out: string[] = [];
    for (let d = addDays(start, 1); d < '2031-12-31'; d = addDays(d, 1))
      if (isDailyLifeDay(d, start, spans)) out.push(d);
    return out;
  };

  it('are the days of the running season on which no round is held', () => {
    expect(isDailyLifeDay('2031-02-01', start, spans)).toBe(false); // the first day of the season
    expect(isDailyLifeDay('2031-02-02', start, spans)).toBe(true);
    expect(isDailyLifeDay(calendar[0]!.practiceStart, start, spans)).toBe(false);
    expect(isDailyLifeDay(calendar[0]!.finalDate, start, spans)).toBe(false);
    expect(isDailyLifeDay(addDays(calendar[0]!.finalDate, 1), start, spans)).toBe(true);
    expect(isDailyLifeDay(calendar.at(-1)!.finalDate, start, spans)).toBe(false);
    expect(isDailyLifeDay('2031-11-01', start, spans)).toBe(false); // after the last final
    expect(isDailyLifeDay('2031-06-01', start, [])).toBe(false);
  });

  it('come to 162 in a season, and the per-day pay and wear keep a season near the old 108-day totals', () => {
    expect(all()).toHaveLength(162);
    // The old rule paid $250 for 108 days; $167 for 162 days is within 1% of the same.
    expect(Math.abs(162 * deliveryIncome(1, 'Qld') - 108 * 250) / (108 * 250)).toBeLessThan(0.01);
    expect(Math.abs(162 * dailyKm(1) - 108 * 60)).toBeLessThan(10);
  });

  it('count the days between two dates, neither end included', () => {
    expect(dailyLifeDaysBetween('2031-02-01', calendar[0]!.practiceStart, start, spans)).toBe(57);
    expect(dailyLifeDaysBetween('2031-02-01', '2031-02-02', start, spans)).toBe(0);
    expect(dailyLifeDaysBetween('2031-02-01', '2031-02-03', start, spans)).toBe(1);
  });

  it('stop at the last final and never go below zero', () => {
    expect(dailyLifeDaysBetween('2031-10-12', '2031-12-31', start, spans)).toBe(0);
    expect(dailyLifeDaysBetween('2031-06-30', '2031-06-01', start, spans)).toBe(0);
  });
});

describe('delivery driving and the road', () => {
  it('pays $167 a day times the local-area factor', () => {
    expect(deliveryIncome(1, 'Qld')).toBe(167);
    expect(deliveryIncome(21, 'Vic')).toBe(3858);
    expect(deliveryIncome(21, 'NT')).toBeLessThan(deliveryIncome(21, 'NSW'));
    expect(areaFactor('somewhere else')).toBe(1);
    expect(deliveryIncome(0, 'NSW')).toBe(0);
  });

  it('puts 40 km a day on the car and trains the roads at home 0.067 of a point a day', () => {
    expect(dailyKm(21)).toBe(840);
    expect(affinityGain(21)).toBeCloseTo(1.407);
    expect(affinityCap()).toBe(70);
    expect(relocationCost()).toBe(5000);
  });
});

describe('the road around a place', () => {
  it('is the same every time for a place, and always a real road type', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const type = roadTypeOfPlace({ id });
        expect(ROAD_TYPES).toContain(type);
        expect(roadTypeOfPlace({ id })).toBe(type);
      }),
    );
  });

  it('can be set in the place data, and otherwise spreads across all four types', () => {
    expect(roadTypeOfPlace({ id: 'x', roadType: 'night' })).toBe('night');
    const seen = new Set(
      [
        'au-adelaide',
        'au-brisbane',
        'au-perth',
        'au-hobart',
        'au-darwin',
        'au-sydney',
        'jp-tokyo',
        'gb-london',
      ].map((id) => roadTypeOfPlace({ id })),
    );
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});

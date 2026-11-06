// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  affinityCap,
  affinityGain,
  areaFactor,
  dailyKm,
  daysBefore,
  deliveryIncome,
  relocationCost,
  roadTypeOfPlace,
} from '../../src/sim/daily';
import { buildCalendar } from '../../src/sim/worldgen/calendar';
import { ROAD_TYPES } from '../../src/sim/worldgen/types';

describe('the days before a round', () => {
  const calendar = buildCalendar(2031);

  it('count the lead-in for round 1 and a three-week gap after every other round', () => {
    expect(daysBefore(1, calendar[0]!.practiceStart, null)).toBe(3);
    for (let i = 1; i < 6; i++)
      expect(daysBefore(i + 1, calendar[i]!.practiceStart, calendar[i - 1]!.finalDate)).toBe(21);
  });

  it('add up to the 108 non-event days of the cost baseline across a season', () => {
    let total = daysBefore(1, calendar[0]!.practiceStart, null);
    for (let i = 1; i < 6; i++)
      total += daysBefore(i + 1, calendar[i]!.practiceStart, calendar[i - 1]!.finalDate);
    expect(total).toBe(108);
  });

  it('shrink when a weather delay pushes the last final back, and never go below zero', () => {
    const late = '2031-05-10';
    expect(daysBefore(2, calendar[1]!.practiceStart, late)).toBeLessThan(21);
    expect(daysBefore(2, '2031-05-01', '2031-06-30')).toBe(0);
  });
});

describe('delivery driving and the road', () => {
  it('pays $250 a day times the local-area factor', () => {
    expect(deliveryIncome(1, 'Qld')).toBe(250);
    expect(deliveryIncome(21, 'Vic')).toBe(5775);
    expect(deliveryIncome(21, 'NT')).toBeLessThan(deliveryIncome(21, 'NSW'));
    expect(areaFactor('somewhere else')).toBe(1);
    expect(deliveryIncome(0, 'NSW')).toBe(0);
  });

  it('puts 60 km a day on the car and trains the roads at home a tenth of a point a day', () => {
    expect(dailyKm(21)).toBe(1260);
    expect(affinityGain(21)).toBeCloseTo(2.1);
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

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  PALPABLY_UNFAIR,
  drawBanRaces,
  drawContactLevel,
  drawDroneLevel,
  ignoresDrone,
  isPalpablyUnfair,
  penaltyPlaces,
  penaltyScale,
  penaltyTypes,
  prelimPenaltyMs,
  technicalPenalty,
} from '../../src/sim/penalties';
import { createRng } from '../../src/sim/rng';

describe('the penalty scale', () => {
  it('has five levels in order, each step worth 5% of the leader’s lap and one place', () => {
    expect(penaltyScale.map((s) => s.id)).toEqual([
      'minor',
      'major',
      'severe',
      'flagrant',
      'egregious',
    ]);
    penaltyScale.forEach((step, i) => {
      expect(step.prelimPercent).toBe(5 * (i + 1));
      expect(step.places).toBe(i + 1);
    });
  });

  it('has the types a penalty can be for, and a Palpably Unfair Act apart from the scale', () => {
    expect(penaltyTypes).toEqual(['drone', 'technical', 'sportsmanship']);
    expect(penaltyScale.map((s) => s.id as string)).not.toContain(PALPABLY_UNFAIR);
    expect(isPalpablyUnfair(PALPABLY_UNFAIR)).toBe(true);
    expect(isPalpablyUnfair('egregious')).toBe(false);
  });

  it('costs a prelim run its share of the leader’s lap, 5% to 25%', () => {
    fc.assert(
      fc.property(fc.integer({ min: 60_000, max: 3_000_000 }), (leaderMs) => {
        penaltyScale.forEach((step) => {
          const ms = prelimPenaltyMs(step.id, leaderMs);
          expect(Math.abs(ms - (leaderMs * step.prelimPercent) / 100)).toBeLessThanOrEqual(0.5);
        });
        expect(prelimPenaltyMs('minor', leaderMs)).toBeLessThan(
          prelimPenaltyMs('egregious', leaderMs),
        );
      }),
    );
    expect(penaltyPlaces('minor')).toBe(1);
    expect(penaltyPlaces('egregious')).toBe(5);
  });
});

describe('a technical penalty from scrutineering', () => {
  it('is nothing for a legal car, a step by how far it is over, and a Palpably Unfair Act for an obvious cheat', () => {
    expect(technicalPenalty(0, 0)).toBeNull();
    expect(technicalPenalty(1, 0)).toBe('minor');
    expect(technicalPenalty(0, 5)).toBe('minor');
    expect(technicalPenalty(6, 0)).toBe('major');
    expect(technicalPenalty(12, 0)).toBe('severe');
    expect(technicalPenalty(20, 0)).toBe('flagrant');
    expect(technicalPenalty(30, 0)).toBe('egregious');
    expect(technicalPenalty(40, 0)).toBe(PALPABLY_UNFAIR);
    expect(technicalPenalty(0, 80)).toBe(PALPABLY_UNFAIR);
  });

  it('never gets lighter as the car gets more illegal', () => {
    const rank = (level: string | null) =>
      level === null
        ? -1
        : level === PALPABLY_UNFAIR
          ? 99
          : penaltyScale.findIndex((s) => s.id === level);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 80 }),
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (tyre, legality, moreTyre, moreLegality) => {
          expect(
            rank(technicalPenalty(tyre + moreTyre, legality + moreLegality)),
          ).toBeGreaterThanOrEqual(rank(technicalPenalty(tyre, legality)));
        },
      ),
    );
  });
});

describe('ignoring a drone’s signal', () => {
  it('is rare, mostly Minor, and a Palpably Unfair Act only very rarely', () => {
    const rng = createRng('drone-levels').stream('draw');
    const counts = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      const level = drawDroneLevel(rng);
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    expect(counts.get('minor')!).toBeGreaterThan(counts.get('major')!);
    expect(counts.get('major')!).toBeGreaterThan(counts.get('egregious')!);
    const unfair = counts.get(PALPABLY_UNFAIR) ?? 0;
    expect(unfair).toBeGreaterThan(0);
    expect(unfair / 20_000).toBeLessThan(0.01);
  });

  it('is likelier for a driver pushing and a rattled one than for a calm driver saving the car', () => {
    const rate = (aggression: number, composure: number) => {
      const rng = createRng('drone-chance').stream(`${aggression}:${composure}`);
      let n = 0;
      for (let i = 0; i < 20_000; i++) if (ignoresDrone(rng, 0.1, aggression, composure)) n += 1;
      return n / 20_000;
    };
    expect(rate(1, 30)).toBeGreaterThan(rate(0, 30));
    expect(rate(0.5, 20)).toBeGreaterThan(rate(0.5, 90));
  });

  it('bans a Palpably Unfair offender for 0 to 12 further races, mostly few', () => {
    const rng = createRng('bans').stream('draw');
    const draws = Array.from({ length: 5000 }, () => drawBanRaces(rng));
    expect(Math.min(...draws)).toBe(0);
    expect(Math.max(...draws)).toBe(12);
    expect(draws.filter((d) => d <= 3).length).toBeGreaterThan(draws.filter((d) => d >= 9).length);
  });

  it('draws a contact penalty mostly Minor and never a Palpably Unfair Act', () => {
    const rng = createRng('contact-levels').stream('draw');
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      const level = drawContactLevel(rng);
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    expect(counts.get('minor')!).toBeGreaterThan(counts.get('major')!);
    expect(counts.get('major')!).toBeGreaterThan(counts.get('severe')!);
    expect(counts.has(PALPABLY_UNFAIR)).toBe(false);
  });
});

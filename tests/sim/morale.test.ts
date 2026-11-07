// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  moraleBand,
  moraleFactor,
  moraleTarget,
  quitChance,
  stepMorale,
} from '../../src/sim/morale';

describe('morale', () => {
  it('sits at 50 for a fairly paid person in a middling garage with nothing built', () => {
    expect(moraleTarget({ pay: 1, results: 0.5, facilityLevels: 0 })).toBe(50);
  });

  it('rises with better pay, better results and more facilities, and falls with a stretched crew', () => {
    const base = { pay: 1, results: 0.5, facilityLevels: 0 };
    const t0 = moraleTarget(base);
    expect(moraleTarget({ ...base, pay: 1.5 })).toBeGreaterThan(t0);
    expect(moraleTarget({ ...base, results: 1 })).toBeGreaterThan(t0);
    expect(moraleTarget({ ...base, facilityLevels: 4 })).toBeGreaterThan(t0);
    expect(moraleTarget({ ...base, cover: 0.5 })).toBeLessThan(t0);
  });

  it('always stays within 0 to 100, and a step moves towards the target without passing it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 100 }),
        (pay, results, levels, current) => {
          const target = moraleTarget({ pay, results, facilityLevels: levels, cover: pay / 5 });
          expect(target).toBeGreaterThanOrEqual(0);
          expect(target).toBeLessThanOrEqual(100);
          const next = stepMorale(current, target);
          expect(Math.abs(next - target)).toBeLessThanOrEqual(Math.abs(current - target));
          expect(Math.min(current, target)).toBeLessThanOrEqual(next);
          expect(Math.max(current, target)).toBeGreaterThanOrEqual(next);
        },
      ),
    );
  });

  it('changes work by up to 5% either way, and sends the unhappy away', () => {
    expect(moraleFactor(50)).toBe(1);
    expect(moraleFactor(100)).toBeCloseTo(1.05);
    expect(moraleFactor(0)).toBeCloseTo(0.95);
    expect(quitChance(25)).toBe(0);
    expect(quitChance(0)).toBeCloseTo(0.3);
    expect(moraleBand(10)).toBe('low');
    expect(moraleBand(50)).toBe('fair');
    expect(moraleBand(90)).toBe('high');
  });
});

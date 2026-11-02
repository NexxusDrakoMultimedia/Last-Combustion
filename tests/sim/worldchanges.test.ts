// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planWorldChanges, unionLongName, worldChangeData } from '../../src/sim/worldchanges';

describe('planning the world changes', () => {
  it('is the same for the same seed', () => {
    expect([...planWorldChanges('abc')]).toEqual([...planWorldChanges('abc')]);
  });

  it('keeps every year in the window and Wales after Scotland and Northern Ireland', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const plan = planWorldChanges(seed);
        for (const year of plan.values()) {
          if (year !== null) {
            expect(year).toBeGreaterThanOrEqual(worldChangeData.windowStart);
            expect(year).toBeLessThanOrEqual(worldChangeData.windowEnd);
          }
        }
        const wales = plan.get('wales');
        if (wales !== null && wales !== undefined) {
          expect(wales).toBeGreaterThanOrEqual(plan.get('scotland') ?? Infinity);
          expect(wales).toBeGreaterThanOrEqual(plan.get('northern-ireland') ?? Infinity);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('treats the UK as more likely than not and Spain as unlikely, in the ranked order', () => {
    const rate = (id: string, n = 3000) => {
      let hits = 0;
      for (let i = 0; i < n; i++) if (planWorldChanges(`seed-${i}`).get(id) != null) hits++;
      return hits / n;
    };
    expect(rate('northern-ireland')).toBeGreaterThan(0.68);
    expect(rate('scotland')).toBeGreaterThan(0.5);
    expect(rate('wales')).toBeLessThan(rate('scotland'));
    const catalonia = rate('catalonia');
    expect(catalonia).toBeLessThan(0.25);
    expect(rate('basque')).toBeLessThan(0.25);
    expect(catalonia).toBeGreaterThan(rate('galicia'));
    expect(rate('galicia')).toBeGreaterThan(rate('canaries'));
  });

  it('opens no Spanish region unless Spain breaks up at all', () => {
    for (let i = 0; i < 300; i++) {
      const plan = planWorldChanges(`gate-${i}`);
      const any = ['catalonia', 'basque', 'galicia', 'canaries'].some((id) => plan.get(id) != null);
      if (any) expect(plan.size).toBeGreaterThan(0);
    }
    const none = Array.from({ length: 300 }, (_, i) => planWorldChanges(`gate-${i}`)).filter((p) =>
      ['catalonia', 'basque', 'galicia', 'canaries'].every((id) => p.get(id) === null),
    ).length;
    expect(none).toBeGreaterThan(180);
  });

  it('names the union by what is left of it', () => {
    expect(unionLongName(new Set())).toBe('United Kingdom of Great Britain and Northern Ireland');
    expect(unionLongName(new Set(['northern-ireland']))).toBe('United Kingdom of Great Britain');
    expect(unionLongName(new Set(['scotland']))).toBe(
      'United Kingdom of England, Wales and Northern Ireland',
    );
    expect(unionLongName(new Set(['scotland', 'northern-ireland']))).toBe(
      'United Kingdom of England and Wales',
    );
  });
});

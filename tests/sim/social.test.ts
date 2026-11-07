// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { MANNERS, converseOutcome, occasionAfter, startingScore } from '../../src/sim/social';

describe('social occasions', () => {
  it('opens after the rounds the calendar names, and at no other time', () => {
    expect(occasionAfter(0)).toBe('season_opening');
    expect(occasionAfter(1)).toBeNull();
    expect(occasionAfter(2)).toBe('sponsor_dinner');
    expect(occasionAfter(3)).toBe('press_day');
    expect(occasionAfter(4)).toBe('paddock_party');
    expect(occasionAfter(5)).toBeNull();
    expect(occasionAfter(6)).toBe('closing_ceremony');
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

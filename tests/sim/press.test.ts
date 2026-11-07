// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { JOURNALISTS, fansFor, pickJournalist, resultKind, toneOf } from '../../src/sim/press';

describe('the press', () => {
  it('sees the garage warmly, fairly or coldly by the relationship', () => {
    expect(toneOf(100)).toBe('warm');
    expect(toneOf(30)).toBe('warm');
    expect(toneOf(29)).toBe('fair');
    expect(toneOf(0)).toBe('fair');
    expect(toneOf(-29)).toBe('fair');
    expect(toneOf(-30)).toBe('cold');
    expect(fansFor('warm')).toBeGreaterThan(0);
    expect(fansFor('fair')).toBe(0);
    expect(fansFor('cold')).toBeLessThan(0);
  });

  it('names the kind of result from the best finish', () => {
    expect(resultKind(null, 0)).toBeNull();
    expect(resultKind(1, 25)).toBe('win');
    expect(resultKind(3, 15)).toBe('podium');
    expect(resultKind(7, 4)).toBe('points');
    expect(resultKind(14, 0)).toBe('nopoints');
  });

  it('counts the four commentators among the journalists', () => {
    expect(JOURNALISTS).toHaveLength(10);
    const ids = JOURNALISTS.slice(6).map((j) => j.id);
    expect(ids).toEqual([101, 102, 103, 104]);
    expect(JOURNALISTS.slice(6).map((j) => j.taste)).toEqual([
      'technical',
      'results',
      'human_interest',
      'gossip',
    ]);
  });

  it('has journalists with distinct ids, and favours a taste for the result', () => {
    expect(new Set(JOURNALISTS.map((j) => j.id)).size).toBe(JOURNALISTS.length);
    const count = (kind: 'win' | 'nopoints', taste: string) => {
      let n = 0;
      for (let i = 0; i < 600; i++)
        if (pickJournalist(createRng(`p-${i}`).stream('x'), kind).taste === taste) n++;
      return n;
    };
    // Results journalists are 1 of 6 but weighted 4 for a win: more than half the time they write it.
    expect(count('win', 'results')).toBeGreaterThan(600 * 0.25);
    expect(count('nopoints', 'gossip')).toBeGreaterThan(600 * 0.5);
    expect(pickJournalist(createRng('same').stream('x'), 'win')).toEqual(
      pickJournalist(createRng('same').stream('x'), 'win'),
    );
  });
});

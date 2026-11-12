// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  highlightFans,
  isHighlight,
  newsCap,
  pickHighlights,
  pickNewsJournalist,
  type CrashCandidate,
  type NewsKind,
} from '../../src/sim/news';
import { JOURNALISTS } from '../../src/sim/press';
import { createRng } from '../../src/sim/rng';

const KINDS: NewsKind[] = ['winner', 'crash', 'rivalry', 'story'];

describe('which crashes are highlights', () => {
  it('counts every crash in a final, whatever the repair bill', () => {
    expect(isHighlight('final', 0)).toBe(true);
    expect(isHighlight('final', 100)).toBe(true);
  });

  it('counts a prelim crash only with a repair bill of 15,000 or more', () => {
    expect(isHighlight('prelim', 14_999)).toBe(false);
    expect(isHighlight('prelim', 15_000)).toBe(true);
    expect(isHighlight('prelim', 0)).toBe(false);
  });
});

describe('the highlights of a round', () => {
  const c = (entryId: number, scope: 'prelim' | 'final', repair: number): CrashCandidate => ({
    entryId,
    scope,
    repair,
  });

  it('keeps the two dearest, ties by the lower entry id', () => {
    const kept = pickHighlights([
      c(5, 'prelim', 20_000),
      c(3, 'final', 9_000),
      c(4, 'prelim', 40_000),
      c(2, 'final', 9_000),
      c(1, 'prelim', 1_000),
    ]);
    expect(kept.map((k) => k.entryId)).toEqual([4, 5]);
    expect(
      pickHighlights([c(3, 'final', 9_000), c(2, 'final', 9_000)]).map((k) => k.entryId),
    ).toEqual([2, 3]);
  });

  it('is empty when nothing qualifies', () => {
    expect(pickHighlights([c(1, 'prelim', 100)])).toEqual([]);
    expect(pickHighlights([])).toEqual([]);
  });

  it('never keeps more than the cap, only highlights, dearest first', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            entryId: fc.integer({ min: 1, max: 400 }),
            scope: fc.constantFrom('prelim' as const, 'final' as const),
            repair: fc.integer({ min: 0, max: 120_000 }),
          }),
          { maxLength: 30 },
        ),
        (list) => {
          const kept = pickHighlights(list);
          expect(kept.length).toBeLessThanOrEqual(2);
          for (const k of kept) expect(isHighlight(k.scope, k.repair)).toBe(true);
          for (let i = 1; i < kept.length; i++)
            expect(kept[i - 1]!.repair).toBeGreaterThanOrEqual(kept[i]!.repair);
        },
      ),
    );
  });
});

describe('what a highlight is worth', () => {
  it('gives 0.15% of the series audience in fans', () => {
    expect(highlightFans(200_000)).toBe(300);
    expect(highlightFans(0)).toBe(0);
  });
});

describe('the news', () => {
  it('has a cap and weights for every kind', () => {
    for (const kind of KINDS) expect(newsCap(kind)).toBeGreaterThan(0);
  });

  it('is written by a known journalist, the same one for the same stream', () => {
    for (const kind of KINDS) {
      const a = pickNewsJournalist(createRng('news-a').stream('news:1'), kind);
      const b = pickNewsJournalist(createRng('news-a').stream('news:1'), kind);
      expect(a).toEqual(b);
      expect(JOURNALISTS.map((j) => j.id)).toContain(a.id);
    }
  });
});

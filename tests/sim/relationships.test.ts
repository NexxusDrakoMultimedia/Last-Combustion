// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { relationshipKind } from '../../src/sim/relationships';

describe('relationship kinds', () => {
  it('names a score', () => {
    expect(relationshipKind(100)).toBe('friend');
    expect(relationshipKind(50)).toBe('friend');
    expect(relationshipKind(49)).toBe('acquaintance');
    expect(relationshipKind(0)).toBe('acquaintance');
    expect(relationshipKind(-19)).toBe('acquaintance');
    expect(relationshipKind(-20)).toBe('rival');
    expect(relationshipKind(-59)).toBe('rival');
    expect(relationshipKind(-60)).toBe('enemy');
    expect(relationshipKind(-100)).toBe('enemy');
  });

  it('never gets worse as the score rises', () => {
    const rank = { enemy: 0, rival: 1, acquaintance: 2, friend: 3 } as const;
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 99 }), (score) => {
        expect(rank[relationshipKind(score + 1)]).toBeGreaterThanOrEqual(
          rank[relationshipKind(score)],
        );
      }),
    );
  });
});

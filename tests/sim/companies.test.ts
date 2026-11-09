// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  TIER_ORDER,
  byTierThenName,
  drawOffers,
  offerWeight,
  rollBreak,
} from '../../src/sim/companies';
import { createRng } from '../../src/sim/rng';
import { sponsors } from '../../src/sim/sponsors';
import { companyBalance } from '../../src/sim/worldgen/data';

describe('sorting companies', () => {
  it('goes by tier, local first and global last, then by name', () => {
    const list = [
      { tier: 'global', name: 'Zed' },
      { tier: 'local', name: 'Beta' },
      { tier: 'local', name: 'Alpha' },
      { tier: 'national', name: 'Gamma' },
    ];
    expect([...list].sort(byTierThenName).map((c) => c.name)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Zed',
    ]);
    expect(TIER_ORDER).toEqual(['local', 'regional', 'national', 'continental', 'global']);
  });
});

describe('the offers a garage gets', () => {
  const pool = sponsors;

  it('are three, without repeats, sorted by tier then name, and the same for the same stream', () => {
    const draw = (seed: string) => drawOffers(createRng(seed).stream('offers'), pool, 50, () => 0);
    const a = draw('x');
    expect(a).toHaveLength(3);
    expect(new Set(a.map((s) => s.id)).size).toBe(3);
    expect([...a].sort(byTierThenName)).toEqual(a);
    expect(draw('x')).toEqual(a);
    expect(draw('y')).not.toEqual(a);
  });

  it('are fewer when there are fewer to be had', () => {
    expect(drawOffers(createRng('s').stream('o'), pool.slice(0, 2), 50, () => 0)).toHaveLength(2);
    expect(drawOffers(createRng('s').stream('o'), [], 50, () => 0)).toEqual([]);
  });

  it('favour a company near the garage’s prestige, a liked one and a common tier', () => {
    const near = { tier: 'regional', minPrestige: 40 };
    const far = { tier: 'regional', minPrestige: 5 };
    expect(offerWeight(near, 42, 0)).toBeGreaterThan(offerWeight(far, 42, 0));
    expect(offerWeight(near, 42, 60)).toBeGreaterThan(offerWeight(near, 42, 0));
    // A dislike does not push the weight below the plain one, so a rival is still offered now and then.
    expect(offerWeight(near, 42, -80)).toBe(offerWeight(near, 42, 0));
    expect(offerWeight({ tier: 'local', minPrestige: 40 }, 42, 0)).toBeGreaterThan(
      offerWeight({ tier: 'global', minPrestige: 40 }, 42, 0),
    );
  });

  it('draw a liked company more often over many seasons', () => {
    const two = [
      { tier: 'regional', name: 'Liked', minPrestige: 30 },
      { tier: 'regional', name: 'Plain', minPrestige: 30 },
    ];
    let liked = 0;
    for (let i = 0; i < 400; i++) {
      const pick = drawOffers(
        createRng(`y-${i}`).stream('o'),
        two,
        30,
        (c) => (c.name === 'Liked' ? 100 : 0),
        1,
      )[0]!;
      if (pick.name === 'Liked') liked++;
    }
    expect(liked).toBeGreaterThan(220);
  });
});

describe('companies coming and going', () => {
  it('leave for one to three years and never for good', () => {
    const [lo, hi] = companyBalance.breakYears as [number, number];
    let left = 0;
    for (let i = 0; i < 4000; i++) {
      const years = rollBreak(createRng(`b-${i}`).stream('c'));
      if (years === null) continue;
      left++;
      expect(years).toBeGreaterThanOrEqual(lo);
      expect(years).toBeLessThanOrEqual(hi);
    }
    // About one year in twelve (8%).
    expect(left / 4000).toBeGreaterThan(companyBalance.breakChance / 2);
    expect(left / 4000).toBeLessThan(companyBalance.breakChance * 2);
  });

  it('are the same for the same stream', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        expect(rollBreak(createRng('s').stream(name))).toBe(rollBreak(createRng('s').stream(name)));
      }),
    );
  });
});

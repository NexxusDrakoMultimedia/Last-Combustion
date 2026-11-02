// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { eligibleSponsors, feePerRound, sponsors, titleSponsorFee } from '../../src/sim/sponsors';

describe('the sponsor list', () => {
  it('has twelve sponsors across four tiers, each tier needing more prestige and carrying more weight', () => {
    expect(sponsors).toHaveLength(12);
    const tiers = ['local', 'regional', 'national', 'global'] as const;
    const minOf = (t: string) =>
      Math.min(...sponsors.filter((s) => s.tier === t).map((s) => s.minPrestige));
    const strengthOf = (t: string) =>
      Math.min(...sponsors.filter((s) => s.tier === t).map((s) => s.strength));
    for (let i = 1; i < tiers.length; i++) {
      expect(minOf(tiers[i]!)).toBeGreaterThan(minOf(tiers[i - 1]!));
      expect(strengthOf(tiers[i]!)).toBeGreaterThan(strengthOf(tiers[i - 1]!));
    }
    expect(new Set(sponsors.map((s) => s.id)).size).toBe(12);
  });

  it('opens up more sponsors as prestige rises', () => {
    expect(eligibleSponsors(1).every((s) => s.tier === 'local')).toBe(true);
    expect(eligibleSponsors(1).length).toBeGreaterThan(0);
    expect(eligibleSponsors(100)).toHaveLength(12);
    expect(eligibleSponsors(40).length).toBeGreaterThan(eligibleSponsors(20).length);
  });
});

describe('the title sponsor fee', () => {
  it('is $25,000 plus $700 per prestige point and $400 per fame point', () => {
    expect(titleSponsorFee(0, 0)).toBe(25_000);
    expect(titleSponsorFee(10, 0)).toBe(32_000);
    expect(titleSponsorFee(10, 50)).toBe(52_000);
  });

  it('gives a new garage about $30,000 and an established one $55,000 or more', () => {
    expect(titleSponsorFee(5, 5)).toBeGreaterThanOrEqual(30_000);
    expect(titleSponsorFee(5, 5)).toBeLessThan(35_000);
    expect(titleSponsorFee(30, 20)).toBeGreaterThanOrEqual(54_000);
  });

  it('is paid over the six rounds', () => {
    expect(feePerRound(60_000)).toBe(10_000);
    expect(feePerRound(40_000)).toBe(6667);
  });
});

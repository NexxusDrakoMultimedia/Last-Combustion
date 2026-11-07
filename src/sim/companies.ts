// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { companyBalance } from './worldgen/data';

/** The tiers of sponsors and suppliers, narrowest reach first. */
export const TIER_ORDER = ['local', 'regional', 'national', 'continental', 'global'] as const;
export type CompanyTier = (typeof TIER_ORDER)[number];

/** Sorts companies by tier (local first, global last), then alphabetically by name. */
export function byTierThenName<T extends { tier: string; name: string }>(a: T, b: T): number {
  const tiers =
    TIER_ORDER.indexOf(a.tier as CompanyTier) - TIER_ORDER.indexOf(b.tier as CompanyTier);
  return tiers !== 0 ? tiers : a.name.localeCompare(b.name, 'en');
}

/**
 * How likely a company is to be offered to a garage: more for a tier that is common, more for one
 * whose minimum prestige is close to the garage's own, and more for one the garage gets on with.
 */
export function offerWeight(
  company: { tier: string; minPrestige: number },
  prestige: number,
  relationship: number,
): number {
  const c = companyBalance;
  const tier = (c.tierWeight as Record<string, number>)[company.tier] ?? 1;
  const near = 1 / (1 + Math.abs(prestige - company.minPrestige) / c.prestigeGap);
  const liked = 1 + Math.max(0, relationship) / c.relationshipScale;
  return tier * near * liked;
}

/**
 * Draws up to `offers` companies at random, without repeats, each draw weighted as `offerWeight` says.
 * Fewer come back when fewer are to be had. The result is sorted by tier, then by name.
 */
export function drawOffers<T extends { tier: string; name: string; minPrestige: number }>(
  rng: RandomStream,
  pool: readonly T[],
  prestige: number,
  relationshipOf: (company: T) => number,
  offers: number = companyBalance.offers,
): T[] {
  const left = [...pool];
  const chosen: T[] = [];
  while (chosen.length < offers && left.length > 0) {
    const pick = rng.weighted(
      left,
      left.map((c) => offerWeight(c, prestige, relationshipOf(c))),
    );
    chosen.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return chosen.sort(byTierThenName);
}

/** Whether a company withdraws from the series this year, and for how many years (null if it stays). */
export function rollBreak(rng: RandomStream): number | null {
  if (!rng.chance(companyBalance.breakChance)) return null;
  const [lo, hi] = companyBalance.breakYears as [number, number];
  return rng.int(lo, hi);
}

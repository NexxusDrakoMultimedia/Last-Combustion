// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { AmountRange } from './scouting';
import { scoutingBalance } from './worldgen/data';

/**
 * How much of the cap table of a garage the player does not own is open to them (see "Ownership and
 * the cap table" in the GDD). It grows with the knowledge score of that garage:
 *
 * 1. who holds the majority (or, with none, who holds the most) and who the major owners are;
 * 2. every owner, by name and type, with no figures;
 * 3. each owner's stake, votes and asking price as a band that narrows as knowledge rises;
 * 4. exact share counts and figures.
 */
export type CapTier = 1 | 2 | 3 | 4;

/** A share of the whole (0 to 1) as the player reads it: it always holds the truth. */
export interface Span {
  low: number;
  high: number;
}

/** The tier a knowledge score opens. */
export function capTier(knowledge: number): CapTier {
  const t = scoutingBalance.capTable;
  const k = Math.floor(knowledge);
  if (k >= t.exact) return 4;
  if (k >= t.bands) return 3;
  if (k >= t.owners) return 2;
  return 1;
}

/**
 * How far either side of the truth a band reaches at this knowledge: null before the bands open
 * (tiers 1 and 2), 0 once the figures are exact, and otherwise the half-width of the latest step
 * reached (a tenth falling to a thousandth). For a stake, votes or a premium it is a share of the
 * whole; for money it is a share of the amount.
 */
export function capHalfWidth(knowledge: number): number | null {
  const t = scoutingBalance.capTable;
  const k = Math.floor(knowledge);
  if (k >= t.exact) return 0;
  if (k < t.bands) return null;
  let half: number | null = null;
  for (const step of t.halfWidths) if (k >= step.from) half = step.half;
  return half;
}

/**
 * A share of the whole (0 to 1) as a band `half` either side of the truth, `place` (from `placement`,
 * 0 up to just under 1) deciding where in the band the truth sits. It stays inside 0 to 1, is rounded
 * outward to the data's step so it never excludes the truth, and a smaller half-width always gives
 * a band inside the one before. Exact (one value) when `half` is 0.
 */
export function readShare(truth: number, half: number, place: number): Span {
  if (half === 0) return { low: truth, high: truth };
  const per = Math.round(1 / scoutingBalance.capTable.step);
  // Float noise (600.0000000000001 steps) is shaved off before rounding outward, and the truth
  // is put back inside the band if that shaving ever leaves it just outside.
  const clean = (v: number): number => Math.round(v * per * 1e6) / 1e6;
  const width = 2 * half;
  const low = truth - width * place;
  return {
    low: Math.max(0, Math.min(truth, Math.floor(clean(low)) / per)),
    high: Math.min(1, Math.max(truth, Math.ceil(clean(low + width)) / per)),
  };
}

/**
 * An amount of money as a band: `half` of it either side of the truth (so 0.1 is 10%), rounded outward
 * to whole dollars, with the same placement rule as `readShare`. Exact when `half` is 0.
 */
export function readMoney(truth: number, half: number, place: number): AmountRange {
  if (half === 0) return { low: truth, high: truth };
  const width = 2 * half;
  const below = width * place;
  return {
    low: Math.max(0, Math.floor(truth * (1 - below))),
    high: Math.ceil(truth * (1 + (width - below))),
  };
}

/** A band as one number for sorting and filtering, so the order never gives the truth away. */
export function spanMidpoint(span: Span | AmountRange): number {
  return (span.low + span.high) / 2;
}

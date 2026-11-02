// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { negotiationBalance } from './worldgen/data';
import { clamp } from './worldgen/rating';

const cfg = () => negotiationBalance;

/**
 * Which way a party leans in a deal. A party that `wants_more` (a driver, supplier or
 * manufacturer) will not accept less than its walk-away value. A party that `pays` (a sponsor)
 * will not pay more than its walk-away value.
 */
export type Side = 'wants_more' | 'pays';

export interface Context {
  /** -0.2 to +0.2: positive when the party that wants more is the stronger one. */
  leverage: number;
  /** -100 to +100 between the two parties. */
  relationship: number;
  /** 0 to 1: how much a rival is interested. */
  rivalInterest: number;
}

/** The leverage from the strengths (0-100) of the two parties: the stronger one gains up to 0.2. */
export function leverageFrom(strengthOfWanter: number, strengthOfPayer: number): number {
  const cap = cfg().leverageCap;
  return clamp((strengthOfWanter - strengthOfPayer) / cfg().leverageScale, -cap, cap);
}

/** m = 1 + L - 0.10 x relationship/100 + 0.20 x rival interest. */
export function multiplier(ctx: Context): number {
  const cap = cfg().leverageCap;
  return (
    1 +
    clamp(ctx.leverage, -cap, cap) -
    cfg().relationshipEffect * (clamp(ctx.relationship, -100, 100) / 100) +
    cfg().rivalEffect * clamp(ctx.rivalInterest, 0, 1)
  );
}

/** The hidden reservation value: the least a wanting party takes, or the most a paying party pays. */
export function walkAwayValue(fair: number, side: Side, ctx: Context): number {
  const m = multiplier(ctx);
  return side === 'wants_more' ? fair * m : fair / m;
}

/** How many counters a party gives before it walks away: 3, one more at 50 or better, one fewer at -50 or worse. */
export function patienceFor(relationship: number): number {
  const base = cfg().patience;
  const adjusted =
    relationship >= cfg().patienceBonusAt
      ? base + 1
      : relationship <= -cfg().patienceBonusAt
        ? base - 1
        : base;
  return Math.max(1, adjusted);
}

/** What a party asks for on its nth counter (0, 1, 2): 15%, then 7%, then 2% better than its walk-away value. */
export function counterValue(walkAway: number, side: Side, counterIndex: number): number {
  const margins = cfg().counterMargins;
  const margin = margins[Math.min(counterIndex, margins.length - 1)] ?? 0;
  return side === 'wants_more' ? walkAway * (1 + margin) : walkAway * (1 - margin);
}

export type Response =
  { kind: 'accept' } | { kind: 'counter'; value: number; patienceLeft: number } | { kind: 'walk' };

/**
 * How a party answers an offer. It accepts at or past its walk-away value; otherwise it counters
 * and loses a point of patience, or two or three for a lowball (under 80% or 60% of its value).
 * A party with no patience left walks away.
 */
export function respond(
  offer: number,
  walkAway: number,
  side: Side,
  patience: number,
  counterIndex: number,
): Response {
  const acceptable = side === 'wants_more' ? offer >= walkAway : offer <= walkAway;
  if (acceptable) return { kind: 'accept' };
  const ratio = side === 'wants_more' ? offer / walkAway : walkAway / offer;
  const [veryLow, low] = cfg().lowballWalkShare as [number, number];
  const cost = 1 + (ratio < veryLow ? 2 : ratio < low ? 1 : 0);
  const patienceLeft = patience - cost;
  if (!Number.isFinite(ratio) || ratio <= 0 || patienceLeft <= 0) return { kind: 'walk' };
  return { kind: 'counter', value: counterValue(walkAway, side, counterIndex), patienceLeft };
}

/** Relationship changes (see the GDD, "Negotiations"). */
export const relationshipChange = () => cfg().relationship;

/** Keeps a relationship score in range. */
export const clampRelationship = (score: number): number => clamp(Math.round(score), -100, 100);

/** What a driver's contract is worth per season: longer contracts are worth 5% more per extra year to the driver. */
export function contractValue(salary: number, years: number): number {
  return salary * (1 + cfg().yearsPremium * (Math.max(1, years) - 1));
}

/** The salary that gives a target contract value over some years. */
export function salaryForValue(value: number, years: number): number {
  return Math.round(value / (1 + cfg().yearsPremium * (Math.max(1, years) - 1)));
}

/** The release fee for buying a driver out of a contract: half the salary for each year left. */
export function releaseFee(salary: number, yearsLeft: number): number {
  return Math.round(cfg().releaseFeeShare * salary * Math.max(0, yearsLeft));
}

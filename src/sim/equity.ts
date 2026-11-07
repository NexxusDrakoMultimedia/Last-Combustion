// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { equityData } from './worldgen/data';

export type ShareClass = keyof typeof equityData.classes;
export const SHARE_CLASSES = Object.keys(equityData.classes) as ShareClass[];
export const FOUNDING_SHARES = equityData.shares;

export type HolderType = 'owner' | 'family' | 'investor' | 'sponsor' | 'manufacturer';

export interface ValuationInput {
  cash: number;
  /** What the garage's cars are worth. */
  cars: number;
  /** The yearly profit of up to the last three closed years, newest first (missing years are left out). */
  yearlyProfits: readonly number[];
  fans: number;
  prestige: number;
  /** Titles in the trophy cabinet. */
  titles: number;
}

export interface Valuation {
  cash: number;
  cars: number;
  profit: number;
  fans: number;
  prestige: number;
  titles: number;
  total: number;
}

/**
 * What a garage is worth: cash, its cars, four times its average yearly profit over three years (never
 * less than zero), $20 a fan, $2,000 times prestige squared and $50,000 for each title.
 */
export function valuationOf(input: ValuationInput): Valuation {
  const c = equityData.valuation;
  const years = input.yearlyProfits.slice(0, c.profitYears);
  const average = years.length === 0 ? 0 : years.reduce((a, b) => a + b, 0) / years.length;
  const parts = {
    cash: input.cash,
    cars: input.cars,
    profit: Math.round(Math.max(0, average) * c.profitMultiple),
    fans: Math.round(input.fans * c.perFan),
    prestige: Math.round(input.prestige ** 2 * c.perPrestigeSquared),
    titles: input.titles * c.perTitle,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { ...parts, total };
}

export interface HolderSpec {
  type: HolderType;
  /** A sponsor's or manufacturer's id, for a holder that is one. */
  refId: number | null;
  name: string;
  class: ShareClass;
  shares: number;
}

export interface DrawContext {
  founder: string;
  /** A given name for a relative of the founder, who shares the surname. */
  relative: () => string;
  surname: string;
  /** A fictional business person for an outside investor. */
  investor: () => string;
  sponsors: readonly { id: number; name: string }[];
  manufacturers: readonly { id: number; name: string }[];
}

/**
 * The starting owners of a computer garage: most belong to their founder and family, a fifth have an
 * outside investor on preferred shares, and a few are held in part by a sponsor or a manufacturer.
 * The shares always add up to the founding capital.
 */
export function drawCapTable(rng: RandomStream, ctx: DrawContext): HolderSpec[] {
  const c = equityData.computerGarages;
  const total = FOUNDING_SHARES;
  const outside: HolderSpec[] = [];
  const kind = rng.float(0, 1);
  const between = ([lo, hi]: readonly number[]) => rng.float(lo as number, hi as number);
  const family: HolderSpec[] = [];
  if (kind < c.familyShare) {
    const founderStake = between(c.founderStake);
    const members = rng.int(c.familyMembers[0] as number, c.familyMembers[1] as number);
    if (founderStake < 1) {
      const each = Math.floor((total * (1 - founderStake)) / members);
      for (let i = 0; i < members; i++)
        family.push({
          type: 'family',
          refId: null,
          name: `${ctx.relative()} ${ctx.surname}`,
          class: 'ordinary',
          shares: each,
        });
    }
  } else if (kind < c.familyShare + c.investorShare) {
    const outsideStake = between(c.investorStake);
    outside.push({
      type: 'investor',
      refId: null,
      name: ctx.investor(),
      class: 'preferred',
      shares: Math.floor(total * outsideStake),
    });
  } else {
    const outsideStake = between(c.strategicStake);
    const maker = rng.chance(c.manufacturerShare) && ctx.manufacturers.length > 0;
    const pool = maker ? ctx.manufacturers : ctx.sponsors;
    const holder = pool.length > 0 ? rng.pick([...pool]) : undefined;
    if (holder)
      outside.push({
        type: maker ? 'manufacturer' : 'sponsor',
        refId: holder.id,
        name: holder.name,
        class: 'ordinary',
        shares: Math.floor(total * outsideStake),
      });
  }
  const others = [...family, ...outside];
  const founderShares = total - others.reduce((sum, h) => sum + h.shares, 0);
  return [
    { type: 'owner', refId: null, name: ctx.founder, class: 'ordinary', shares: founderShares },
    ...others,
  ];
}

export interface Holding {
  shares: number;
  class: ShareClass;
}

/** The shares that are issued (ordinary and preferred) and the whole once the option pool is counted. */
export function shareTotals(holdings: readonly Holding[]): {
  outstanding: number;
  diluted: number;
} {
  const outstanding = holdings
    .filter((h) => h.class !== 'option')
    .reduce((sum, h) => sum + h.shares, 0);
  const diluted = holdings.reduce((sum, h) => sum + h.shares, 0);
  return { outstanding, diluted };
}

/** The votes a holding carries. */
export const votesOf = (h: Holding): number =>
  h.shares * (equityData.classes[h.class] as { votes: number }).votes;

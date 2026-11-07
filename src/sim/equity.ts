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

/** The name of a funding round by its order: Seed, Series A, Series B and so on. */
export function roundName(order: number): string {
  const names = equityData.rounds.names;
  return names[Math.min(order, names.length) - 1] ?? names[names.length - 1]!;
}

export interface InvestorOffer {
  name: string;
  /** How much they believe in the garage, as a multiple of its valuation. */
  appetite: number;
}

/** The investors on offer for a round: fictional business people, each valuing the garage a little differently. */
export function drawInvestors(rng: RandomStream, names: () => string): InvestorOffer[] {
  const [lo, hi] = equityData.rounds.appetite as [number, number];
  return Array.from({ length: equityData.rounds.offers }, () => ({
    name: names(),
    appetite: Math.round(rng.float(lo, hi) * 100) / 100,
  }));
}

export interface RoundTerms {
  /** The share of the garage (of its issued shares once the round is done) that the investor gets. */
  stake: number;
  newShares: number;
  pricePerShare: number;
  /** What the investor values the garage at before and after the money goes in. */
  preMoney: number;
  postMoney: number;
}

/**
 * What an investor offers for a round: for `amount` they get the share of the garage that the money is
 * of its value to them after it goes in, `amount ÷ (valuation × appetite + amount)`, as newly issued shares.
 */
export function roundTerms(
  valuation: number,
  issued: number,
  amount: number,
  appetite: number,
): RoundTerms {
  const preMoney = Math.max(0, valuation) * appetite;
  const postMoney = preMoney + amount;
  const stake = postMoney === 0 ? 0 : amount / postMoney;
  const newShares = stake >= 1 ? 0 : Math.max(1, Math.round((issued * stake) / (1 - stake)));
  return {
    stake,
    newShares,
    pricePerShare: newShares === 0 ? 0 : amount / newShares,
    preMoney,
    postMoney,
  };
}

export const MIN_ROUND = equityData.rounds.minAmount;
export const MAX_ROUND_STAKE = equityData.rounds.maxStake;

/**
 * Splits a dividend between the holders of ordinary and preferred shares in proportion to their shares.
 * The parts are whole dollars that add up to the dividend; the odd dollars go to the biggest holdings.
 */
export function splitDividend(
  holdings: readonly { id: number; shares: number; class: ShareClass }[],
  total: number,
): Map<number, number> {
  const paying = holdings.filter((h) => h.class !== 'option');
  const shares = paying.reduce((sum, h) => sum + h.shares, 0);
  const out = new Map<number, number>();
  if (shares === 0 || total <= 0) return out;
  let given = 0;
  for (const h of paying) {
    const part = Math.floor((total * h.shares) / shares);
    out.set(h.id, part);
    given += part;
  }
  let left = total - given;
  for (const h of [...paying].sort((a, b) => b.shares - a.shares || a.id - b.id)) {
    if (left <= 0) break;
    out.set(h.id, (out.get(h.id) ?? 0) + 1);
    left--;
  }
  return out;
}

/** What shares are worth now when bought or sold at the garage's valuation, in whole dollars. */
export const sharesPrice = (valuation: number, issued: number, shares: number): number =>
  issued === 0 ? 0 : Math.round((Math.max(0, valuation) * shares) / issued);

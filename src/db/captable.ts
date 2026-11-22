// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  capHalfWidth,
  capTier,
  readMoney,
  readShare,
  spanMidpoint,
  type CapTier,
  type Span,
} from '../sim/capfog';
import type { ShareClass } from '../sim/equity';
import { placement, type AmountRange } from '../sim/scouting';
import { equityData, scoutingBalance } from '../sim/worldgen/data';
import { all } from './entries';
import { shareholderProfileId } from './equity';
import {
  investmentTargetsTruth,
  investmentTruth,
  takeoverOpen,
  trueTakeoverQuote,
  wealthTruth,
  type InvestmentHolderTruth,
} from './investments';
import { garageKnowledge, knowledgeContext, type KnowledgeContext } from './knowledge';

/*
 * The cap table of a garage the player does not own, as the player reads it (see "Ownership and the
 * cap table" in the GDD). Everything here is a READING: the true shares, votes, premiums and prices
 * stay in `investments.ts` and decide only what really happens when the player buys a stake or
 * launches a bid. A screen takes the readings in this file and never the truth.
 */

/** One holder of a garage as the player reads them. A figure is null while the tiers have not opened it. */
export interface CapHolderReading {
  /** The holding's id, which a purchase names. */
  id: number;
  /** The id of the holder's profile in the Registry. */
  profileId: number;
  name: string;
  /** The kind of holder: from the second tier, null before it. */
  type: string | null;
  /** The share class: from the third tier (with the figures), null before it. */
  class: ShareClass | null;
  /** The player's own holding: every figure of it is exact. */
  mine: boolean;
  /** Holds a major share (`majorFrom` in `data/scouting.json`) of the votes or of the issued shares. */
  major: boolean;
  /** Holds more than half of the votes. */
  majority: boolean;
  /** Their share of the issued shares, as a band. */
  stake: Span | null;
  /** Their share of the votes, as a band. */
  votes: Span | null;
  /** The premium over its worth they ask to sell at, as a band. */
  premium: Span | null;
  /** What the whole holding costs at that premium, as a band. */
  asking: AmountRange | null;
  /** The number of shares: only when everything is exact. */
  shares: number | null;
}

export interface CapTableReading {
  garageId: number;
  name: string;
  /** The knowledge score of the garage (0 to 100) and the tier it opens. */
  knowledge: number;
  tier: CapTier;
  /** Someone holds more than half of the votes. */
  hasMajority: boolean;
  /** The name of the majority holder, or of the largest holder when nobody has a majority. */
  leader: string | null;
  /** Who is shown: the majors at first, then everyone. Sorted by name until the bands open, then by their midpoint. */
  holders: CapHolderReading[];
  /** What the garage is worth, as a band. */
  valuation: AmountRange | null;
  /** The issued shares: only when everything is exact. */
  issued: number | null;
  /** The share of the issued shares the player holds (exact), and what that is worth as a band. */
  mineStake: number;
  mineWorth: AmountRange | null;
  /** Takeovers are only launched between seasons. */
  takeoverOpen: boolean;
}

/** The knowledge score of a garage: 100 for the player's own (and for every garage when there is no player yet). */
export function capKnowledge(db: Database, garageId: number, ctx?: KnowledgeContext): number {
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!player || player.id === garageId) return 100;
  const g = all(db, 'SELECT prestige, fans FROM garage WHERE id = ?', [garageId])[0];
  if (!g) throw new Error(`There is no garage ${garageId}.`);
  return garageKnowledge(ctx ?? knowledgeContext(db, player.id as number), {
    id: garageId,
    prestige: g.prestige as number,
    fans: g.fans as number,
  });
}

/** Where the truth sits in a band: drawn once for each figure of a garage in a year, so it never changes on a reload. */
const bandPlace = (ctx: KnowledgeContext | undefined, garageId: number, key: string): number =>
  ctx ? placement(ctx.seed, { kind: 'garages', id: garageId }, ctx.year, `cap:${key}`) : 0;

const playerContext = (db: Database): KnowledgeContext | undefined => {
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  return player ? knowledgeContext(db, player.id as number) : undefined;
};

/**
 * What the player reads of the cap table of a garage that is not theirs. Refuses a garage that cannot
 * be invested in (the player's own, a closed one, or none).
 */
export function readCapTable(
  db: Database,
  garageId: number,
  known?: KnowledgeContext,
): CapTableReading {
  const ctx = known ?? playerContext(db);
  return readCapTableAt(db, garageId, ctx ? capKnowledge(db, garageId, ctx) : 100, ctx);
}

/**
 * The cap table as it reads at a given knowledge score (0 to 100): what `readCapTable` does once it
 * has worked the score out. The bands are drawn from the career's seed, so the same score always reads
 * the same, and a higher score always reads inside a lower one.
 */
export function readCapTableAt(
  db: Database,
  garageId: number,
  knowledge: number,
  known?: KnowledgeContext,
): CapTableReading {
  const truth = investmentTruth(db, garageId);
  const ctx = known ?? playerContext(db);
  const tier = capTier(knowledge);
  const half = capHalfWidth(knowledge);
  const place = (key: string): number => bandPlace(ctx, garageId, key);
  const majorFrom = scoutingBalance.capTable.majorFrom;
  const majorityHolder = truth.holders.find((h) => h.votes > equityData.control.majority);
  const largest = truth.holders
    .filter((h) => !h.mine && h.class !== 'option')
    .reduce<InvestmentHolderTruth | undefined>(
      (best, h) =>
        !best || h.votes > best.votes || (h.votes === best.votes && h.stake > best.stake)
          ? h
          : best,
      undefined,
    );

  const read = (h: InvestmentHolderTruth): CapHolderReading | undefined => {
    const major = h.votes >= majorFrom || h.stake >= majorFrom;
    if (!(h.mine || tier >= 3 || (tier === 2 && h.class !== 'option') || major)) return undefined;
    // What the player owns is exact at every tier; for everyone else a band opens with the third tier.
    const width = h.mine || half === 0 ? 0 : half;
    return {
      id: h.id,
      profileId: shareholderProfileId(db, h.id),
      name: h.name,
      type: h.mine || tier >= 2 ? h.type : null,
      class: h.mine || tier >= 3 ? h.class : null,
      mine: h.mine,
      major,
      majority: h.votes > equityData.control.majority,
      stake: width === null ? null : readShare(h.stake, width, place(`${h.id}:stake`)),
      votes: width === null ? null : readShare(h.votes, width, place(`${h.id}:votes`)),
      premium:
        h.mine || width === null || h.class === 'option'
          ? null
          : readShare(h.reserve, width, place(`${h.id}:premium`)),
      asking:
        h.mine || width === null || h.class === 'option'
          ? null
          : readMoney(h.asking, width, place(`${h.id}:asking`)),
      shares: width === 0 ? h.shares : null,
    };
  };
  const rows = truth.holders.map(read).filter((r): r is CapHolderReading => r !== undefined);
  // Sorted by what the player can read, never by the truth: their own first, then by the midpoint
  // of the band (once there is one), then by name.
  rows.sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    if (a.stake && b.stake) {
      const d = spanMidpoint(b.stake) - spanMidpoint(a.stake);
      if (d !== 0) return d;
    }
    return a.name.localeCompare(b.name) || a.id - b.id;
  });
  const mineShares = truth.holders
    .filter((h) => h.mine && h.class !== 'option')
    .reduce((s, h) => s + h.shares, 0);
  const mineStake = truth.issued === 0 ? 0 : mineShares / truth.issued;
  const valuation = half === null ? null : readMoney(truth.valuation, half, place('valuation'));
  return {
    garageId,
    name: truth.name,
    knowledge,
    tier,
    hasMajority: majorityHolder !== undefined,
    leader: (majorityHolder ?? largest)?.name ?? null,
    holders: rows,
    valuation,
    issued: half === 0 ? truth.issued : null,
    mineStake,
    mineWorth: valuation && scaled(valuation, mineStake),
    takeoverOpen: truth.takeoverOpen,
  };
}

/** A band of money times a fraction, rounded outward. */
const scaled = (range: AmountRange, fraction: number): AmountRange => ({
  low: Math.floor(range.low * fraction),
  high: Math.ceil(range.high * fraction),
});

/** A computer garage the player could invest in: its worth as a band (once it can be read) and the player's exact stake. */
export interface InvestmentTargetReading {
  id: number;
  name: string;
  valuation: AmountRange | null;
  stake: number;
}

export function readInvestmentTargets(db: Database): InvestmentTargetReading[] {
  const ctx = playerContext(db);
  return investmentTargetsTruth(db).map((t) => {
    const half = capHalfWidth(ctx ? capKnowledge(db, t.id, ctx) : 100);
    return {
      id: t.id,
      name: t.name,
      valuation:
        half === null ? null : readMoney(t.valuation, half, bandPlace(ctx, t.id, 'valuation')),
      stake: t.stake,
    };
  });
}

/** How a bid is likely to go. `unknown` means the bands are not open yet. */
export type Outlook = 'carries' | 'fails' | 'uncertain' | 'unknown';

export interface TakeoverEstimate {
  premium: number;
  knowledge: number;
  /** What the rest of the garage would cost, as a band. */
  cost: AmountRange | null;
  /** The share of the votes that would accept, as a band. */
  votes: Span | null;
  /** Whether the bid would carry: sure only when the whole band is on one side of the line. */
  outlook: Outlook;
  /** Whether the board would back it, on the same terms. */
  board: 'supports' | 'fights' | 'uncertain' | 'unknown';
  open: boolean;
}

/**
 * What the player can tell of a bid before they commit, worked out from the readings alone: a holder
 * surely accepts when the top of their premium band is under the bid and surely refuses when the
 * bottom is over it, so changing the premium never shows a holder's true premium. The real cost and
 * result are decided only when the bid is launched (`launchTakeover`).
 */
export function readTakeover(db: Database, targetId: number, premium: number): TakeoverEstimate {
  return estimateBid(db, readCapTable(db, targetId), premium);
}

/** The same estimate at a given knowledge score of the garage (see `readCapTableAt`). */
export function readTakeoverAt(
  db: Database,
  targetId: number,
  premium: number,
  knowledge: number,
): TakeoverEstimate {
  return estimateBid(db, readCapTableAt(db, targetId, knowledge), premium);
}

function estimateBid(db: Database, table: CapTableReading, premium: number): TakeoverEstimate {
  const targetId = table.garageId;
  const base = { premium, knowledge: table.knowledge, open: takeoverOpen(db) };
  if (table.valuation === null || table.tier < 3)
    return { ...base, cost: null, votes: null, outlook: 'unknown', board: 'unknown' };
  const scale = (1 + premium) * (1 - table.mineStake);
  const trueCost = trueTakeoverQuote(db, targetId, premium).cost;
  // The cost is the rest of the garage at the bid, so it follows the valuation band. The truth is
  // added to the band's edges only to cover the rounding of each holder's price.
  const cost: AmountRange =
    table.tier === 4
      ? { low: trueCost, high: trueCost }
      : {
          low: Math.min(Math.floor(table.valuation.low * scale), trueCost),
          high: Math.max(Math.ceil(table.valuation.high * scale), trueCost),
        };
  let surely = 0;
  let maybe = 0;
  for (const h of table.holders) {
    if (!h.votes) continue;
    const accepts = h.mine || (h.premium !== null && h.premium.high <= premium);
    const might = accepts || (h.premium !== null && h.premium.low <= premium);
    if (accepts) surely += h.votes.low;
    if (might) maybe += h.votes.high;
  }
  const votes: Span = { low: Math.min(1, surely), high: Math.min(1, maybe) };
  const need = equityData.holdings.takeoverVotes;
  const outlook: Outlook =
    votes.low > need ? 'carries' : votes.high <= need ? 'fails' : 'uncertain';
  // The board is the founder and any outside holder with a tenth of the issued shares.
  let fights = false;
  let backs = true;
  for (const h of table.holders) {
    if (h.mine || h.class === 'option' || !h.stake || !h.premium) continue;
    const sure = h.type === 'owner' || h.stake.low >= equityData.control.directorStake;
    if (!sure && h.stake.high < equityData.control.directorStake) continue;
    if (sure && h.premium.low > premium) fights = true;
    if (h.premium.high > premium) backs = false;
  }
  return {
    ...base,
    cost,
    votes,
    outlook,
    board: backs ? 'supports' : fights ? 'fights' : 'uncertain',
  };
}

/** A holding of the player in another garage: the shares and stake are exact, what they are worth is a band. */
export interface HoldingReading {
  garageId: number;
  name: string;
  class: ShareClass;
  shares: number;
  stake: number;
  worth: AmountRange | null;
}

export interface WealthReading {
  personalCash: number;
  holdings: HoldingReading[];
  /** What all the holdings are worth, and with the cash: bands, or null while any cannot be read yet. */
  holdingsWorth: AmountRange | null;
  total: AmountRange | null;
}

/** The owner's wealth outside the garage. */
export function readWealth(db: Database, playerId: number): WealthReading {
  const w = wealthTruth(db, playerId);
  const ctx = knowledgeContext(db, playerId);
  const holdings = w.holdings.map((h): HoldingReading => {
    const half = capHalfWidth(capKnowledge(db, h.garageId, ctx));
    const truth = investmentTruth(db, h.garageId);
    const fraction = truth.issued === 0 ? 0 : h.shares / truth.issued;
    const value =
      half === null
        ? null
        : readMoney(truth.valuation, half, bandPlace(ctx, h.garageId, 'valuation'));
    return {
      garageId: h.garageId,
      name: h.name,
      class: h.class,
      shares: h.shares,
      stake: h.stake,
      worth: value && scaled(value, fraction),
    };
  });
  const holdingsWorth: AmountRange | null = holdings.every((h) => h.worth !== null)
    ? {
        low: holdings.reduce((s, h) => s + h.worth!.low, 0),
        high: holdings.reduce((s, h) => s + h.worth!.high, 0),
      }
    : null;
  return {
    personalCash: w.personalCash,
    holdings,
    holdingsWorth,
    total: holdingsWorth && {
      low: w.personalCash + holdingsWorth.low,
      high: w.personalCash + holdingsWorth.high,
    },
  };
}

/** How much the player can see of one holding in a garage: nothing (undefined), all of it (holder null), or the reading. */
export interface HoldingSight {
  holder: CapHolderReading | null;
  valuation: AmountRange | null;
}

/**
 * A lookup for the places that list who holds what (the Registry's shareholders and companies): given a
 * garage and a holding it says whether the player can see that holding yet, and if so how. Holdings in
 * the player's own garage, in a garage that has closed, or with no player yet are fully visible. The
 * cap tables are read once each, however many holdings are asked about.
 */
export function holdingSighter(
  db: Database,
): (garageId: number, holdingId: number) => HoldingSight | undefined {
  const ctx = playerContext(db);
  const tables = new Map<number, CapTableReading | null>();
  const tableOf = (garageId: number): CapTableReading | null => {
    if (!ctx || ctx.garageId === garageId) return null;
    const known = tables.get(garageId);
    if (known !== undefined) return known;
    let table: CapTableReading | null;
    try {
      table = readCapTable(db, garageId, ctx);
    } catch {
      table = null; // a garage that has closed has nothing left to hide
    }
    tables.set(garageId, table);
    return table;
  };
  return (garageId, holdingId) => {
    const table = tableOf(garageId);
    if (!table) return { holder: null, valuation: null };
    const holder = table.holders.find((h) => h.id === holdingId);
    return holder ? { holder, valuation: table.valuation } : undefined;
  };
}

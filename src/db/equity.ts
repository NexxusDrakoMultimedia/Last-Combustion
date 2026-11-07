// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  FOUNDING_SHARES,
  MAX_ROUND_STAKE,
  MIN_ROUND,
  boardOf,
  controlOf,
  drawCapTable,
  drawInvestors,
  noConfidence,
  roundName,
  roundTerms,
  shareTotals,
  sharesPrice,
  seasonTarget,
  splitDividend,
  targetMet,
  valuationOf,
  votesOf,
  type ControlView,
  type Director,
  type HolderType,
  type InvestorOffer,
  type RoundTerms,
  type ShareClass,
  type Valuation,
} from '../sim/equity';
import { financialYear } from '../sim/ledger';
import { createRng } from '../sim/rng';
import { equityData, nameLists } from '../sim/worldgen/data';
import { ownerSurname, pickNationality, personName } from '../sim/worldgen/names';
import { readCareer } from './career';
import { all } from './entries';
import { closedYearProfits } from './ledger';
import { valueOfCar } from './market';

/** Replaces a garage's holdings with the owner holding all of its shares (a garage the player founds). */
export function setSoleOwner(db: Database, garageId: number, owner: string, date: string): void {
  db.run('DELETE FROM shareholding WHERE garage_id = ?', [garageId]);
  db.run(
    `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
     VALUES (?, 'owner', 1, ?, 'ordinary', ?, 0, ?)`,
    [garageId, owner, FOUNDING_SHARES, date],
  );
}

/** What a garage is worth now. */
export function garageValuation(db: Database, garageId: number): Valuation {
  const garage = all(db, 'SELECT cash, fans, prestige FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const cars = all(db, 'SELECT id FROM car WHERE garage_id = ?', [garageId]).reduce(
    (sum, c) => sum + valueOfCar(db, c.id as number),
    0,
  );
  const titles = Number(
    all(
      db,
      'SELECT COUNT(*) AS n FROM season WHERE champion_garage_id = ? OR champion_driver_garage_id = ?',
      [garageId, garageId],
    )[0]!.n,
  );
  return valuationOf({
    cash: garage.cash as number,
    cars,
    yearlyProfits: closedYearProfits(db, garageId, equityData.valuation.profitYears),
    fans: garage.fans as number,
    prestige: garage.prestige as number,
    titles,
  });
}

/**
 * Gives every racing garage that has no holdings its cap table: the player's garage belongs to its
 * owner, and a computer garage gets starting owners drawn from the career's seed (so the same save
 * always has the same owners). Running it again changes nothing.
 */
export function ensureCapTables(db: Database): void {
  const career = readCareer(db);
  if (!career) return;
  const missing = all(
    db,
    `SELECT g.id, g.name, g.flag, g.is_player, o.name AS owner FROM garage g LEFT JOIN owner o ON o.garage_id = g.id
      WHERE g.kind = 'racing' AND g.acquired_by IS NULL
        AND NOT EXISTS (SELECT 1 FROM shareholding s WHERE s.garage_id = g.id)
      ORDER BY g.id`,
  );
  if (missing.length === 0) return;
  const sponsors = all(db, 'SELECT id, name FROM sponsor ORDER BY id').map((r) => ({
    id: r.id as number,
    name: r.name as string,
  }));
  const manufacturers = all(db, 'SELECT id, name FROM manufacturer ORDER BY id').map((r) => ({
    id: r.id as number,
    name: r.name as string,
  }));
  const rng = createRng(career.masterSeed);
  for (const g of missing) {
    const garageId = g.id as number;
    if (g.is_player === 1 && g.owner) {
      setSoleOwner(db, garageId, g.owner as string, career.gameDate);
      continue;
    }
    const stream = rng.stream(`cap:${garageId}`);
    const home = nameLists.byNationality[g.flag as string]
      ? (g.flag as string)
      : pickNationality(stream);
    const person = (nationality: string) =>
      personName(stream, nationality, stream.chance(0.5) ? 'male' : 'female');
    const drawn = person(home);
    // A garage with a family name in its name belongs to someone with that name.
    const shared = ownerSurname(
      rng.stream(`capname:${garageId}`),
      g.name as string,
      nameLists.byNationality[g.flag as string] ? (g.flag as string) : home,
    );
    const founder = shared ? `${drawn.split(' ')[0] as string} ${shared}` : drawn;
    const holders = drawCapTable(stream, {
      founder,
      surname: founder.split(' ').slice(1).join(' '),
      relative: () => person(home).split(' ')[0] as string,
      investor: () => person(pickNationality(stream)),
      sponsors,
      manufacturers,
    });
    const value = garageValuation(db, garageId).total;
    for (const h of holders)
      db.run(
        `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          garageId,
          h.type,
          h.refId,
          h.name,
          h.class,
          h.shares,
          // An outside holder paid the going price for their stake; founders and family paid nothing.
          h.type === 'owner' || h.type === 'family'
            ? 0
            : Math.round((value * h.shares) / FOUNDING_SHARES),
          career.gameDate,
        ],
      );
  }
}

/** Writes the value of every racing garage on a date, so a garage's worth can be followed over the years. */
export function recordValuations(db: Database, date: string): void {
  for (const g of all(db, "SELECT id FROM garage WHERE kind = 'racing' ORDER BY id"))
    db.run('INSERT OR REPLACE INTO valuation (garage_id, date, value) VALUES (?, ?, ?)', [
      g.id as number,
      date,
      garageValuation(db, g.id as number).total,
    ]);
}

/** The Registry profile id of the shareholder a holding belongs to (the first holding they have). */
export function shareholderProfileId(db: Database, holdingId: number): number {
  return Number(
    all(
      db,
      `SELECT MIN(b.id) AS id FROM shareholding a JOIN shareholding b
         ON b.holder_type = a.holder_type AND b.holder_name = a.holder_name
        AND COALESCE(b.holder_id, -1) = COALESCE(a.holder_id, -1)
      WHERE a.id = ?`,
      [holdingId],
    )[0]?.id ?? holdingId,
  );
}

export interface HolderView {
  id: number;
  /** The id of the holder's profile in the Registry. */
  profileId: number;
  type: HolderType | 'executive' | 'driver' | 'garage' | 'bank' | 'public';
  name: string;
  class: ShareClass;
  shares: number;
  /** Shares of the issued shares (ordinary and preferred), as a share from 0 to 1. */
  stake: number;
  /** Shares of the whole once the option pool is counted. */
  diluted: number;
  /** Votes as a share of all votes (only ordinary shares vote). */
  votes: number;
  paid: number;
  since: string;
}

export interface OwnershipView {
  garageId: number;
  garageName: string;
  valuation: Valuation;
  /** What one share is worth now: the valuation over the issued shares. */
  sharePrice: number;
  issued: number;
  holders: HolderView[];
  history: { date: string; value: number }[];
  /** The next funding round: its name, the investors on offer and the limits. */
  round: {
    name: string;
    investors: InvestorOffer[];
    available: boolean;
    minAmount: number;
    maxStake: number;
  };
  /** The dividend the board suggests, and whether one can still be paid this financial year. */
  dividend: { suggested: number; available: boolean; cash: number };
  /** The owner's own cash, from dividends, which buys shares back. */
  ownerCash: number;
  /** Funding rounds, dividends and buy-backs, newest first. */
  events: ShareEventView[];
  /** Who controls the garage, who sits on its board, and the season targets the board has set. */
  control: ControlView;
  board: Director[];
  targets: BoardTargetView[];
}

/** Who owns a garage, what it is worth, and how its value has moved. */
export function ownershipView(db: Database, garageId: number): OwnershipView {
  ensureCapTables(db);
  const garage = all(db, 'SELECT name FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const rows = all(
    db,
    `SELECT id, holder_type, holder_name, class, shares, paid, since FROM shareholding
      WHERE garage_id = ? ORDER BY CASE class WHEN 'ordinary' THEN 0 WHEN 'preferred' THEN 1 ELSE 2 END, shares DESC, id`,
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    type: r.holder_type as HolderView['type'],
    name: r.holder_name as string,
    class: r.class as ShareClass,
    shares: r.shares as number,
    paid: r.paid as number,
    since: r.since as string,
  }));
  const totals = shareTotals(rows);
  const votes = rows.reduce((sum, r) => sum + votesOf(r), 0);
  const valuation = garageValuation(db, garageId);
  const next = roundInvestors(db, garageId);
  const isPlayer =
    all(db, 'SELECT is_player FROM garage WHERE id = ?', [garageId])[0]?.is_player === 1;
  return {
    garageId,
    garageName: garage.name as string,
    valuation,
    sharePrice: totals.outstanding === 0 ? 0 : valuation.total / totals.outstanding,
    issued: totals.outstanding,
    holders: rows.map((r) => ({
      ...r,
      profileId: shareholderProfileId(db, r.id),
      stake: r.class === 'option' || totals.outstanding === 0 ? 0 : r.shares / totals.outstanding,
      diluted: totals.diluted === 0 ? 0 : r.shares / totals.diluted,
      votes: votes === 0 ? 0 : votesOf(r) / votes,
    })),
    history: all(db, 'SELECT date, value FROM valuation WHERE garage_id = ? ORDER BY date', [
      garageId,
    ]).map((r) => ({ date: r.date as string, value: r.value as number })),
    round: {
      name: roundName(next.order),
      investors: next.investors,
      available: isPlayer && !doneThisYear(db, garageId, 'round'),
      minAmount: MIN_ROUND,
      maxStake: MAX_ROUND_STAKE,
    },
    dividend: {
      suggested: suggestedDividend(db, garageId),
      available: isPlayer && !doneThisYear(db, garageId, 'dividend'),
      cash: Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash),
    },
    ownerCash: Number(
      all(db, 'SELECT personal_cash FROM owner WHERE garage_id = ?', [garageId])[0]
        ?.personal_cash ?? 0,
    ),
    events: events(db, garageId),
    control: controlView(db, garageId),
    board: boardView(db, garageId),
    targets: boardTargets(db, garageId),
  };
}

// ---- What the owner can do with the shares: raise money, pay a dividend, buy shares back ----

export interface ShareEventView {
  id: number;
  date: string;
  kind: 'round' | 'dividend' | 'buyback' | 'stake' | 'takeover';
  detail: Record<string, unknown>;
}

const gameDate = (db: Database): string => readCareer(db)?.gameDate ?? '';

function playerGarage(db: Database, garageId: number): void {
  const g = all(db, 'SELECT is_player, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!g || g.kind !== 'racing' || g.is_player !== 1)
    throw new Error('Only the player’s garage can do this.');
}

function events(db: Database, garageId: number): ShareEventView[] {
  return all(
    db,
    'SELECT id, date, kind, detail FROM share_event WHERE garage_id = ? ORDER BY date DESC, id DESC',
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    date: r.date as string,
    kind: r.kind as ShareEventView['kind'],
    detail: JSON.parse(r.detail as string) as Record<string, unknown>,
  }));
}

/** The investors on offer for the garage's next round. They stay the same until a round is done. */
export function roundInvestors(
  db: Database,
  garageId: number,
): { order: number; investors: InvestorOffer[] } {
  const career = readCareer(db);
  const order =
    Number(
      all(db, "SELECT COUNT(*) AS n FROM share_event WHERE garage_id = ? AND kind = 'round'", [
        garageId,
      ])[0]!.n,
    ) + 1;
  if (!career) return { order, investors: [] };
  const stream = createRng(career.masterSeed).stream(`investors:${garageId}:${order}`);
  return {
    order,
    investors: drawInvestors(stream, () =>
      personName(stream, pickNationality(stream), stream.chance(0.5) ? 'male' : 'female'),
    ),
  };
}

const doneThisYear = (db: Database, garageId: number, kind: ShareEventView['kind']): boolean =>
  events(db, garageId).some(
    (e) => e.kind === kind && financialYear(e.date) === financialYear(gameDate(db)),
  );

/** What a round of this size would give each investor, for the screen to show before the player agrees. */
export function previewRound(
  db: Database,
  garageId: number,
  investor: number,
  amount: number,
): RoundTerms {
  const offer = roundInvestors(db, garageId).investors[investor];
  if (!offer) throw new Error('There is no such investor.');
  const issued = shareTotals(
    all(db, 'SELECT shares, class FROM shareholding WHERE garage_id = ?', [garageId]).map((r) => ({
      shares: r.shares as number,
      class: r.class as ShareClass,
    })),
  ).outstanding;
  return roundTerms(garageValuation(db, garageId).total, issued, amount, offer.appetite);
}

/**
 * Raises money by issuing new preferred shares to one of the investors on offer. The investor gets the
 * stake their money is worth to them, which dilutes every other holder. One round a financial year, no
 * less than the minimum and no more than the share of the garage that may be given away at once.
 */
export function issueShares(
  db: Database,
  garageId: number,
  investor: number,
  amount: number,
): RoundTerms {
  playerGarage(db, garageId);
  ensureCapTables(db);
  amount = Math.round(amount);
  if (!(amount >= MIN_ROUND)) throw new Error(`A round raises at least ${MIN_ROUND}.`);
  if (doneThisYear(db, garageId, 'round'))
    throw new Error('The garage has already raised money this year.');
  const { order, investors } = roundInvestors(db, garageId);
  const offer = investors[investor];
  if (!offer) throw new Error('There is no such investor.');
  const terms = previewRound(db, garageId, investor, amount);
  if (terms.stake > MAX_ROUND_STAKE)
    throw new Error('That gives away too much of the garage in one round.');
  // Issuing shares is a reserved matter: a holder with a blocking minority of the votes can refuse it.
  const blocker = controlView(db, garageId).blockers[0];
  if (blocker) throw new Error(`${blocker.name} holds a blocking minority and vetoes new shares.`);
  const date = gameDate(db);
  db.exec('BEGIN');
  try {
    db.run(
      `INSERT INTO shareholding (garage_id, holder_type, holder_name, class, shares, paid, since)
       VALUES (?, 'investor', ?, ?, ?, ?, ?)`,
      [garageId, offer.name, offer.class, terms.newShares, amount, date],
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'share_issue', ?, ?)",
      [garageId, date, amount, `${roundName(order)} round`],
    );
    db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [amount, garageId]);
    db.run("INSERT INTO share_event (garage_id, date, kind, detail) VALUES (?, ?, 'round', ?)", [
      garageId,
      date,
      JSON.stringify({
        round: roundName(order),
        investor: offer.name,
        class: offer.class,
        amount,
        shares: terms.newShares,
        stake: terms.stake,
        preMoney: terms.preMoney,
      }),
    ]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return terms;
}

/** What the board suggests paying out: half of the last closed year's operating profit, within the cash. */
export function suggestedDividend(db: Database, garageId: number): number {
  const profit = closedYearProfits(db, garageId, 1)[0] ?? 0;
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]?.cash ?? 0);
  return Math.max(
    0,
    Math.min(cash, Math.round(profit * equityData.dividend.suggestedShareOfProfit)),
  );
}

/**
 * Pays a dividend to the holders of ordinary and preferred shares in proportion to their shares. The
 * garage pays all of it; the owner's part goes to their personal cash. One a financial year, and never
 * more than the garage holds. It does not open a transaction, so it can run inside the season's end.
 */
function payDividend(db: Database, garageId: number, amount: number): void {
  const holdings = all(
    db,
    'SELECT id, holder_type, shares, class FROM shareholding WHERE garage_id = ?',
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    type: r.holder_type as string,
    shares: r.shares as number,
    class: r.class as ShareClass,
  }));
  const parts = splitDividend(holdings, amount);
  const ownerPart = holdings
    .filter((h) => h.type === 'owner')
    .reduce((sum, h) => sum + (parts.get(h.id) ?? 0), 0);
  const date = gameDate(db);
  db.run(
    "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'dividends', ?, ?)",
    [garageId, date, -amount, `Dividend ${financialYear(date)}`],
  );
  db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [amount, garageId]);
  db.run('UPDATE owner SET personal_cash = personal_cash + ? WHERE garage_id = ?', [
    ownerPart,
    garageId,
  ]);
  db.run("INSERT INTO share_event (garage_id, date, kind, detail) VALUES (?, ?, 'dividend', ?)", [
    garageId,
    date,
    JSON.stringify({ amount, owner: ownerPart, others: amount - ownerPart }),
  ]);
}

/** Pays a dividend of a chosen amount in a transaction of its own (the season's end pays one by itself). */
export function declareDividend(db: Database, garageId: number, amount: number): void {
  playerGarage(db, garageId);
  ensureCapTables(db);
  amount = Math.round(amount);
  if (!(amount > 0)) throw new Error('A dividend must be more than nothing.');
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  if (amount > cash) throw new Error('The garage cannot pay more than it holds.');
  if (doneThisYear(db, garageId, 'dividend'))
    throw new Error('The garage has already paid a dividend this year.');
  db.exec('BEGIN');
  try {
    payDividend(db, garageId, amount);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * The year's dividend, paid by itself as the season closes (inside the season's own transaction): what
 * the board suggests, half of the year's operating profit, within the garage's cash. Nothing is paid
 * after a loss, or if one has already gone out this year. Returns what was paid.
 */
export function payAnnualDividend(db: Database, garageId: number): number {
  playerGarage(db, garageId);
  ensureCapTables(db);
  if (doneThisYear(db, garageId, 'dividend')) return 0;
  const amount = suggestedDividend(db, garageId);
  if (!(amount > 0)) return 0;
  payDividend(db, garageId, amount);
  return amount;
}

/**
 * Buys shares back from an outside holder at the garage's valuation. Either the garage buys them and
 * cancels them (so every other holder owns a bigger share), or the owner buys them with their personal
 * cash and holds them (which is how control is won back). The owner's own shares cannot be bought.
 */
export function buyBackShares(
  db: Database,
  garageId: number,
  holdingId: number,
  shares: number,
  by: 'garage' | 'owner',
): number {
  playerGarage(db, garageId);
  ensureCapTables(db);
  const holding = all(
    db,
    'SELECT id, holder_type, holder_name, class, shares, paid FROM shareholding WHERE id = ? AND garage_id = ?',
    [holdingId, garageId],
  )[0];
  if (!holding) throw new Error('The garage has no such holding.');
  if (holding.holder_type === 'owner') throw new Error('You cannot buy shares from yourself.');
  if (holding.class === 'option') throw new Error('Option pool shares cannot be bought back.');
  shares = Math.round(shares);
  if (!(shares > 0) || shares > (holding.shares as number))
    throw new Error('That is not a number of shares the holder has.');
  const issued = shareTotals(
    all(db, 'SELECT shares, class FROM shareholding WHERE garage_id = ?', [garageId]).map((r) => ({
      shares: r.shares as number,
      class: r.class as ShareClass,
    })),
  ).outstanding;
  const price = sharesPrice(garageValuation(db, garageId).total, issued, shares);
  const date = gameDate(db);
  const left = (holding.shares as number) - shares;
  const paidLeft = Math.round(((holding.paid as number) * left) / (holding.shares as number));
  db.exec('BEGIN');
  try {
    if (by === 'garage') {
      const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
      if (cash < price) throw new Error('The garage cannot afford this.');
      db.run(
        "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'buyback', ?, ?)",
        [garageId, date, -price, `Bought back from ${holding.holder_name as string}`],
      );
      db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, garageId]);
    } else {
      const personal = Number(
        all(db, 'SELECT personal_cash FROM owner WHERE garage_id = ?', [garageId])[0]
          ?.personal_cash ?? 0,
      );
      if (personal < price) throw new Error('You cannot afford this with your own cash.');
      db.run('UPDATE owner SET personal_cash = personal_cash - ? WHERE garage_id = ?', [
        price,
        garageId,
      ]);
      const mine = all(
        db,
        "SELECT id FROM shareholding WHERE garage_id = ? AND holder_type = 'owner' AND class = ? LIMIT 1",
        [garageId, holding.class as string],
      )[0];
      if (mine)
        db.run('UPDATE shareholding SET shares = shares + ?, paid = paid + ? WHERE id = ?', [
          shares,
          price,
          mine.id as number,
        ]);
      else {
        const ownerName = String(
          all(db, 'SELECT name FROM owner WHERE garage_id = ?', [garageId])[0]!.name,
        );
        db.run(
          `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
           VALUES (?, 'owner', 1, ?, ?, ?, ?, ?)`,
          [garageId, ownerName, holding.class as string, shares, price, date],
        );
      }
    }
    if (left === 0) db.run('DELETE FROM shareholding WHERE id = ?', [holdingId]);
    else
      db.run('UPDATE shareholding SET shares = ?, paid = ? WHERE id = ?', [
        left,
        paidLeft,
        holdingId,
      ]);
    db.run("INSERT INTO share_event (garage_id, date, kind, detail) VALUES (?, ?, 'buyback', ?)", [
      garageId,
      date,
      JSON.stringify({ from: holding.holder_name, shares, price, by }),
    ]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return price;
}

// ---- Control and the board ----

const holdersOf = (db: Database, garageId: number) =>
  all(
    db,
    'SELECT id, holder_type, holder_name, class, shares FROM shareholding WHERE garage_id = ?',
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    name: r.holder_name as string,
    type: r.holder_type as string,
    shares: r.shares as number,
    class: r.class as ShareClass,
  }));

/** Who controls a garage, by the votes its ordinary shares carry. */
export function controlView(db: Database, garageId: number): ControlView {
  ensureCapTables(db);
  return controlOf(holdersOf(db, garageId));
}

/** The independent chair of a garage's board: a fictional business person, the same for a given save. */
function chairName(db: Database, garageId: number): string {
  const career = readCareer(db);
  const stream = createRng(career?.masterSeed ?? '').stream(`chair:${garageId}`);
  return personName(stream, pickNationality(stream), stream.chance(0.5) ? 'male' : 'female');
}

/** The board: the owner, a director for each outside holder with a tenth of the shares, and the chair. */
export function boardView(db: Database, garageId: number): Director[] {
  ensureCapTables(db);
  const owner = String(
    all(db, 'SELECT name FROM owner WHERE garage_id = ?', [garageId])[0]?.name ??
      holdersOf(db, garageId).find((h) => h.type === 'owner')?.name ??
      '',
  );
  return boardOf(holdersOf(db, garageId), owner, chairName(db, garageId));
}

export interface BoardTargetView {
  year: number;
  /** The finish in the Garage table that the board expects. */
  target: number;
  /** The finish achieved, once the season has ended. */
  finish: number | null;
  met: boolean | null;
  /** Whether the board called a vote of no confidence after this season. */
  vote: boolean;
}

const seasonYear = (db: Database): number =>
  Number(
    all(db, 'SELECT MAX(year) AS y FROM season')[0]?.y ?? readCareer(db)?.gameDate.slice(0, 4) ?? 0,
  );

/** The finish in the Garage table a garage had in the latest season before a year, or null if it never raced. */
function lastFinish(db: Database, garageId: number, year: number): number | null {
  const own = all(
    db,
    'SELECT finish FROM board_target WHERE garage_id = ? AND year < ? AND finish IS NOT NULL ORDER BY year DESC LIMIT 1',
    [garageId, year],
  )[0];
  if (own) return own.finish as number;
  const snap = all(
    db,
    `SELECT ss.position FROM standing_snapshot ss JOIN season s ON s.id = ss.season_id
      WHERE ss.table_kind = 'garage' AND ss.subject = ? AND s.year < ?
      ORDER BY s.year DESC, ss.after_round DESC LIMIT 1`,
    [String(garageId), year],
  )[0];
  return snap ? (snap.position as number) : null;
}

/** The board's target for a garage this season, set the first time it is looked at. */
export function boardTargets(db: Database, garageId: number): BoardTargetView[] {
  const year = seasonYear(db);
  if (
    !all(db, 'SELECT 1 FROM board_target WHERE garage_id = ? AND year = ?', [garageId, year]).length
  ) {
    const prestige = Number(
      all(db, 'SELECT prestige FROM garage WHERE id = ?', [garageId])[0]?.prestige ?? 1,
    );
    const rank =
      Number(
        all(db, "SELECT COUNT(*) AS n FROM garage WHERE kind = 'racing' AND prestige > ?", [
          prestige,
        ])[0]!.n,
      ) + 1;
    db.run('INSERT INTO board_target (garage_id, year, target) VALUES (?, ?, ?)', [
      garageId,
      year,
      Math.max(1, seasonTarget(lastFinish(db, garageId, year), rank)),
    ]);
  }
  return all(
    db,
    'SELECT year, target, finish, met, vote FROM board_target WHERE garage_id = ? ORDER BY year DESC',
    [garageId],
  ).map((r) => ({
    year: r.year as number,
    target: r.target as number,
    finish: (r.finish as number | null) ?? null,
    met: r.met === null ? null : r.met === 1,
    vote: r.vote === 1,
  }));
}

/**
 * Closes the board's year: writes the finish beside the target, and notes a vote of no confidence if
 * the target has been missed twice running while the owner holds no more than half the votes.
 * Called when a season ends, for the player's garage.
 */
export function reviewBoard(
  db: Database,
  garageId: number,
  year: number,
  finish: number | null,
): void {
  boardTargets(db, garageId);
  const row = all(db, 'SELECT target FROM board_target WHERE garage_id = ? AND year = ?', [
    garageId,
    year,
  ])[0];
  if (!row) return;
  const met = targetMet(finish, row.target as number);
  db.run('UPDATE board_target SET finish = ?, met = ? WHERE garage_id = ? AND year = ?', [
    finish,
    met ? 1 : 0,
    garageId,
    year,
  ]);
  const misses = all(
    db,
    'SELECT met FROM board_target WHERE garage_id = ? AND met IS NOT NULL ORDER BY year DESC',
    [garageId],
  ).map((r) => r.met === 0);
  if (noConfidence(misses, controlView(db, garageId).ownerVotes))
    db.run('UPDATE board_target SET vote = 1 WHERE garage_id = ? AND year = ?', [garageId, year]);
}

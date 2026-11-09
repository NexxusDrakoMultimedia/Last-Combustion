// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  MAX_PREMIUM,
  reservePremium,
  shareTotals,
  sharesPrice,
  takeoverQuote,
  votesOf,
  type ShareClass,
  type TakeoverHolder,
  type TakeoverQuote,
} from '../sim/equity';
import { createRng } from '../sim/rng';
import { DRAKE_MOTORSPORTS } from '../sim/worldgen';
import { readCareer } from './career';
import { ensureCapTables, garageValuation } from './equity';
import { all } from './entries';
import { transferCar } from './market';

/** The owner's own holdings are recognised by holder id 1, the owner. */
const MINE = "holder_type = 'owner' AND holder_id = 1";

const gameDate = (db: Database): string => readCareer(db)?.gameDate ?? '';

/** The premium a holding's holder asks over its share of the garage's worth, the same for the whole save. */
export function reserveOf(db: Database, holdingId: number, holderType: string): number {
  const career = readCareer(db);
  return reservePremium(
    holderType,
    createRng(career?.masterSeed ?? '').stream(`reserve:${holdingId}`),
  );
}

function holdersOf(db: Database, targetId: number): TakeoverHolder[] {
  return all(
    db,
    `SELECT id, holder_type, holder_id, holder_name, class, shares FROM shareholding WHERE garage_id = ? ORDER BY id`,
    [targetId],
  ).map((r) => ({
    id: r.id as number,
    type: r.holder_type as string,
    name: r.holder_name as string,
    shares: r.shares as number,
    class: r.class as ShareClass,
    mine: r.holder_type === 'owner' && r.holder_id === 1,
    reserve: reserveOf(db, r.id as number, r.holder_type as string),
  }));
}

/** A computer garage the player could invest in or bid for: racing, still open and not their own. */
function openTarget(db: Database, targetId: number): { name: string; fans: number } {
  const g = all(
    db,
    `SELECT name, fans, is_player, kind, closed_year, acquired_by FROM garage WHERE id = ?`,
    [targetId],
  )[0];
  if (!g || g.kind !== 'racing') throw new Error(`There is no garage ${targetId}.`);
  if (g.is_player === 1) throw new Error('That is your own garage.');
  if (g.closed_year !== null || g.acquired_by !== null) throw new Error('That garage has closed.');
  return { name: g.name as string, fans: g.fans as number };
}

function playerOf(db: Database, garageId: number): { name: string } {
  const g = all(db, 'SELECT is_player FROM garage WHERE id = ?', [garageId])[0];
  const o = all(db, 'SELECT name FROM owner WHERE garage_id = ?', [garageId])[0];
  if (!g || g.is_player !== 1 || !o) throw new Error('Only the player’s garage can invest.');
  return { name: o.name as string };
}

const personalCash = (db: Database, garageId: number): number =>
  Number(
    all(db, 'SELECT personal_cash FROM owner WHERE garage_id = ?', [garageId])[0]?.personal_cash ??
      0,
  );

function logEvent(
  db: Database,
  garageId: number,
  kind: 'stake' | 'takeover',
  detail: object,
): void {
  db.run('INSERT INTO share_event (garage_id, date, kind, detail) VALUES (?, ?, ?, ?)', [
    garageId,
    gameDate(db),
    kind,
    JSON.stringify(detail),
  ]);
}

export interface InvestmentTarget {
  id: number;
  name: string;
  prestige: number;
  valuation: number;
  /** The share of the issued shares the owner holds in it, or 0. */
  stake: number;
}

/** The computer garages the owner could invest in, with their worth and the owner's stake in each. */
export function investmentTargets(db: Database): InvestmentTarget[] {
  ensureCapTables(db);
  return all(
    db,
    `SELECT id, name, prestige FROM garage
      WHERE kind = 'racing' AND is_player = 0 AND closed_year IS NULL AND acquired_by IS NULL
      ORDER BY name`,
  ).map((g) => {
    const holders = holdersOf(db, g.id as number);
    const issued = shareTotals(holders).outstanding;
    const mine = holders
      .filter((h) => h.mine && h.class !== 'option')
      .reduce((s, h) => s + h.shares, 0);
    return {
      id: g.id as number,
      name: g.name as string,
      prestige: g.prestige as number,
      valuation: garageValuation(db, g.id as number).total,
      stake: issued === 0 ? 0 : mine / issued,
    };
  });
}

export interface InvestmentHolder {
  id: number;
  type: string;
  name: string;
  class: ShareClass;
  shares: number;
  stake: number;
  votes: number;
  /** The premium over its worth at which they will sell. */
  reserve: number;
  /** What the whole holding costs at that premium. */
  asking: number;
  mine: boolean;
}

export interface InvestmentView {
  garageId: number;
  name: string;
  valuation: number;
  issued: number;
  holders: InvestmentHolder[];
  /** What the owner's own stake in it is worth now. */
  worth: number;
  /** The bidder's holdings count for the takeover, the rest are asked: all as the quote works them out. */
  takeoverOpen: boolean;
}

/** Whether a takeover can be launched now: only between seasons, with no race left half run. */
export function takeoverOpen(db: Database): boolean {
  const s = all(db, 'SELECT status FROM season ORDER BY year DESC LIMIT 1')[0];
  return s?.status === 'complete';
}

/** Who owns a computer garage, and what each holder asks to sell. */
export function investmentView(db: Database, targetId: number): InvestmentView {
  ensureCapTables(db);
  const t = openTarget(db, targetId);
  const holders = holdersOf(db, targetId);
  const valuation = garageValuation(db, targetId).total;
  const issued = shareTotals(holders).outstanding;
  const votes = holders.reduce((s, h) => s + votesOf(h), 0);
  return {
    garageId: targetId,
    name: t.name,
    valuation,
    issued,
    holders: holders.map((h) => ({
      id: h.id,
      type: h.type,
      name: h.name,
      class: h.class,
      shares: h.shares,
      stake: h.class === 'option' || issued === 0 ? 0 : h.shares / issued,
      votes: votes === 0 ? 0 : votesOf(h) / votes,
      reserve: h.reserve,
      asking: Math.round(sharesPrice(valuation, issued, h.shares) * (1 + h.reserve)),
      mine: h.mine,
    })),
    worth: sharesPrice(
      valuation,
      issued,
      holders.filter((h) => h.mine && h.class !== 'option').reduce((s, h) => s + h.shares, 0),
    ),
    takeoverOpen: takeoverOpen(db),
  };
}

/**
 * Buys a holding in another garage from its holder, with the owner's personal cash, at the price the
 * holder asks (its worth plus their premium). The shares become the owner's.
 */
export function buyStake(db: Database, playerId: number, holdingId: number): number {
  const me = playerOf(db, playerId);
  ensureCapTables(db);
  const h = all(
    db,
    'SELECT id, garage_id, holder_type, holder_id, class, shares FROM shareholding WHERE id = ?',
    [holdingId],
  )[0];
  if (!h) throw new Error('There is no such holding.');
  const targetId = h.garage_id as number;
  const t = openTarget(db, targetId);
  if (h.holder_type === 'owner' && h.holder_id === 1)
    throw new Error('You already hold these shares.');
  if (h.class === 'option') throw new Error('Option pool shares cannot be bought.');
  const view = investmentView(db, targetId);
  const price = view.holders.find((x) => x.id === holdingId)!.asking;
  if (personalCash(db, playerId) < price)
    throw new Error('You cannot afford this with your own cash.');
  const date = gameDate(db);
  db.exec('BEGIN');
  try {
    db.run('UPDATE owner SET personal_cash = personal_cash - ? WHERE garage_id = ?', [
      price,
      playerId,
    ]);
    const mine = all(
      db,
      `SELECT id FROM shareholding WHERE garage_id = ? AND ${MINE} AND class = ? LIMIT 1`,
      [targetId, h.class as string],
    )[0];
    if (mine)
      db.run('UPDATE shareholding SET shares = shares + ?, paid = paid + ? WHERE id = ?', [
        h.shares as number,
        price,
        mine.id as number,
      ]);
    else
      db.run(
        `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
         VALUES (?, 'owner', 1, ?, ?, ?, ?, ?)`,
        [targetId, me.name, h.class as string, h.shares as number, price, date],
      );
    db.run('DELETE FROM shareholding WHERE id = ?', [holdingId]);
    logEvent(db, playerId, 'stake', { action: 'buy', garage: t.name, shares: h.shares, price });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return price;
}

/**
 * Sells all of the owner's shares in a garage back to it at their worth. The garage pays from its
 * cash and cancels the shares; the owner gets the money in their personal cash.
 */
export function sellStake(db: Database, playerId: number, targetId: number): number {
  playerOf(db, playerId);
  const t = openTarget(db, targetId);
  const view = investmentView(db, targetId);
  const mine = view.holders.filter((h) => h.mine && h.class !== 'option');
  const shares = mine.reduce((s, h) => s + h.shares, 0);
  if (shares === 0) throw new Error('You hold no shares in that garage.');
  const price = sharesPrice(view.valuation, view.issued, shares);
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [targetId])[0]!.cash);
  if (cash < price) throw new Error('That garage cannot afford to buy your shares.');
  const date = gameDate(db);
  db.exec('BEGIN');
  try {
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'buyback', ?, 'Bought back from its new owner')",
      [targetId, date, -price],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, targetId]);
    db.run('UPDATE owner SET personal_cash = personal_cash + ? WHERE garage_id = ?', [
      price,
      playerId,
    ]);
    db.run(`DELETE FROM shareholding WHERE garage_id = ? AND ${MINE}`, [targetId]);
    logEvent(db, playerId, 'stake', { action: 'sell', garage: t.name, shares, price });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return price;
}

/** What a bid for a garage at a premium would do, for the screen to show before the player commits. */
export function quoteTakeover(db: Database, targetId: number, premium: number): TakeoverQuote {
  ensureCapTables(db);
  openTarget(db, targetId);
  return takeoverQuote(holdersOf(db, targetId), garageValuation(db, targetId).total, premium);
}

export interface TakeoverResult {
  cost: number;
  cars: number;
  drivers: number;
  fans: number;
}

/**
 * Takes a garage over. Between seasons only. Holders who accept the bid sell, the rest are bought out
 * at the same price, and the player's garage pays all of it from its cash. The target's cars, driver
 * contracts that run on, fans and cash pass to the player's garage, and the target closes (its record
 * and its name stay in the Registry).
 */
export function launchTakeover(
  db: Database,
  playerId: number,
  targetId: number,
  premium: number,
): TakeoverResult {
  playerOf(db, playerId);
  const t = openTarget(db, targetId);
  if (!takeoverOpen(db)) throw new Error('A takeover can only be launched between seasons.');
  if (!(premium >= 0 && premium <= MAX_PREMIUM)) throw new Error('That premium is out of range.');
  if (t.name === DRAKE_MOTORSPORTS) throw new Error('That garage is not for sale.');
  const quote = quoteTakeover(db, targetId, premium);
  if (!quote.success) throw new Error('Not enough of the votes accept that bid.');
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [playerId])[0]!.cash);
  if (cash < quote.cost) throw new Error('The garage cannot afford this bid.');
  const season = all(db, 'SELECT year FROM season ORDER BY year DESC LIMIT 1')[0]!;
  const year = season.year as number;
  const date = gameDate(db);
  const target = all(db, 'SELECT cash, fans FROM garage WHERE id = ?', [targetId])[0]!;
  const cars = all(db, 'SELECT id FROM car WHERE garage_id = ? ORDER BY id', [targetId]);
  const contracts = all(db, 'SELECT id FROM contract WHERE garage_id = ? AND end_year > ?', [
    targetId,
    year,
  ]);
  db.exec('BEGIN');
  try {
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'acquisitions', ?, ?)",
      [playerId, date, -quote.cost, `Took over ${t.name}`],
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'acquisitions', ?, ?)",
      [playerId, date, target.cash as number, `The cash of ${t.name}`],
    );
    db.run('UPDATE garage SET cash = cash - ? + ?, fans = fans + ? WHERE id = ?', [
      quote.cost,
      target.cash as number,
      target.fans as number,
      playerId,
    ]);
    db.run('UPDATE garage SET cash = 0, fans = 0, closed_year = ?, acquired_by = ? WHERE id = ?', [
      year,
      playerId,
      targetId,
    ]);
    for (const c of cars) transferCar(db, c.id as number, playerId, date, 0);
    db.run('UPDATE contract SET garage_id = ? WHERE garage_id = ? AND end_year > ?', [
      playerId,
      targetId,
      year,
    ]);
    db.run('UPDATE contract SET end_year = MIN(end_year, ?) WHERE garage_id = ?', [year, targetId]);
    db.run('DELETE FROM shareholding WHERE garage_id = ?', [targetId]);
    logEvent(db, playerId, 'takeover', {
      garage: t.name,
      cost: quote.cost,
      premium,
      cars: cars.length,
      drivers: contracts.length,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return {
    cost: quote.cost,
    cars: cars.length,
    drivers: contracts.length,
    fans: target.fans as number,
  };
}

export interface HoldingLine {
  garageId: number;
  name: string;
  class: ShareClass;
  shares: number;
  stake: number;
  worth: number;
}

export interface Wealth {
  personalCash: number;
  holdings: HoldingLine[];
  total: number;
}

/** The owner's own wealth: personal cash and the worth of the shares held in other garages. */
export function wealthOf(db: Database, playerId: number): Wealth {
  playerOf(db, playerId);
  const rows = all(
    db,
    `SELECT s.garage_id, g.name, s.class, SUM(s.shares) AS shares FROM shareholding s
       JOIN garage g ON g.id = s.garage_id
      WHERE s.holder_type = 'owner' AND s.holder_id = 1 AND s.garage_id != ? AND g.closed_year IS NULL
      GROUP BY s.garage_id, s.class ORDER BY g.name`,
    [playerId],
  );
  const holdings = rows.map((r): HoldingLine => {
    const garageId = r.garage_id as number;
    const all_ = all(db, 'SELECT shares, class FROM shareholding WHERE garage_id = ?', [
      garageId,
    ]).map((x) => ({ shares: x.shares as number, class: x.class as ShareClass }));
    const issued = shareTotals(all_).outstanding;
    const shares = r.shares as number;
    return {
      garageId,
      name: r.name as string,
      class: r.class as ShareClass,
      shares,
      stake: issued === 0 || r.class === 'option' ? 0 : shares / issued,
      worth: sharesPrice(garageValuation(db, garageId).total, issued, shares),
    };
  });
  const cash = personalCash(db, playerId);
  return { personalCash: cash, holdings, total: cash + holdings.reduce((s, h) => s + h.worth, 0) };
}

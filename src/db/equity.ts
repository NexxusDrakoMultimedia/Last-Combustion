// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  FOUNDING_SHARES,
  drawCapTable,
  shareTotals,
  valuationOf,
  votesOf,
  type HolderType,
  type ShareClass,
  type Valuation,
} from '../sim/equity';
import { createRng } from '../sim/rng';
import { equityData, nameLists } from '../sim/worldgen/data';
import { pickNationality, personName } from '../sim/worldgen/names';
import { readCareer } from './career';
import { all } from './entries';
import { closedYearProfits } from './ledger';
import { valueOfCar } from './market';

/** Replaces a garage's holdings with the owner holding all of its shares (a garage the player founds). */
export function setSoleOwner(db: Database, garageId: number, owner: string, date: string): void {
  db.run('DELETE FROM shareholding WHERE garage_id = ?', [garageId]);
  db.run(
    `INSERT INTO shareholding (garage_id, holder_type, holder_name, class, shares, paid, since)
     VALUES (?, 'owner', ?, 'ordinary', ?, 0, ?)`,
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
    `SELECT g.id, g.flag, g.is_player, o.name AS owner FROM garage g LEFT JOIN owner o ON o.garage_id = g.id
      WHERE g.kind = 'racing' AND NOT EXISTS (SELECT 1 FROM shareholding s WHERE s.garage_id = g.id)
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
    const founder = person(home);
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
  };
}

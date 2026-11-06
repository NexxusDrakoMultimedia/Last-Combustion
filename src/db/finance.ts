// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { distanceKm, roundCosts, upkeepFactor } from '../sim/economy';
import { repairFactor } from '../sim/staff';
import { feePerRound } from '../sim/sponsors';
import { economyBalance } from '../sim/worldgen/data';
import type { Tier } from '../sim/worldgen/types';
import { all } from './entries';
import { crashRepairCost } from './repairs';
import { roundSalaries } from './executives';
import { garageCrewStrength, roundWages } from './staff';

export interface RoundSettlement {
  roundNumber: number;
  garages: number;
  total: number;
  /** What title sponsors paid the garages this round. */
  sponsorIncome: number;
}

/**
 * Charges every garage with entries at a round its running costs: entry fees, tyres,
 * servicing and travel (see the GDD, "Cost baseline"). Must be run after the prelims, since
 * the top 31 get free racing tyres, and can only be run once per round.
 */
export function settleRound(db: Database, roundNumber: number): RoundSettlement {
  const round = all(
    db,
    `SELECT r.id, r.status, r.final_date, c.stable_id AS course
       FROM round r JOIN course c ON c.id = r.course_id
      WHERE r.number = ? AND r.season_id = (SELECT MAX(id) FROM season)`,
    [roundNumber],
  )[0];
  if (!round) throw new Error(`There is no round ${roundNumber}.`);
  if (round.status === 'scheduled') throw new Error(`Round ${roundNumber} has no prelims yet.`);
  const roundId = round.id as number;
  if (
    all(db, "SELECT 1 AS n FROM ledger WHERE round_id = ? AND category = 'entry_fee' LIMIT 1", [
      roundId,
    ]).length > 0
  ) {
    throw new Error(`Round ${roundNumber} has already been settled.`);
  }
  const venue = (economyBalance.venues as Record<string, { lat: number; lon: number }>)[
    round.course as string
  ];
  if (!venue) throw new Error(`The course ${round.course as string} has no venue.`);

  const rows = all(
    db,
    `SELECT e.garage_id, e.id AS entry_id, r.prelim_pos, r.dnf_reason, m.tier, m.price_new, p.latitude AS lat, p.longitude AS lon
       FROM entry e
       JOIN result r ON r.entry_id = e.id AND r.round_id = ?
       JOIN car c ON c.id = e.car_id
       JOIN car_model m ON m.id = c.car_model_id
       JOIN garage g ON g.id = e.garage_id
       JOIN place p ON p.id = g.base_place_id
      WHERE e.series = 'main' AND e.season_id = (SELECT MAX(id) FROM season)
      ORDER BY e.garage_id, e.id`,
    [roundId],
  );
  const byGarage = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byGarage.get(row.garage_id as number) ?? [];
    list.push(row);
    byGarage.set(row.garage_id as number, list);
  }

  const date = round.final_date as string;
  let total = 0;
  let sponsorTotal = 0;
  const seasonYear = Number(date.slice(0, 4));
  db.exec('BEGIN');
  try {
    for (const [garageId, entries] of byGarage) {
      const first = entries[0]!;
      const costs = roundCosts({
        entries: entries.length,
        top31: entries.filter((e) => e.prelim_pos !== null && (e.prelim_pos as number) <= 31)
          .length,
        upkeep: entries.map((e) => upkeepFactor(e.tier as Tier)),
        distanceKm: distanceKm({ lat: first.lat as number, lon: first.lon as number }, venue),
      });
      const lines: [string, number][] = [
        ['entry_fee', costs.entryFees],
        ['tyres', costs.tyres],
        ['servicing', costs.servicing],
        ['travel', costs.travel],
      ];
      // A crash in the round (a prelim run or the final) costs a repair bill.
      const repairs = Math.round(
        entries
          .filter((e) => e.dnf_reason === 'crash')
          .reduce((sum, e) => sum + crashRepairCost(e.price_new as number), 0) *
          repairFactor(garageCrewStrength(db, garageId)),
      );
      if (repairs > 0) {
        lines.push(['repairs', repairs]);
        costs.total += repairs;
      }
      // The mechanics' wages for the round.
      const wages = roundWages(db, garageId);
      if (wages > 0) {
        lines.push(['wages', wages]);
        costs.total += wages;
      }
      // The executives' salaries for the round.
      const salaries = roundSalaries(db, garageId);
      if (salaries > 0) {
        lines.push(['salaries', salaries]);
        costs.total += salaries;
      }
      for (const [category, amount] of lines) {
        db.run(
          'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
          [garageId, roundId, date, category, -amount, `Round ${roundNumber}`],
        );
      }
      db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [costs.total, garageId]);
      // The title sponsor pays a share of its season fee each round.
      const deal = all(
        db,
        `SELECT season_fee FROM sponsor_deal WHERE garage_id = ? AND is_title = 1 AND start_year <= ? AND end_year >= ?
          ORDER BY id DESC LIMIT 1`,
        [garageId, seasonYear, seasonYear],
      )[0];
      if (deal) {
        const pay = feePerRound(deal.season_fee as number);
        db.run(
          'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
          [garageId, roundId, date, 'sponsor', pay, `Round ${roundNumber}`],
        );
        db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [pay, garageId]);
        sponsorTotal += pay;
      }
      db.run(
        'UPDATE entry SET fee_paid = 1 WHERE garage_id = ? AND season_id = (SELECT MAX(id) FROM season) AND series = ?',
        [garageId, 'main'],
      );
      total += costs.total;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { roundNumber, garages: byGarage.size, total, sponsorIncome: sponsorTotal };
}

export interface GarageFinance {
  cash: number;
  income: number;
  expenses: number;
  byCategory: Record<string, number>;
}

/** A garage's cash and its ledger totals by category. */
export function garageFinance(db: Database, garageId: number): GarageFinance {
  const garage = all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const byCategory: Record<string, number> = {};
  let income = 0;
  let expenses = 0;
  for (const row of all(
    db,
    'SELECT category, SUM(amount) AS total FROM ledger WHERE garage_id = ? GROUP BY category',
    [garageId],
  )) {
    const total = row.total as number;
    byCategory[row.category as string] = total;
    if (total >= 0) income += total;
    else expenses -= total;
  }
  return { cash: garage.cash as number, income, expenses, byCategory };
}

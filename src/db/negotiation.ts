// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  clampPrizeShare,
  clampRelationship,
  contractValue,
  fairPrizeShare,
  leverageFrom,
  patienceFor,
  relationshipChange,
  releaseFee,
  respond,
  termsForValue,
  walkAwayValue,
} from '../sim/negotiation';
import { fairSalary, overallRating } from '../sim/worldgen/rating';
import { ROAD_TYPES, type RoadType } from '../sim/worldgen/types';
import { garageBonuses } from './bonuses';
import { readCareer } from './career';
import { all } from './entries';

/** The relationship between two parties, from -100 to +100 (0 if they have not dealt before). */
export function relationshipScore(
  db: Database,
  a: { type: string; id: number },
  b: { type: string; id: number },
): number {
  const row = all(
    db,
    'SELECT score FROM relationship WHERE party_a_type = ? AND party_a_id = ? AND party_b_type = ? AND party_b_id = ?',
    [a.type, a.id, b.type, b.id],
  )[0];
  return row ? (row.score as number) : 0;
}

/** Changes a relationship by some points, keeping it within range. */
export function adjustRelationship(
  db: Database,
  a: { type: string; id: number },
  b: { type: string; id: number },
  delta: number,
): number {
  const score = clampRelationship(relationshipScore(db, a, b) + delta);
  db.run(
    `INSERT INTO relationship (party_a_type, party_a_id, party_b_type, party_b_id, score) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (party_a_type, party_a_id, party_b_type, party_b_id) DO UPDATE SET score = excluded.score`,
    [a.type, a.id, b.type, b.id, score],
  );
  return score;
}

export interface Negotiation {
  id: number;
  patience: number;
  /** What the driver is worth in a fair deal, per season: a hint, not their lowest price. */
  fairValue: number;
}

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

function driverRow(db: Database, driverId: number) {
  const d = all(db, 'SELECT * FROM driver WHERE id = ?', [driverId])[0];
  if (!d) throw new Error(`There is no driver ${driverId}.`);
  const affinities = {} as Record<RoadType, number>;
  for (const a of all(
    db,
    'SELECT road_type, rating FROM driver_road_affinity WHERE driver_id = ?',
    [driverId],
  )) {
    affinities[a.road_type as RoadType] = a.rating as number;
  }
  for (const type of ROAD_TYPES) affinities[type] ??= 0;
  return { d, affinities };
}

/**
 * Starts a negotiation between a garage and a driver over a contract. The driver's hidden
 * walk-away value comes from their rating, gold border, standing against the garage's prestige,
 * and their relationship. A driver who has walked away will not deal again this year.
 */
export function openDriverNegotiation(
  db: Database,
  garageId: number,
  driverId: number,
): Negotiation {
  const year = yearOf(db);
  const garage = all(db, 'SELECT id, prestige, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const { d, affinities } = driverRow(db, driverId);
  const walked = all(
    db,
    `SELECT 1 AS n FROM negotiation WHERE kind = 'driver_contract' AND window = ? AND status = 'walked'
      AND party_a_id = ? AND party_b_id = ? LIMIT 1`,
    [String(year), garageId, driverId],
  );
  if (walked.length > 0)
    throw new Error('This driver has walked away and will not negotiate again this year.');
  const open = all(
    db,
    `SELECT id FROM negotiation WHERE kind = 'driver_contract' AND status = 'open' AND party_a_id = ? AND party_b_id = ?`,
    [garageId, driverId],
  )[0];
  if (open) throw new Error('There is already a negotiation open with this driver.');

  const rating = overallRating({
    pace: d.pace as number,
    consistency: d.consistency as number,
    racecraft: d.racecraft as number,
    tyreManagement: d.tyre_management as number,
    composure: d.composure as number,
    wetSkill: d.wet_skill as number,
    affinities,
  });
  const fair = fairSalary(rating, d.gold_border_year !== null);
  const relationship = relationshipScore(
    db,
    { type: 'garage', id: garageId },
    { type: 'driver', id: driverId },
  );
  const driverStrength = ((d.reputation as number) + (d.fame as number)) / 2;
  const bonuses = garageBonuses(db, garageId);
  const walkAway = walkAwayValue(fair, 'wants_more', {
    leverage: leverageFrom(driverStrength, garage.prestige as number) - bonuses.leverage,
    relationship,
    rivalInterest: 0,
  });
  const patience = patienceFor(relationship) + (bonuses.extraPatience ? 1 : 0);
  db.run(
    `INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
     VALUES ('driver_contract', ?, 'garage', ?, 'driver', ?, ?, ?, ?)`,
    [String(year), garageId, driverId, patience, fair, walkAway],
  );
  const id = Number(all(db, 'SELECT MAX(id) AS n FROM negotiation')[0]!.n);
  return { id, patience, fairValue: Math.round(fair) };
}

export interface ContractTerms {
  /** Salary per season. */
  salary: number;
  years: number;
  role?: 'lead' | 'development';
  /** The share of the driver's prize money the garage keeps (default 80%); the driver takes the rest. */
  garageShare?: number;
}

export type ContractOutcome =
  | { kind: 'accepted'; contractId: number; releaseFeePaid: number }
  | { kind: 'countered'; counter: ContractTerms; patienceLeft: number }
  | { kind: 'walked' };

/** Makes an offer. The driver accepts, counters, or walks away. */
export function offerDriverContract(
  db: Database,
  negotiationId: number,
  terms: ContractTerms,
): ContractOutcome {
  const year = yearOf(db);
  const date = readCareer(db)!.gameDate;
  const n = all(db, "SELECT * FROM negotiation WHERE id = ? AND kind = 'driver_contract'", [
    negotiationId,
  ])[0];
  if (!n) throw new Error(`There is no negotiation ${negotiationId}.`);
  if (n.status !== 'open')
    throw new Error(`Negotiation ${negotiationId} is already ${n.status as string}.`);
  if (
    !(terms.salary >= 0) ||
    !Number.isInteger(terms.years) ||
    terms.years < 1 ||
    terms.years > 5
  ) {
    throw new Error('A contract is for 1 to 5 whole years at a salary of zero or more.');
  }
  const garageId = n.party_a_id as number;
  const driverId = n.party_b_id as number;
  const role = terms.role ?? 'lead';
  const counterIndex = n.counters as number;
  const garageShare = clampPrizeShare(terms.garageShare ?? fairPrizeShare());
  const value = contractValue(terms.salary, terms.years, garageShare);
  const response = respond(
    value,
    n.walk_away as number,
    'wants_more',
    n.patience_left as number,
    counterIndex,
  );
  const round =
    Number(
      all(db, 'SELECT COUNT(*) AS c FROM offer WHERE negotiation_id = ?', [negotiationId])[0]!.c,
    ) + 1;
  const record = (outcome: 'accepted' | 'countered' | 'walked') =>
    db.run(
      "INSERT INTO offer (negotiation_id, round_no, from_side, terms, value, outcome) VALUES (?, ?, 'a', ?, ?, ?)",
      [negotiationId, round, JSON.stringify({ ...terms, role, garageShare }), value, outcome],
    );

  if (response.kind === 'walk') {
    db.exec('BEGIN');
    try {
      record('walked');
      db.run("UPDATE negotiation SET status = 'walked', patience_left = 0 WHERE id = ?", [
        negotiationId,
      ]);
      adjustRelationship(db, { type: 'garage', id: garageId }, { type: 'driver', id: driverId }, 0);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { kind: 'walked' };
  }
  if (response.kind === 'counter') {
    db.exec('BEGIN');
    try {
      record('countered');
      db.run('UPDATE negotiation SET patience_left = ?, counters = counters + 1 WHERE id = ?', [
        response.patienceLeft,
        negotiationId,
      ]);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {
      kind: 'countered',
      counter: {
        ...termsForValue(response.value, terms.years, garageShare),
        years: terms.years,
        role,
      },
      patienceLeft: response.patienceLeft,
    };
  }

  // Accepted: sign the driver, paying any release fee to their old garage.
  const old = all(
    db,
    'SELECT id, garage_id, end_year, salary FROM contract WHERE driver_id = ? ORDER BY end_year DESC, id DESC LIMIT 1',
    [driverId],
  )[0];
  const entered = all(
    db,
    `SELECT garage_id FROM entry WHERE driver_id = ? AND season_id = (SELECT MAX(id) FROM season) LIMIT 1`,
    [driverId],
  )[0];
  if (entered && entered.garage_id !== garageId) {
    throw new Error('This driver is entered this season with another garage.');
  }
  const oldGarage = old ? (old.garage_id as number) : null;
  const yearsLeft = old ? Math.max(0, (old.end_year as number) - year + 1) : 0;
  const fee = old && oldGarage !== garageId ? releaseFee(old.salary as number, yearsLeft) : 0;
  const garage = all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!;
  if ((garage.cash as number) < fee) throw new Error('The garage cannot afford the release fee.');

  db.exec('BEGIN');
  try {
    record('accepted');
    if (old) db.run('DELETE FROM contract WHERE id = ?', [old.id as number]);
    db.run(
      'INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee, garage_prize_share) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        driverId,
        garageId,
        year,
        year + terms.years - 1,
        Math.round(terms.salary),
        role,
        releaseFee(terms.salary, terms.years),
        garageShare,
      ],
    );
    const contractId = Number(all(db, 'SELECT MAX(id) AS n FROM contract')[0]!.n);
    if (fee > 0 && oldGarage !== null) {
      for (const [id, amount] of [
        [garageId, -fee],
        [oldGarage, fee],
      ] as const) {
        db.run(
          'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
          [id, date, 'release_fee', amount, `Driver ${driverId}`],
        );
        db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [amount, id]);
      }
    }
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [negotiationId]);
    const rel = relationshipChange();
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'driver', id: driverId },
      oldGarage === garageId ? rel.renewed : rel.keptDeal,
    );
    db.exec('COMMIT');
    return { kind: 'accepted', contractId, releaseFeePaid: fee };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

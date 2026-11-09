// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { discounted, fairDiscount, partyStrength, type DealKind } from '../sim/deals';
import {
  leverageFrom,
  patienceFor,
  relationshipChange,
  respond,
  walkAwayValue,
} from '../sim/negotiation';
import { dealBalance } from '../sim/worldgen/data';
import { garageBonuses } from './bonuses';
import { readCareer } from './career';
import { all } from './entries';
import { garageFacilityBonuses } from './facilities';
import { adjustRelationship, relationshipScore, type Negotiation } from './negotiation';

const TABLE = { supplier: 'supplier_deal', manufacturer: 'manufacturer_deal' } as const;
const PARTY_TABLE = { supplier: 'part_supplier', manufacturer: 'manufacturer' } as const;
const PARTY_COLUMN = { supplier: 'supplier_id', manufacturer: 'manufacturer_id' } as const;
const NEGOTIATION_KIND = { supplier: 'supplier_deal', manufacturer: 'manufacturer_deal' } as const;

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

/** The discount a garage has from a supplier or manufacturer in a year (0 if it has no deal). */
export function activeDiscount(
  db: Database,
  kind: DealKind,
  garageId: number,
  partyId: number,
  year: number = yearOf(db),
): number {
  const row = all(
    db,
    `SELECT discount FROM ${TABLE[kind]} WHERE garage_id = ? AND ${PARTY_COLUMN[kind]} = ?
      AND start_year <= ? AND end_year >= ? ORDER BY discount DESC LIMIT 1`,
    [garageId, partyId, year, year],
  )[0];
  return row ? (row.discount as number) : 0;
}

/** A price after a garage's deal with a party. */
/** What a garage pays for a part from a supplier: the price after any supplier deal, less its Technical Director's saving. */
export const partPriceFor = (
  db: Database,
  garageId: number,
  supplierId: number,
  price: number,
): number =>
  Math.round(
    dealPrice(db, 'supplier', garageId, supplierId, price) *
      (1 -
        Math.min(
          1,
          garageBonuses(db, garageId).partPrice + garageFacilityBonuses(db, garageId).partPrice,
        )),
  );

export const dealPrice = (
  db: Database,
  kind: DealKind,
  garageId: number,
  partyId: number,
  price: number,
): number => discounted(price, activeDiscount(db, kind, garageId, partyId));

/**
 * Starts a negotiation with a supplier (for a discount on its parts) or a manufacturer (for a
 * discount on new cars). The party's hidden walk-away discount is the most it will give.
 */
export function openDealNegotiation(
  db: Database,
  kind: DealKind,
  garageId: number,
  partyStableId: string,
): Negotiation {
  const year = yearOf(db);
  const garage = all(db, 'SELECT prestige, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const party = all(db, `SELECT id FROM ${PARTY_TABLE[kind]} WHERE stable_id = ?`, [
    partyStableId,
  ])[0];
  if (!party) throw new Error(`Unknown ${kind} "${partyStableId}".`);
  const partyId = party.id as number;
  if (activeDiscount(db, kind, garageId, partyId, year) > 0) {
    throw new Error(`The garage already has a ${kind} deal with this party this season.`);
  }
  const walked = all(
    db,
    `SELECT 1 AS n FROM negotiation WHERE kind = ? AND window = ? AND status = 'walked'
      AND party_a_id = ? AND party_b_id = ? LIMIT 1`,
    [NEGOTIATION_KIND[kind], String(year), garageId, partyId],
  );
  if (walked.length > 0)
    throw new Error('This party has walked away and will not negotiate again this year.');
  if (
    all(
      db,
      `SELECT 1 AS n FROM negotiation WHERE kind = ? AND status = 'open' AND party_a_id = ? AND party_b_id = ? LIMIT 1`,
      [NEGOTIATION_KIND[kind], garageId, partyId],
    ).length > 0
  ) {
    throw new Error('There is already a negotiation open with this party.');
  }

  const fair = fairDiscount(kind, garage.prestige as number);
  const relationship = relationshipScore(
    db,
    { type: 'garage', id: garageId },
    { type: kind, id: partyId },
  );
  const bonuses = garageBonuses(db, garageId);
  const walkAway = walkAwayValue(fair, 'pays', {
    leverage: leverageFrom(partyStrength(kind), garage.prestige as number) - bonuses.leverage,
    relationship,
    rivalInterest: 0,
  });
  const patience = patienceFor(relationship) + (bonuses.extraPatience ? 1 : 0);
  db.run(
    `INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
     VALUES (?, ?, 'garage', ?, ?, ?, ?, ?, ?)`,
    [NEGOTIATION_KIND[kind], String(year), garageId, kind, partyId, patience, fair, walkAway],
  );
  const id = Number(all(db, 'SELECT MAX(id) AS n FROM negotiation')[0]!.n);
  // fairValue is shown as a fraction here (0.09 is 9%).
  return { id, patience, fairValue: fair };
}

export interface DealTerms {
  /** The discount the garage asks for, as a fraction (0.1 is 10%). */
  discount: number;
  years: number;
}

export type DealOutcome =
  | { kind: 'accepted'; dealId: number }
  | { kind: 'countered'; counter: DealTerms; patienceLeft: number }
  | { kind: 'walked' };

/** Asks for a discount. The party accepts (up to its walk-away discount), counters lower, or walks away. */
export function offerDeal(db: Database, negotiationId: number, terms: DealTerms): DealOutcome {
  const year = yearOf(db);
  const n = all(
    db,
    "SELECT * FROM negotiation WHERE id = ? AND kind IN ('supplier_deal', 'manufacturer_deal')",
    [negotiationId],
  )[0];
  if (!n) throw new Error(`There is no negotiation ${negotiationId}.`);
  if (n.status !== 'open')
    throw new Error(`Negotiation ${negotiationId} is already ${n.status as string}.`);
  const kind: DealKind = n.kind === 'supplier_deal' ? 'supplier' : 'manufacturer';
  const maxYears = dealBalance.maxYears;
  if (
    !(terms.discount >= 0 && terms.discount <= 1) ||
    !Number.isInteger(terms.years) ||
    terms.years < 1 ||
    terms.years > maxYears
  ) {
    throw new Error(`A deal is for 1 to ${maxYears} whole years at a discount between 0 and 1.`);
  }
  const garageId = n.party_a_id as number;
  const partyId = n.party_b_id as number;
  const response = respond(
    terms.discount,
    n.walk_away as number,
    'pays',
    n.patience_left as number,
    n.counters as number,
  );
  const round =
    Number(
      all(db, 'SELECT COUNT(*) AS c FROM offer WHERE negotiation_id = ?', [negotiationId])[0]!.c,
    ) + 1;
  const record = (outcome: 'accepted' | 'countered' | 'walked') =>
    db.run(
      "INSERT INTO offer (negotiation_id, round_no, from_side, terms, value, outcome) VALUES (?, ?, 'a', ?, ?, ?)",
      [negotiationId, round, JSON.stringify(terms), terms.discount, outcome],
    );

  db.exec('BEGIN');
  try {
    if (response.kind === 'walk') {
      record('walked');
      db.run("UPDATE negotiation SET status = 'walked', patience_left = 0 WHERE id = ?", [
        negotiationId,
      ]);
      db.exec('COMMIT');
      return { kind: 'walked' };
    }
    if (response.kind === 'counter') {
      record('countered');
      db.run('UPDATE negotiation SET patience_left = ?, counters = counters + 1 WHERE id = ?', [
        response.patienceLeft,
        negotiationId,
      ]);
      db.exec('COMMIT');
      return {
        kind: 'countered',
        counter: { discount: Math.round(response.value * 10000) / 10000, years: terms.years },
        patienceLeft: response.patienceLeft,
      };
    }
    record('accepted');
    db.run(
      `INSERT INTO ${TABLE[kind]} (garage_id, ${PARTY_COLUMN[kind]}, start_year, end_year, discount) VALUES (?, ?, ?, ?, ?)`,
      [garageId, partyId, year, year + terms.years - 1, terms.discount],
    );
    const dealId = Number(all(db, `SELECT MAX(id) AS n FROM ${TABLE[kind]}`)[0]!.n);
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [negotiationId]);
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: kind, id: partyId },
      relationshipChange().keptDeal,
    );
    db.exec('COMMIT');
    return { kind: 'accepted', dealId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

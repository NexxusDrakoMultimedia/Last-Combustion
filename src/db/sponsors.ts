// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  leverageFrom,
  patienceFor,
  relationshipChange,
  respond,
  walkAwayValue,
} from '../sim/negotiation';
import { eligibleSponsors, titleSponsorFee } from '../sim/sponsors';
import { sponsorBalance } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all } from './entries';
import { adjustRelationship, relationshipScore, type Negotiation } from './negotiation';

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

/** The sponsors a garage's prestige lets it approach, with the year their deal with the garage ends if they have one. */
export function approachableSponsors(
  db: Database,
  garageId: number,
): { stableId: string; name: string; tier: string }[] {
  const garage = all(db, 'SELECT prestige FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  return eligibleSponsors(garage.prestige as number).map((s) => ({
    stableId: s.id,
    name: s.name,
    tier: s.tier,
  }));
}

/** The garage's title-sponsor deal that runs in a year, if any. */
export function activeSponsorDeal(
  db: Database,
  garageId: number,
  year: number,
): { sponsor: string; seasonFee: number; endYear: number } | undefined {
  const row = all(
    db,
    `SELECT s.name, d.season_fee, d.end_year FROM sponsor_deal d JOIN sponsor s ON s.id = d.sponsor_id
      WHERE d.garage_id = ? AND d.is_title = 1 AND d.start_year <= ? AND d.end_year >= ?
      ORDER BY d.id DESC LIMIT 1`,
    [garageId, year, year],
  )[0];
  return row
    ? {
        sponsor: row.name as string,
        seasonFee: row.season_fee as number,
        endYear: row.end_year as number,
      }
    : undefined;
}

/**
 * Starts a negotiation with a sponsor over a title-sponsor deal. The sponsor's hidden
 * walk-away fee comes from the garage's prestige and its best driver's fame, the sponsor's own
 * weight, and their relationship. A sponsor that has walked away will not deal again this year.
 */
export function openSponsorNegotiation(
  db: Database,
  garageId: number,
  sponsorStableId: string,
): Negotiation {
  const year = yearOf(db);
  const garage = all(db, 'SELECT prestige, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const sponsor = all(db, 'SELECT id, min_prestige, strength FROM sponsor WHERE stable_id = ?', [
    sponsorStableId,
  ])[0];
  if (!sponsor) throw new Error(`Unknown sponsor "${sponsorStableId}".`);
  if ((garage.prestige as number) < (sponsor.min_prestige as number)) {
    throw new Error('The garage does not have the prestige this sponsor wants.');
  }
  if (activeSponsorDeal(db, garageId, year)) {
    throw new Error('The garage already has a title sponsor this season.');
  }
  const sponsorId = sponsor.id as number;
  const walked = all(
    db,
    `SELECT 1 AS n FROM negotiation WHERE kind = 'sponsor_deal' AND window = ? AND status = 'walked'
      AND party_a_id = ? AND party_b_id = ? LIMIT 1`,
    [String(year), garageId, sponsorId],
  );
  if (walked.length > 0)
    throw new Error('This sponsor has walked away and will not negotiate again this year.');
  if (
    all(
      db,
      `SELECT 1 AS n FROM negotiation WHERE kind = 'sponsor_deal' AND status = 'open' AND party_a_id = ? AND party_b_id = ?`,
      [garageId, sponsorId],
    ).length > 0
  ) {
    throw new Error('There is already a negotiation open with this sponsor.');
  }

  const bestFame = Number(
    all(
      db,
      'SELECT COALESCE(MAX(d.fame), 0) AS f FROM contract c JOIN driver d ON d.id = c.driver_id WHERE c.garage_id = ?',
      [garageId],
    )[0]!.f,
  );
  const fair = titleSponsorFee(garage.prestige as number, bestFame);
  const relationship = relationshipScore(
    db,
    { type: 'garage', id: garageId },
    { type: 'sponsor', id: sponsorId },
  );
  const garageStrength = ((garage.prestige as number) + bestFame) / 2;
  const walkAway = walkAwayValue(fair, 'pays', {
    // The sponsor is the stronger party when it outweighs the garage: positive leverage lowers what it pays.
    leverage: leverageFrom(sponsor.strength as number, garageStrength),
    relationship,
    rivalInterest: 0,
  });
  const patience = patienceFor(relationship);
  db.run(
    `INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
     VALUES ('sponsor_deal', ?, 'garage', ?, 'sponsor', ?, ?, ?, ?)`,
    [String(year), garageId, sponsorId, patience, fair, walkAway],
  );
  const id = Number(all(db, 'SELECT MAX(id) AS n FROM negotiation')[0]!.n);
  return { id, patience, fairValue: Math.round(fair) };
}

export interface SponsorTerms {
  /** Season fee the garage asks for. */
  fee: number;
  years: number;
}

export type SponsorOutcome =
  | { kind: 'accepted'; dealId: number }
  | { kind: 'countered'; counter: SponsorTerms; patienceLeft: number }
  | { kind: 'walked' };

/** Asks a sponsor for a fee. It accepts (it will pay no more than its walk-away fee), counters lower, or walks away. */
export function offerSponsorDeal(
  db: Database,
  negotiationId: number,
  terms: SponsorTerms,
): SponsorOutcome {
  const year = yearOf(db);
  const n = all(db, "SELECT * FROM negotiation WHERE id = ? AND kind = 'sponsor_deal'", [
    negotiationId,
  ])[0];
  if (!n) throw new Error(`There is no negotiation ${negotiationId}.`);
  if (n.status !== 'open')
    throw new Error(`Negotiation ${negotiationId} is already ${n.status as string}.`);
  const maxYears = sponsorBalance.maxYears;
  if (
    !(terms.fee >= 0) ||
    !Number.isInteger(terms.years) ||
    terms.years < 1 ||
    terms.years > maxYears
  ) {
    throw new Error(`A sponsor deal is for 1 to ${maxYears} whole years at a fee of zero or more.`);
  }
  const garageId = n.party_a_id as number;
  const sponsorId = n.party_b_id as number;
  const response = respond(
    terms.fee,
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
      [negotiationId, round, JSON.stringify(terms), terms.fee, outcome],
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
        counter: { fee: Math.round(response.value), years: terms.years },
        patienceLeft: response.patienceLeft,
      };
    }
    record('accepted');
    db.run(
      'INSERT INTO sponsor_deal (garage_id, sponsor_id, start_year, end_year, season_fee, is_title) VALUES (?, ?, ?, ?, ?, 1)',
      [garageId, sponsorId, year, year + terms.years - 1, Math.round(terms.fee)],
    );
    const dealId = Number(all(db, 'SELECT MAX(id) AS n FROM sponsor_deal')[0]!.n);
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [negotiationId]);
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'sponsor', id: sponsorId },
      relationshipChange().keptDeal,
    );
    db.exec('COMMIT');
    return { kind: 'accepted', dealId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

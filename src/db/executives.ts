// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  BUILT_ROLES,
  executiveOffers,
  executiveSlots,
  fairSalaryFor,
  salaryPerRound,
  type ExecutiveOffer,
  type ExecutiveRole,
} from '../sim/executives';
import {
  contractValue,
  leverageFrom,
  patienceFor,
  relationshipChange,
  respond,
  termsForValue,
  walkAwayValue,
} from '../sim/negotiation';
import { createRng } from '../sim/rng';
import { executiveData } from '../sim/worldgen/data';
import { garageBonuses } from './bonuses';
import { readCareer } from './career';
import { all } from './entries';
import { adjustRelationship, relationshipScore, type Negotiation } from './negotiation';

export interface Executive {
  id: number;
  role: ExecutiveRole;
  name: string;
  age: number;
  skill: number;
  salary: number;
  salaryPerRound: number;
  endYear: number;
}

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

/** The executives a garage employs now. */
export function garageExecutives(db: Database, garageId: number): Executive[] {
  const year = yearOf(db);
  return all(
    db,
    `SELECT id, role, name, birth_year, skill, salary, end_year FROM executive
      WHERE garage_id = ? AND status = 'employed' ORDER BY id`,
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    role: r.role as ExecutiveRole,
    name: r.name as string,
    age: year - (r.birth_year as number),
    skill: r.skill as number,
    salary: r.salary as number,
    salaryPerRound: salaryPerRound(r.salary as number),
    endYear: r.end_year as number,
  }));
}

/** What a garage pays its executives for one round. */
export function roundSalaries(db: Database, garageId: number): number {
  return garageExecutives(db, garageId).reduce((sum, e) => sum + e.salaryPerRound, 0);
}

/** How many executive roles a garage may fill (from its prestige) and how many it fills. */
export function executiveCapacity(db: Database, garageId: number): { slots: number; used: number } {
  const garage = all(db, 'SELECT prestige FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  return {
    slots: executiveSlots(garage.prestige as number),
    used: garageExecutives(db, garageId).length,
  };
}

/**
 * The executives on offer for a role. They come from the career's seed, the garage, the role and
 * how many executives the garage has ever taken on in it, so the same offers wait until one is hired.
 */
export function executiveCandidates(
  db: Database,
  garageId: number,
  role: ExecutiveRole,
): ExecutiveOffer[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const hired = Number(
    all(
      db,
      "SELECT COUNT(*) AS n FROM executive WHERE garage_id = ? AND role = ? AND status <> 'candidate'",
      [garageId, role],
    )[0]!.n,
  );
  const rng = createRng(career.masterSeed).stream(`exec:${garageId}:${role}:${hired}`);
  return executiveOffers(rng, role);
}

/**
 * Starts a negotiation with one of the executives on offer. The garage needs a free slot for its
 * prestige and the role must be empty and built. The executive's hidden walk-away salary comes from
 * their skill, their standing against the garage's prestige and their relationship, and the
 * garage's own Contracts Director improves its side.
 */
export function openExecutiveNegotiation(
  db: Database,
  garageId: number,
  role: ExecutiveRole,
  offer: number,
): Negotiation & { executiveId: number } {
  const year = yearOf(db);
  const garage = all(db, 'SELECT id, prestige, kind, closed_year FROM garage WHERE id = ?', [
    garageId,
  ])[0];
  if (!garage || garage.kind !== 'racing' || garage.closed_year !== null)
    throw new Error(`There is no racing garage ${garageId}.`);
  if (!BUILT_ROLES.includes(role)) throw new Error('That role cannot be filled yet.');
  const capacity = executiveCapacity(db, garageId);
  if (capacity.used >= capacity.slots)
    throw new Error(
      capacity.slots === 0
        ? `A garage needs prestige ${executiveData.firstSlotPrestige} to appoint an executive.`
        : 'The garage has no free executive slot for its prestige.',
    );
  if (garageExecutives(db, garageId).some((e) => e.role === role))
    throw new Error('The garage already has an executive in that role.');
  const chosen = executiveCandidates(db, garageId, role)[offer];
  if (!chosen) throw new Error('There is no such executive on offer.');
  const open = all(
    db,
    `SELECT n.id FROM negotiation n JOIN executive x ON x.id = n.party_b_id
      WHERE n.kind = 'executive_contract' AND n.status = 'open' AND n.party_a_id = ? AND x.role = ?`,
    [garageId, role],
  )[0];
  if (open) {
    // A negotiation the player walked away from without finishing starts over.
    const stale = all(db, 'SELECT party_b_id FROM negotiation WHERE id = ?', [
      open.id as number,
    ])[0]!;
    db.run('DELETE FROM offer WHERE negotiation_id = ?', [open.id as number]);
    db.run('DELETE FROM negotiation WHERE id = ?', [open.id as number]);
    db.run("DELETE FROM executive WHERE id = ? AND status = 'candidate'", [
      stale.party_b_id as number,
    ]);
  }
  const walked = all(
    db,
    `SELECT 1 AS n FROM negotiation n JOIN executive x ON x.id = n.party_b_id
      WHERE n.kind = 'executive_contract' AND n.window = ? AND n.status = 'walked'
        AND n.party_a_id = ? AND x.name = ? LIMIT 1`,
    [String(year), garageId, chosen.name],
  );
  if (walked.length > 0)
    throw new Error('This executive has walked away and will not negotiate again this year.');

  db.exec('BEGIN');
  try {
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status) VALUES (?, ?, ?, ?, ?, 'candidate')",
      [garageId, role, chosen.name, year - chosen.age, chosen.skill],
    );
    const executiveId = Number(all(db, 'SELECT MAX(id) AS n FROM executive')[0]!.n);
    const fair = fairSalaryFor(chosen.skill);
    const relationship = relationshipScore(
      db,
      { type: 'garage', id: garageId },
      { type: 'executive', id: executiveId },
    );
    const bonuses = garageBonuses(db, garageId);
    const walkAway = walkAwayValue(fair, 'wants_more', {
      // The executive is the stronger party when their skill outweighs the garage's prestige.
      leverage: leverageFrom(chosen.skill, garage.prestige as number) - bonuses.leverage,
      relationship,
      rivalInterest: 0,
    });
    const patience = patienceFor(relationship) + (bonuses.extraPatience ? 1 : 0);
    db.run(
      `INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
       VALUES ('executive_contract', ?, 'garage', ?, 'executive', ?, ?, ?, ?)`,
      [String(year), garageId, executiveId, patience, fair, walkAway],
    );
    const id = Number(all(db, 'SELECT MAX(id) AS n FROM negotiation')[0]!.n);
    db.exec('COMMIT');
    return { id, patience, fairValue: Math.round(fair), executiveId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export interface ExecutiveTerms {
  /** Salary per year. */
  salary: number;
  years: number;
}

export type ExecutiveOutcome =
  | { kind: 'accepted'; executiveId: number }
  | { kind: 'countered'; counter: ExecutiveTerms; patienceLeft: number }
  | { kind: 'walked' };

/** Makes an offer. The executive accepts, counters, or walks away. */
export function offerExecutiveContract(
  db: Database,
  negotiationId: number,
  terms: ExecutiveTerms,
): ExecutiveOutcome {
  const year = yearOf(db);
  const date = readCareer(db)!.gameDate;
  const n = all(db, "SELECT * FROM negotiation WHERE id = ? AND kind = 'executive_contract'", [
    negotiationId,
  ])[0];
  if (!n) throw new Error(`There is no negotiation ${negotiationId}.`);
  if (n.status !== 'open')
    throw new Error(`Negotiation ${negotiationId} is already ${n.status as string}.`);
  const [minYears, maxYears] = executiveData.contractYears as [number, number];
  if (
    !(terms.salary >= 0) ||
    !Number.isInteger(terms.years) ||
    terms.years < minYears ||
    terms.years > maxYears
  )
    throw new Error(
      `An executive's contract is for ${minYears} to ${maxYears} whole years at a salary of zero or more.`,
    );
  const garageId = n.party_a_id as number;
  const executiveId = n.party_b_id as number;
  const value = contractValue(terms.salary, terms.years);
  const response = respond(
    value,
    n.walk_away as number,
    'wants_more',
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
      [negotiationId, round, JSON.stringify(terms), value, outcome],
    );

  db.exec('BEGIN');
  try {
    if (response.kind === 'walk') {
      record('walked');
      db.run("UPDATE negotiation SET status = 'walked', patience_left = 0 WHERE id = ?", [
        negotiationId,
      ]);
      db.run("UPDATE executive SET status = 'left', left_on = ? WHERE id = ?", [date, executiveId]);
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
      const counter = termsForValue(response.value, terms.years);
      return {
        kind: 'countered',
        counter: { salary: counter.salary, years: terms.years },
        patienceLeft: response.patienceLeft,
      };
    }
    record('accepted');
    db.run(
      "UPDATE executive SET status = 'employed', salary = ?, start_year = ?, end_year = ?, hired_on = ? WHERE id = ?",
      [Math.round(terms.salary), year, year + terms.years - 1, date, executiveId],
    );
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [negotiationId]);
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'executive', id: executiveId },
      relationshipChange().keptDeal,
    );
    db.exec('COMMIT');
    return { kind: 'accepted', executiveId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Lets an executive go. The garage pays half a year's salary as notice. Returns what was paid.
 */
export function dismissExecutive(db: Database, garageId: number, executiveId: number): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const executive = garageExecutives(db, garageId).find((e) => e.id === executiveId);
  if (!executive) throw new Error('The garage does not employ this executive.');
  const notice = Math.round(executive.salary / 2);
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  if (cash < notice) throw new Error('The garage cannot afford the notice pay.');
  db.exec('BEGIN');
  try {
    db.run("UPDATE executive SET status = 'left', left_on = ? WHERE id = ?", [
      career.gameDate,
      executiveId,
    ]);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'salaries', ?, 'Notice pay')",
      [garageId, career.gameDate, -notice],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [notice, garageId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return notice;
}

/** Ends the contracts that ran out before a year, and returns who left. Called when a season starts. */
export function expireExecutives(db: Database, year: number): number {
  const date = `${year}-02-01`;
  const gone = all(db, "SELECT id FROM executive WHERE status = 'employed' AND end_year < ?", [
    year,
  ]);
  for (const g of gone)
    db.run("UPDATE executive SET status = 'left', left_on = ? WHERE id = ?", [
      date,
      g.id as number,
    ]);
  return gone.length;
}

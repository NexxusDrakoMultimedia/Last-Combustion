// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { createRng } from '../sim/rng';
import {
  readingMidpoint,
  scoutOffers,
  scoutRetires,
  scoutWagePerRound,
  type Scout,
  type ScoutFocus,
  type Reading,
  type ScoutOffer,
  type Subject,
} from '../sim/scouting';
import { scoutingBalance } from '../sim/worldgen/data';
import { garageBonuses } from './bonuses';
import { knowledgeContext, readDriver } from './knowledge';
import { readCareer } from './career';
import { all } from './entries';

const gameYear = (db: Database): number => Number(readCareer(db)?.gameDate.slice(0, 4) ?? 0);

export interface HiredScout {
  id: number;
  name: string;
  skill: number;
  focus: ScoutFocus;
  wagePerYear: number;
  /** What the scout costs the garage for one round. */
  wagePerRound: number;
  hiredOn: string;
  /** Their age this year (the year less their birth year). */
  age: number;
  /** The subject the scout is assigned to, if any. */
  assignment: Subject | null;
  /** What the assignment is called: a driver's or garage's name, or a car's chassis number. */
  subjectName: string | null;
}

const NAME_COLUMN: Record<ScoutFocus, string> = {
  drivers: 'SELECT name FROM driver WHERE id = ?',
  cars: 'SELECT chassis_no AS name FROM car WHERE id = ?',
  garages: 'SELECT name FROM garage WHERE id = ?',
};

const FOCI: ScoutFocus[] = ['drivers', 'cars', 'garages'];

/** The scouts a garage employs now, with what each is assigned to. */
export function garageScouts(db: Database, garageId: number): HiredScout[] {
  return all(
    db,
    `SELECT s.id, s.name, s.skill, s.focus, s.wage_per_year, s.hired_on, s.birth_year,
            a.subject_kind, a.subject_id
       FROM scout s LEFT JOIN scout_assignment a ON a.scout_id = s.id
      WHERE s.garage_id = ? AND s.left_on IS NULL ORDER BY s.id`,
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    skill: r.skill as number,
    focus: r.focus as ScoutFocus,
    wagePerYear: r.wage_per_year as number,
    wagePerRound: scoutWagePerRound(r.wage_per_year as number),
    hiredOn: r.hired_on as string,
    age: gameYear(db) - (r.birth_year as number),
    assignment:
      r.subject_kind === null
        ? null
        : { kind: r.subject_kind as ScoutFocus, id: r.subject_id as number },
    subjectName:
      r.subject_kind === null
        ? null
        : String(
            all(db, NAME_COLUMN[r.subject_kind as ScoutFocus], [r.subject_id as number])[0]?.name ??
              '',
          ),
  }));
}

/** The scouts in the form the knowledge engine reads. */
export function scoutsForEngine(db: Database, garageId: number): Scout[] {
  return garageScouts(db, garageId).map((s) => ({
    skill: s.skill,
    focus: s.focus,
    assignedTo: s.assignment ? `${s.assignment.kind}:${s.assignment.id}` : null,
  }));
}

/** What the Head of Scouting adds to every scout's skill, from 0 (none appointed) to 0.25. */
export function garageScoutLift(db: Database, garageId: number): number {
  return garageBonuses(db, garageId).scouts;
}

/** What a garage pays its scouts for one round. */
export function roundScoutWages(db: Database, garageId: number): number {
  return garageScouts(db, garageId).reduce((sum, s) => sum + s.wagePerRound, 0);
}

/**
 * The scouts on offer. They are drawn from the career's seed, the garage and how many scouts it has
 * ever hired, so the same offers wait until someone is hired.
 */
export function scoutCandidates(db: Database, garageId: number): ScoutOffer[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const hired = Number(
    all(db, 'SELECT COUNT(*) AS n FROM scout WHERE garage_id = ?', [garageId])[0]!.n,
  );
  return scoutOffers(createRng(career.masterSeed).stream(`scouts:${garageId}:${hired}`));
}

/** Hires one of the offered scouts (by position in the list of offers), looking at a kind of subject. */
export function hireScout(
  db: Database,
  garageId: number,
  offer: number,
  focus: ScoutFocus,
): HiredScout {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const garage = all(db, 'SELECT kind, closed_year FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing' || garage.closed_year !== null)
    throw new Error(`There is no racing garage ${garageId}.`);
  if (!FOCI.includes(focus)) throw new Error('A scout looks at drivers, cars or garages.');
  if (garageScouts(db, garageId).length >= scoutingBalance.staff.maxPerGarage)
    throw new Error(`A garage can employ at most ${scoutingBalance.staff.maxPerGarage} scouts.`);
  const chosen = scoutCandidates(db, garageId)[offer];
  if (!chosen) throw new Error('There is no such scout on offer.');
  db.run(
    'INSERT INTO scout (garage_id, name, skill, focus, wage_per_year, hired_on, birth_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      garageId,
      chosen.name,
      chosen.skill,
      focus,
      chosen.wagePerYear,
      career.gameDate,
      gameYear(db) - chosen.age,
    ],
  );
  const id = Number(all(db, 'SELECT MAX(id) AS n FROM scout')[0]!.n);
  return garageScouts(db, garageId).find((s) => s.id === id)!;
}

/** Lets a scout go. The garage pays a round's wages as notice. Returns what was paid. */
export function fireScout(db: Database, garageId: number, scoutId: number): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const scout = garageScouts(db, garageId).find((s) => s.id === scoutId);
  if (!scout) throw new Error('The garage does not employ this scout.');
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  const notice = scout.wagePerRound;
  if (cash < notice) throw new Error('The garage cannot afford the notice pay.');
  db.exec('BEGIN');
  try {
    db.run("UPDATE scout SET left_on = ?, left_reason = 'fired' WHERE id = ?", [
      career.gameDate,
      scoutId,
    ]);
    db.run('DELETE FROM scout_assignment WHERE scout_id = ?', [scoutId]);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'wages', ?, 'Notice pay')",
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

/** A scout who has retired. */
export interface ScoutRetirement {
  id: number;
  garageId: number;
  name: string;
  age: number;
}

/**
 * Sends home every scout who has reached the retirement age (`staff.retireAge`) in `year`: they leave on 1 February
 * with the reason `retired`, and their assignment is cleared so the player's knowledge of that subject falls back
 * to what the other scouts cover. Called when a season starts. Returns who retired.
 */
export function retireScouts(db: Database, year: number): ScoutRetirement[] {
  const retired = all(
    db,
    'SELECT id, garage_id, name, birth_year FROM scout WHERE left_on IS NULL ORDER BY id',
  )
    .map((r) => ({
      id: r.id as number,
      garageId: r.garage_id as number,
      name: r.name as string,
      age: year - (r.birth_year as number),
    }))
    .filter((s) => scoutRetires(s.age));
  for (const s of retired) {
    db.run("UPDATE scout SET left_on = ?, left_reason = 'retired' WHERE id = ?", [
      `${year}-02-01`,
      s.id,
    ]);
    db.run('DELETE FROM scout_assignment WHERE scout_id = ?', [s.id]);
  }
  return retired;
}

/** The scouts a garage lost to retirement in the year that has just begun, for the report on the Scouts tab. */
export function recentScoutRetirements(db: Database, garageId: number): ScoutRetirement[] {
  const year = gameYear(db);
  return all(
    db,
    `SELECT id, garage_id, name, birth_year FROM scout
      WHERE garage_id = ? AND left_reason = 'retired' AND left_on >= ? ORDER BY id`,
    [garageId, `${year}-01-01`],
  ).map((r) => ({
    id: r.id as number,
    garageId: r.garage_id as number,
    name: r.name as string,
    age: year - (r.birth_year as number),
  }));
}

const SUBJECT_TABLE: Record<ScoutFocus, string> = {
  drivers: 'driver',
  cars: 'car',
  garages: 'garage',
};

/** Assigns a scout to a driver, a car or a garage, replacing any earlier assignment. */
export function assignScout(
  db: Database,
  garageId: number,
  scoutId: number,
  subject: Subject,
): void {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  if (!garageScouts(db, garageId).some((s) => s.id === scoutId))
    throw new Error('The garage does not employ this scout.');
  const table = SUBJECT_TABLE[subject.kind];
  if (!table) throw new Error('A scout looks at drivers, cars or garages.');
  if (all(db, `SELECT 1 FROM ${table} WHERE id = ?`, [subject.id]).length === 0)
    throw new Error('There is nothing like that to scout.');
  db.run(
    `INSERT INTO scout_assignment (scout_id, subject_kind, subject_id, assigned_on) VALUES (?, ?, ?, ?)
     ON CONFLICT (scout_id) DO UPDATE SET subject_kind = excluded.subject_kind,
       subject_id = excluded.subject_id, assigned_on = excluded.assigned_on`,
    [scoutId, subject.kind, subject.id, career.gameDate],
  );
}

/** Takes a scout off their subject, back to covering their kind in general. */
export function clearAssignment(db: Database, garageId: number, scoutId: number): void {
  if (!garageScouts(db, garageId).some((s) => s.id === scoutId))
    throw new Error('The garage does not employ this scout.');
  db.run('DELETE FROM scout_assignment WHERE scout_id = ?', [scoutId]);
}

/** A young driver the Head of Scouting has heard of. */
export interface RisingDriver {
  driverId: number;
  name: string;
  age: number;
  /** What the player reads of the driver's potential, with the knowledge behind it. */
  potential: Reading;
  knowledge: number;
}

/**
 * The young drivers a Head of Scouting hears of first: up to `tips.max` drivers aged `tips.maxAge` or younger, not
 * the garage's own, whose potential reads `tips.minPotential` or more, best reading first. Chosen by the midpoint of
 * the reading the player has (never the true potential), so the tip never gives the truth away. Empty when the garage
 * has no Head of Scouting.
 */
export function risingDrivers(db: Database, garageId: number): RisingDriver[] {
  if (garageScoutLift(db, garageId) <= 0) return [];
  const career = readCareer(db);
  if (!career) return [];
  const year = Number(career.gameDate.slice(0, 4));
  const tips = scoutingBalance.tips;
  const ctx = knowledgeContext(db, garageId);
  return all(
    db,
    'SELECT * FROM driver WHERE retired_year IS NULL AND birth_date >= ? ORDER BY id',
    [`${year - tips.maxAge}-01-01`],
  )
    .map((d) => {
      // Only the potential and the knowledge are used, so the rating read here is a placeholder.
      const reading = readDriver(ctx, {
        id: d.id as number,
        fame: d.fame as number,
        rating: d.pace as number,
        pace: d.pace as number,
        consistency: d.consistency as number,
        racecraft: d.racecraft as number,
        tyreManagement: d.tyre_management as number,
        composure: d.composure as number,
        wetSkill: d.wet_skill as number,
        potential: d.potential as number,
      });
      return {
        driverId: d.id as number,
        name: d.name as string,
        age: year - Number(String(d.birth_date).slice(0, 4)),
        potential: reading.potential,
        knowledge: reading.knowledge,
        owned: reading.owned,
      };
    })
    .filter((d) => !d.owned && readingMidpoint(d.potential) >= tips.minPotential)
    .sort(
      (a, b) =>
        readingMidpoint(b.potential) - readingMidpoint(a.potential) || a.driverId - b.driverId,
    )
    .slice(0, tips.max)
    .map((d) => ({
      driverId: d.driverId,
      name: d.name,
      age: d.age,
      potential: d.potential,
      knowledge: d.knowledge,
    }));
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { moraleFactor } from '../sim/morale';
import { createRng } from '../sim/rng';
import { garageFacilityBonuses } from './facilities';
import { crewOutageFactor } from './outages';
import { crewStrength, mechanicOffers, wagePerRound, type MechanicOffer } from '../sim/staff';
import { onMarket } from '../sim/jobs';
import { staffBalance } from '../sim/worldgen/data';
import { ensureOrigins } from './origins';
import { readCareer } from './career';
import { all } from './entries';

/** A mechanic who was let go and is looking for work again. */
export interface MarketMechanic {
  id: number;
  name: string;
  skill: number;
  wagePerWeek: number;
  /** How long they have been out of work, from the year they left. */
  leftYear: number;
}

const yearNow = (db: Database): number => Number(readCareer(db)?.gameDate.slice(0, 4) ?? 0);

/**
 * The mechanics on the job market: those who left a garage without retiring and are still under the
 * retirement age and inside two full seasons out of work. Fired, quit or released with the garage,
 * they stay in the Paddock and on offer until they retire or die.
 */
export function marketMechanics(db: Database): MarketMechanic[] {
  ensureOrigins(db);
  const year = yearNow(db);
  return all(
    db,
    `SELECT id, name, skill, wage_per_week, left_on, left_reason, birth_year FROM staff
      WHERE left_on IS NOT NULL ORDER BY id`,
  )
    .filter((r) =>
      onMarket(
        'mechanic',
        {
          reason: (r.left_reason as string | null) ?? null,
          leftYear: Number(String(r.left_on).slice(0, 4)),
          age: year - ((r.birth_year as number | null) ?? year - 35),
        },
        year,
      ),
    )
    .map((r) => ({
      id: r.id as number,
      name: r.name as string,
      skill: r.skill as number,
      wagePerWeek: r.wage_per_week as number,
      leftYear: Number(String(r.left_on).slice(0, 4)),
    }));
}

export interface Mechanic {
  id: number;
  name: string;
  skill: number;
  wagePerWeek: number;
  /** What the mechanic costs the garage for one round. */
  wagePerRound: number;
  hiredOn: string;
  /** 0 to 100; it moves the mechanic's work a few points either way. */
  morale: number;
}

/** The mechanics a garage employs now. */
export function garageStaff(db: Database, garageId: number): Mechanic[] {
  return all(
    db,
    `SELECT id, name, skill, wage_per_week, hired_on, morale FROM staff
      WHERE garage_id = ? AND left_on IS NULL ORDER BY id`,
    [garageId],
  ).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    skill: r.skill as number,
    wagePerWeek: r.wage_per_week as number,
    wagePerRound: wagePerRound(r.wage_per_week as number),
    hiredOn: r.hired_on as string,
    morale: r.morale as number,
  }));
}

/** How well a garage's mechanics cover its entries this season (0 to 1). */
export function garageCrewStrength(db: Database, garageId: number, roundId?: number): number {
  const entries = Number(
    all(
      db,
      `SELECT COUNT(*) AS n FROM entry
        WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season)`,
      [garageId],
    )[0]!.n,
  );
  const strength = crewStrength(
    garageStaff(db, garageId).map((m) => m.skill * moraleFactor(m.morale)),
    entries,
    garageFacilityBonuses(db, garageId).crewCover,
  );
  // In a round with an electricity outage the crew is idle part of the time.
  return roundId === undefined ? strength : strength * crewOutageFactor(db, garageId, roundId);
}

/** What a garage pays its mechanics for one round. */
export function roundWages(db: Database, garageId: number): number {
  return garageStaff(db, garageId).reduce((sum, m) => sum + m.wagePerRound, 0);
}

/**
 * The mechanics on offer to a garage. They are drawn from the career's seed, the garage and how
 * many mechanics it has ever hired, so the same offers wait until someone is hired.
 */
export function mechanicCandidates(
  db: Database,
  garageId: number,
): (MechanicOffer & { staffId?: number })[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const hired = Number(
    all(db, 'SELECT COUNT(*) AS n FROM staff WHERE garage_id = ?', [garageId])[0]!.n,
  );
  const rng = createRng(career.masterSeed).stream(`staff:${garageId}:${hired}`);
  // Those on the market come after the new faces, best first (at most three).
  const known = marketMechanics(db)
    .sort((a, b) => b.skill - a.skill || a.id - b.id)
    .slice(0, 3)
    .map((m) => ({ name: m.name, skill: m.skill, wagePerWeek: m.wagePerWeek, staffId: m.id }));
  return [...mechanicOffers(rng), ...known];
}

/** Hires one of the offered mechanics (by position in the list of offers). They are paid from the next round. */
export function hireMechanic(db: Database, garageId: number, offer: number): Mechanic {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const garage = all(db, 'SELECT kind, closed_year FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing' || garage.closed_year !== null)
    throw new Error(`There is no racing garage ${garageId}.`);
  if (garageStaff(db, garageId).length >= staffBalance.maxPerGarage)
    throw new Error(`A garage can employ at most ${staffBalance.maxPerGarage} mechanics.`);
  const chosen = mechanicCandidates(db, garageId)[offer];
  if (!chosen) throw new Error('There is no such mechanic on offer.');
  let id: number;
  if (chosen.staffId !== undefined) {
    // Someone from the market is taken on again: the same person, with their history.
    id = chosen.staffId;
    db.run(
      'UPDATE staff SET garage_id = ?, left_on = NULL, left_reason = NULL, hired_on = ? WHERE id = ?',
      [garageId, career.gameDate, id],
    );
  } else {
    db.run(
      "INSERT INTO staff (garage_id, role, name, skill, wage_per_week, hired_on) VALUES (?, 'mechanic', ?, ?, ?, ?)",
      [garageId, chosen.name, chosen.skill, chosen.wagePerWeek, career.gameDate],
    );
    id = Number(all(db, 'SELECT MAX(id) AS n FROM staff')[0]!.n);
  }
  return garageStaff(db, garageId).find((m) => m.id === id)!;
}

/**
 * Lets a mechanic go. The garage pays a round's wages as notice, so hiring a crew for a race and
 * dismissing it after is no cheaper than keeping it. Returns what was paid.
 */
export function fireMechanic(db: Database, garageId: number, staffId: number): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const mechanic = garageStaff(db, garageId).find((m) => m.id === staffId);
  if (!mechanic) throw new Error('The garage does not employ this mechanic.');
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  const notice = mechanic.wagePerRound;
  if (cash < notice) throw new Error('The garage cannot afford the notice pay.');
  db.exec('BEGIN');
  try {
    db.run("UPDATE staff SET left_on = ?, left_reason = 'fired' WHERE id = ?", [
      career.gameDate,
      staffId,
    ]);
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

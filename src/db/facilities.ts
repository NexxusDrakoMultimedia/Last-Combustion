// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  FACILITY_KINDS,
  MAX_FACILITY_LEVEL,
  facilityBonuses,
  facilityDef,
  levelCost,
  runningCost,
  type FacilityBonuses,
  type FacilityKind,
  type FacilityLevels,
} from '../sim/facilities';
import { readCareer } from './career';
import { all } from './entries';

/** The facilities a garage holds, with their levels. */
export function garageFacilities(db: Database, garageId: number): FacilityLevels {
  const levels: FacilityLevels = {};
  for (const r of all(db, 'SELECT kind, level FROM facility WHERE garage_id = ?', [garageId]))
    levels[r.kind as FacilityKind] = r.level as number;
  return levels;
}

/** What a garage's facilities add up to. */
export const garageFacilityBonuses = (db: Database, garageId: number): FacilityBonuses =>
  facilityBonuses(garageFacilities(db, garageId));

/** What a garage's facilities cost to run for one round. */
export function roundFacilityCost(db: Database, garageId: number): number {
  const levels = garageFacilities(db, garageId);
  return FACILITY_KINDS.reduce((sum, kind) => sum + runningCost(kind, levels[kind] ?? 0), 0);
}

export interface FacilityView {
  kind: FacilityKind;
  level: number;
  /** The price of the next level, or null at the top. */
  nextCost: number | null;
  /** What it costs to run each round now, and after the next level. */
  running: number;
  nextRunning: number | null;
  needs: FacilityKind | null;
  /** Whether the facility it needs is in place. */
  needsMet: boolean;
  /** The effect per level (see `data/facilities.json`). */
  effect: Record<string, number>;
}

export function facilityViews(db: Database, garageId: number): FacilityView[] {
  const levels = garageFacilities(db, garageId);
  return FACILITY_KINDS.map((kind) => {
    const level = levels[kind] ?? 0;
    const def = facilityDef(kind);
    const top = level >= MAX_FACILITY_LEVEL;
    return {
      kind,
      level,
      nextCost: top ? null : levelCost(kind, level + 1),
      running: runningCost(kind, level),
      nextRunning: top ? null : runningCost(kind, level + 1),
      needs: def.needs,
      needsMet: def.needs === null || (levels[def.needs] ?? 0) > 0,
      effect: def.effect,
    };
  });
}

/**
 * Builds a facility or takes it up a level. The garage pays for the new level at once and its running
 * cost comes out of each round's bills. Returns the price paid.
 */
export function buildFacility(db: Database, garageId: number, kind: FacilityKind): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  if (!FACILITY_KINDS.includes(kind)) throw new Error(`There is no facility "${kind}".`);
  const garage = all(db, 'SELECT cash, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const levels = garageFacilities(db, garageId);
  const level = levels[kind] ?? 0;
  if (level >= MAX_FACILITY_LEVEL) throw new Error('This facility is already at its top level.');
  const needs = facilityDef(kind).needs;
  if (needs && (levels[needs] ?? 0) === 0)
    throw new Error(`This facility needs the ${needs} first.`);
  const price = levelCost(kind, level + 1);
  if ((garage.cash as number) < price) throw new Error('The garage cannot afford this.');
  db.exec('BEGIN');
  try {
    db.run(
      `INSERT INTO facility (garage_id, kind, level) VALUES (?, ?, ?)
       ON CONFLICT (garage_id, kind) DO UPDATE SET level = excluded.level`,
      [garageId, kind, level + 1],
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'facilities', ?, ?)",
      [garageId, career.gameDate, -price, `${kind} level ${level + 1}`],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, garageId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return price;
}

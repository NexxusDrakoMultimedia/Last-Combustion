// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { stepMorale, moraleTarget, quitChance } from '../sim/morale';
import { marketSalary } from '../sim/executives';
import { createRng } from '../sim/rng';
import { wageFor } from '../sim/staff';
import { readCareer } from './career';
import { all } from './entries';
import { garageFacilities } from './facilities';

/**
 * Moves everyone's morale towards where their pay, the garage's results, its facilities and (for a
 * mechanic) the workload put it. `standing` gives a garage's finishing place (1 is the champion)
 * out of how many garages there were.
 */
export function updateMorale(
  db: Database,
  standing: (garageId: number) => { rank: number; of: number } | null,
): void {
  const results = (garageId: number): number => {
    const s = standing(garageId);
    return s && s.of > 1 ? 1 - (s.rank - 1) / (s.of - 1) : 0.5;
  };
  const levels = new Map<number, number>();
  const facilityLevels = (garageId: number): number => {
    if (!levels.has(garageId))
      levels.set(
        garageId,
        Object.values(garageFacilities(db, garageId)).reduce((s, l) => s + (l ?? 0), 0),
      );
    return levels.get(garageId)!;
  };
  for (const e of all(
    db,
    "SELECT id, garage_id, skill, salary, morale FROM executive WHERE status = 'employed'",
  )) {
    const garageId = e.garage_id as number;
    const target = moraleTarget({
      pay: (e.salary as number) / marketSalary(e.skill as number),
      results: results(garageId),
      facilityLevels: facilityLevels(garageId),
    });
    db.run('UPDATE executive SET morale = ? WHERE id = ?', [
      stepMorale(e.morale as number, target),
      e.id as number,
    ]);
  }
  for (const m of all(
    db,
    'SELECT id, garage_id, skill, wage_per_week, morale FROM staff WHERE left_on IS NULL',
  )) {
    const garageId = m.garage_id as number;
    const crew = Number(
      all(db, 'SELECT COUNT(*) AS n FROM staff WHERE garage_id = ? AND left_on IS NULL', [
        garageId,
      ])[0]!.n,
    );
    const entries = Number(
      all(
        db,
        `SELECT COUNT(*) AS n FROM entry
          WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season)`,
        [garageId],
      )[0]!.n,
    );
    const target = moraleTarget({
      pay: (m.wage_per_week as number) / wageFor(m.skill as number),
      results: results(garageId),
      facilityLevels: facilityLevels(garageId),
      cover: entries === 0 ? 1 : crew / entries,
    });
    db.run('UPDATE staff SET morale = ? WHERE id = ?', [
      stepMorale(m.morale as number, target),
      m.id as number,
    ]);
  }
}

/**
 * Mechanics whose morale has sunk too low may leave at the start of a year. Returns the ids of the
 * garages' mechanics who left.
 */
export function leaveUnhappy(db: Database, year: number): number[] {
  const career = readCareer(db);
  if (!career) return [];
  const rng = createRng(career.masterSeed);
  const left: number[] = [];
  for (const m of all(
    db,
    'SELECT id, morale FROM staff WHERE left_on IS NULL AND morale < 25 ORDER BY id',
  )) {
    const id = m.id as number;
    if (rng.stream(`morale:quit:${id}:${year}`).chance(quitChance(m.morale as number))) {
      db.run("UPDATE staff SET left_on = ?, left_reason = 'quit' WHERE id = ?", [
        `${year}-02-01`,
        id,
      ]);
      left.push(id);
    }
  }
  return left;
}

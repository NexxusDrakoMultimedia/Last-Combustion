// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { executiveBonuses, type ExecutiveBonuses, type ExecutiveRole } from '../sim/executives';
import { moraleFactor } from '../sim/morale';
import { all } from './entries';

/** What a garage's employed executives add up to (all zero for a garage with none). */
export function garageBonuses(db: Database, garageId: number): ExecutiveBonuses {
  return executiveBonuses(
    all(
      db,
      "SELECT role, skill, morale FROM executive WHERE garage_id = ? AND status = 'employed'",
      [garageId],
    ).map((r) => ({
      role: r.role as ExecutiveRole,
      skill: Math.min(100, (r.skill as number) * moraleFactor(r.morale as number)),
    })),
  );
}

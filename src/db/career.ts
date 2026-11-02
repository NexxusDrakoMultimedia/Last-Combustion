// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';

export type CareerMode = 'garage_owner' | 'owner_driver' | 'driver_manager';
export type Difficulty = 'relaxed' | 'standard' | 'hard';

export interface NewCareer {
  mode: CareerMode;
  masterSeed: string;
  startYear: number;
  difficulty: Difficulty;
  /** ISO date. Defaults to 1 February of the start year, in the off-season before Round 1. */
  gameDate?: string;
  founderCareer?: boolean;
}

export interface CareerRow {
  mode: CareerMode;
  masterSeed: string;
  startYear: number;
  gameDate: string;
  difficulty: Difficulty;
  founderCareer: boolean;
}

export function createCareer(db: Database, career: NewCareer): void {
  db.run(
    `INSERT INTO career (id, mode, master_seed, start_year, game_date, difficulty, founder_career)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    [
      career.mode,
      career.masterSeed,
      career.startYear,
      career.gameDate ?? `${career.startYear}-02-01`,
      career.difficulty,
      career.founderCareer ? 1 : 0,
    ],
  );
}

export function readCareer(db: Database): CareerRow | undefined {
  const rows = db.exec(
    'SELECT mode, master_seed, start_year, game_date, difficulty, founder_career FROM career WHERE id = 1',
  );
  const row = rows[0]?.values[0];
  if (!row) return undefined;
  return {
    mode: row[0] as CareerMode,
    masterSeed: String(row[1]),
    startYear: Number(row[2]),
    gameDate: String(row[3]),
    difficulty: row[4] as Difficulty,
    founderCareer: Number(row[5]) === 1,
  };
}

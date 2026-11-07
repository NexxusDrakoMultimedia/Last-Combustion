// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { rollDeath } from '../sim/deaths';
import { createRng } from '../sim/rng';
import { all } from './entries';

export type DeadKind = 'driver' | 'mechanic' | 'executive';

export interface Death {
  kind: DeadKind;
  id: number;
  name: string;
  date: string;
  cause: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Rolls a year's non-racing deaths among everyone alive and working in the series: drivers who have
 * not retired, mechanics who still have a job and executives who are employed. The player's own owner
 * is not among them (there is no succession yet to take over from them). Each person rolls once, from
 * a stream named for the year, the kind of person and their id, so the same save always has the same
 * deaths. Reads only; `recordDeaths` writes.
 */
export function rollDeaths(db: Database, masterSeed: string, lastYear: number): Death[] {
  const rng = createRng(masterSeed);
  const people: { kind: DeadKind; id: number; name: string }[] = [
    ...all(db, 'SELECT id, name FROM driver WHERE retired_year IS NULL ORDER BY id').map((r) => ({
      kind: 'driver' as const,
      id: r.id as number,
      name: r.name as string,
    })),
    ...all(db, 'SELECT id, name FROM staff WHERE left_on IS NULL ORDER BY id').map((r) => ({
      kind: 'mechanic' as const,
      id: r.id as number,
      name: r.name as string,
    })),
    ...all(db, "SELECT id, name FROM executive WHERE status = 'employed' ORDER BY id").map((r) => ({
      kind: 'executive' as const,
      id: r.id as number,
      name: r.name as string,
    })),
  ];
  const out: Death[] = [];
  for (const p of people) {
    const roll = rollDeath(rng.stream(`death:${lastYear}:${p.kind}:${p.id}`));
    if (roll)
      out.push({
        ...p,
        date: `${lastYear}-${pad(roll.month)}-${pad(roll.day)}`,
        cause: roll.cause,
      });
  }
  return out;
}

/** Writes deaths: each is logged, and the person's own row says they have gone. */
export function recordDeaths(db: Database, deaths: readonly Death[], lastYear: number): void {
  for (const d of deaths) {
    db.run('INSERT INTO death (person_type, person_id, name, date, cause) VALUES (?, ?, ?, ?, ?)', [
      d.kind,
      d.id,
      d.name,
      d.date,
      d.cause,
    ]);
    if (d.kind === 'driver') {
      db.run('UPDATE driver SET retired_year = ? WHERE id = ? AND retired_year IS NULL', [
        lastYear,
        d.id,
      ]);
    } else if (d.kind === 'mechanic') {
      db.run('UPDATE staff SET left_on = ? WHERE id = ?', [d.date, d.id]);
    } else {
      db.run(
        "UPDATE executive SET status = 'left', left_on = ?, left_reason = 'retired', end_year = ? WHERE id = ?",
        [d.date, lastYear, d.id],
      );
    }
  }
}

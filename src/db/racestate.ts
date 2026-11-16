// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { readCareer } from './career';
import { all } from './entries';

export type RaceKind = 'prelims' | 'final';

/** A race under way, as it was last saved. */
export interface SavedRace<Input, State> {
  input: Input;
  state: State;
  /** Prelim days played, or sectors of the final run. */
  progress: number;
}

const today = (db: Database): string => readCareer(db)?.gameDate ?? '';

/** Writes (or replaces) the saved state of a race. `input` is kept from the first save and never replaced. */
export function saveRace(
  db: Database,
  roundId: number,
  kind: RaceKind,
  input: unknown,
  state: unknown,
  progress: number,
  plan: unknown = null,
): void {
  db.run(
    `INSERT INTO race_state (round_id, kind, input, state, progress, started_on, saved_on, plan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (round_id, kind) DO UPDATE SET state = excluded.state,
       progress = excluded.progress, saved_on = excluded.saved_on`,
    [
      roundId,
      kind,
      JSON.stringify(input),
      JSON.stringify(state),
      progress,
      today(db),
      today(db),
      plan === null ? null : JSON.stringify(plan),
    ],
  );
}

/** What the calendar keeps of a race under way: the dates of the prelim days, and how many are played. */
export interface PrelimPlan {
  roundNumber: number;
  daysPlayed: number;
  /** `runs` is how many entries run on the day. */
  days: { day: number; date: string; runs?: number }[];
}

/** The prelim days of every round whose prelims are under way, for the calendar (small: no saved state is read). */
export function prelimPlans(db: Database): PrelimPlan[] {
  return all(
    db,
    `SELECT ro.number, rs.progress, rs.plan FROM race_state rs JOIN round ro ON ro.id = rs.round_id
      WHERE rs.kind = 'prelims' AND rs.plan IS NOT NULL ORDER BY ro.number`,
  ).map((r) => ({
    roundNumber: Number(r.number),
    daysPlayed: Number(r.progress),
    days: JSON.parse(String(r.plan)) as { day: number; date: string; runs?: number }[],
  }));
}

/** The saved state of a race, or null if it has not been started or is finished. */
export function loadRace<Input, State>(
  db: Database,
  roundId: number,
  kind: RaceKind,
): SavedRace<Input, State> | null {
  const row = all(
    db,
    'SELECT input, state, progress FROM race_state WHERE round_id = ? AND kind = ?',
    [roundId, kind],
  )[0];
  if (!row) return null;
  return {
    input: JSON.parse(String(row.input)) as Input,
    state: JSON.parse(String(row.state)) as State,
    progress: Number(row.progress),
  };
}

/** Forgets a race once it is finished. */
export function clearRace(db: Database, roundId: number, kind: RaceKind): void {
  db.run('DELETE FROM race_state WHERE round_id = ? AND kind = ?', [roundId, kind]);
}

/** The race under way, if there is one: which round, which part and how far. */
export function raceUnderWay(
  db: Database,
): { roundNumber: number; kind: RaceKind; progress: number } | null {
  const row = all(
    db,
    `SELECT ro.number, rs.kind, rs.progress FROM race_state rs JOIN round ro ON ro.id = rs.round_id
      ORDER BY rs.saved_on DESC, ro.number DESC LIMIT 1`,
  )[0];
  return row
    ? {
        roundNumber: Number(row.number),
        kind: row.kind as RaceKind,
        progress: Number(row.progress),
      }
    : null;
}

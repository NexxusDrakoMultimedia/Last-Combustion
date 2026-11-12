// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  easyGhostMs,
  ghostCandidates,
  settleGhost,
  type GhostMode,
  type LastYearRun,
} from '../sim/ghost';
import { all } from './entries';

/** A ghost on offer for a round: one of last year's top drivers and the time they set on the course. */
export interface GhostOption {
  driverId: number;
  name: string;
  points: number;
  timeMs: number;
}

/** What the player picked for an entry: Easy, or Hard with a driver (null clears the pick). */
export type GhostPick = { mode: 'easy' } | { mode: 'hard'; driverId: number };

export interface GhostEntry {
  entryId: number;
  raceNumber: number;
  driver: string;
  /** The pick for the next round, if any. */
  pick: { mode: GhostMode; driverId: number | null; ghostName: string | null } | null;
}

/** How a settled ghost went for one of the player's entries. */
export interface GhostResult {
  round: number;
  year: number;
  raceNumber: number;
  driver: string;
  mode: GhostMode;
  ghostName: string | null;
  ghostTimeMs: number | null;
  ownTimeMs: number | null;
  /** Whether the run beat a Hard ghost (null for Easy, which is always two seconds ahead). */
  beaten: boolean | null;
  /** How far ahead of the ghost the run was (negative: behind). Null when either has no time. */
  deltaMs: number | null;
}

export interface GhostView {
  /** There is a ghost to pick only from the second season, when there is a last year. */
  available: boolean;
  /** The next round whose prelims have not been run, which the picks are for. */
  round: number | null;
  options: GhostOption[];
  entries: GhostEntry[];
  results: GhostResult[];
}

const latestSeason = (db: Database) =>
  all(db, 'SELECT id, year FROM season ORDER BY year DESC LIMIT 1')[0];

/** The round number the next prelims will be, or null when every round has been run. */
function nextRound(db: Database, seasonId: number): number | null {
  const r = all(
    db,
    "SELECT MIN(number) AS n FROM round WHERE season_id = ? AND status = 'scheduled'",
    [seasonId],
  )[0];
  return (r?.n as number | null) ?? null;
}

/**
 * The ghosts on offer for a round of the latest season (see the GDD, "Ghost record"): last season's top
 * five drivers by points who set a time on the same course. The first season has none.
 */
export function ghostOptions(db: Database, roundNumber: number): GhostOption[] {
  const season = latestSeason(db);
  if (!season) return [];
  const course = all(db, 'SELECT course_id FROM round WHERE season_id = ? AND number = ?', [
    season.id as number,
    roundNumber,
  ])[0];
  const last = all(db, 'SELECT id FROM season WHERE year = ?', [(season.year as number) - 1])[0];
  if (!course || !last) return [];
  const lastRound = all(db, 'SELECT id FROM round WHERE season_id = ? AND course_id = ?', [
    last.id as number,
    course.course_id as number,
  ])[0];
  if (!lastRound) return [];
  const times = new Map(
    all(
      db,
      `SELECT e.driver_id, r.prelim_time_ms FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
        WHERE r.round_id = ?`,
      [lastRound.id as number],
    ).map((r) => [r.driver_id as number, r.prelim_time_ms as number | null]),
  );
  const runs: LastYearRun[] = all(
    db,
    `SELECT e.driver_id, COALESCE(SUM(r.points), 0) AS points FROM result r
       JOIN entry e ON e.id = r.entry_id AND e.series = 'main' JOIN round ro ON ro.id = r.round_id
      WHERE ro.season_id = ? GROUP BY e.driver_id ORDER BY e.driver_id`,
    [last.id as number],
  ).map((r) => ({
    driverId: r.driver_id as number,
    points: r.points as number,
    timeMs: times.get(r.driver_id as number) ?? null,
  }));
  return ghostCandidates(runs).map((c) => ({
    ...c,
    name: all(db, 'SELECT name FROM driver WHERE id = ?', [c.driverId])[0]!.name as string,
  }));
}

/**
 * Picks a ghost for one of the player's entries for the next round's prelims, or clears the pick. Easy
 * runs two seconds ahead of the entry; Hard is one of the ghosts on offer. The prelims settle it. A pick
 * for an entry that is not the player's, a Hard ghost that is not on offer (there are none in the first
 * season) or a season with no round left to run is refused with an error and nothing changes.
 */
export function setGhost(db: Database, entryId: number, pick: GhostPick | null): void {
  const season = latestSeason(db);
  if (!season) throw new Error('There is no season in this database.');
  const entry = all(
    db,
    `SELECT e.id FROM entry e JOIN garage g ON g.id = e.garage_id
      WHERE e.id = ? AND e.season_id = ? AND e.series = 'main' AND g.is_player = 1`,
    [entryId, season.id as number],
  )[0];
  if (!entry) throw new Error('That is not one of the garage entries this season.');
  if (all(db, 'SELECT 1 FROM season WHERE year = ?', [(season.year as number) - 1]).length === 0)
    throw new Error('There is no ghost in the first season.');
  const round = nextRound(db, season.id as number);
  if (round === null) throw new Error('Every round of the season has been run.');
  const roundId = all(db, 'SELECT id FROM round WHERE season_id = ? AND number = ?', [
    season.id as number,
    round,
  ])[0]!.id as number;
  if (pick === null) {
    db.run('DELETE FROM ghost_choice WHERE round_id = ? AND entry_id = ?', [roundId, entryId]);
    return;
  }
  if (pick.mode === 'hard' && !ghostOptions(db, round).some((o) => o.driverId === pick.driverId))
    throw new Error('That driver is not one of the ghosts on offer.');
  db.run(
    `INSERT INTO ghost_choice (round_id, entry_id, mode, ghost_driver_id) VALUES (?, ?, ?, ?)
     ON CONFLICT (round_id, entry_id) DO UPDATE SET mode = excluded.mode,
       ghost_driver_id = excluded.ghost_driver_id, ghost_time_ms = NULL, own_time_ms = NULL,
       beaten = NULL, settled = 0`,
    [roundId, entryId, pick.mode, pick.mode === 'hard' ? pick.driverId : null],
  );
}

/**
 * Settles the round's picks once its prelims have been written: a Hard ghost's time is the driver's run
 * from last season and is beaten by a faster run; an Easy ghost runs two seconds ahead of the entry and
 * is never beaten or lost to. A pick is settled once, so a second call changes nothing.
 */
export function settleGhosts(db: Database, roundId: number): void {
  const picks = all(
    db,
    `SELECT g.entry_id, g.mode, g.ghost_driver_id, r.prelim_time_ms, ro.number
       FROM ghost_choice g JOIN round ro ON ro.id = g.round_id
       LEFT JOIN result r ON r.round_id = g.round_id AND r.entry_id = g.entry_id
      WHERE g.round_id = ? AND g.settled = 0 ORDER BY g.entry_id`,
    [roundId],
  );
  if (picks.length === 0) return;
  const options = ghostOptions(db, picks[0]!.number as number);
  for (const p of picks) {
    const own = (p.prelim_time_ms as number | null) ?? null;
    let ghost: number | null;
    let beaten: number | null = null;
    if (p.mode === 'hard') {
      ghost = options.find((o) => o.driverId === p.ghost_driver_id)?.timeMs ?? null;
      if (ghost !== null) beaten = settleGhost(own, ghost).beaten ? 1 : 0;
    } else {
      ghost = easyGhostMs(own);
    }
    db.run(
      `UPDATE ghost_choice SET ghost_time_ms = ?, own_time_ms = ?, beaten = ?, settled = 1
        WHERE round_id = ? AND entry_id = ?`,
      [ghost, own, beaten, roundId, p.entry_id as number],
    );
  }
}

/** The ghost screen: what is on offer for the next round, the picks, and how the last picks went. */
export function ghostView(db: Database): GhostView {
  const season = latestSeason(db);
  const empty: GhostView = { available: false, round: null, options: [], entries: [], results: [] };
  if (!season) return empty;
  const available =
    all(db, 'SELECT 1 FROM season WHERE year = ?', [(season.year as number) - 1]).length > 0;
  const round = nextRound(db, season.id as number);
  const options = round === null ? [] : ghostOptions(db, round);
  const picks = new Map(
    all(
      db,
      `SELECT g.entry_id, g.mode, g.ghost_driver_id FROM ghost_choice g JOIN round ro ON ro.id = g.round_id
        WHERE ro.season_id = ? AND ro.number = ?`,
      [season.id as number, round ?? 0],
    ).map((p) => [p.entry_id as number, p]),
  );
  const names = new Map(options.map((o) => [o.driverId, o.name]));
  const entries = all(
    db,
    `SELECT e.id, e.race_number, d.name FROM entry e JOIN garage g ON g.id = e.garage_id
       JOIN driver d ON d.id = e.driver_id
      WHERE e.season_id = ? AND e.series = 'main' AND g.is_player = 1 ORDER BY e.id`,
    [season.id as number],
  ).map((e): GhostEntry => {
    const p = picks.get(e.id as number);
    return {
      entryId: e.id as number,
      raceNumber: e.race_number as number,
      driver: e.name as string,
      pick: p
        ? {
            mode: p.mode as GhostMode,
            driverId: (p.ghost_driver_id as number | null) ?? null,
            ghostName: names.get(p.ghost_driver_id as number) ?? null,
          }
        : null,
    };
  });
  const last = all(
    db,
    `SELECT MAX(ro.id) AS id FROM ghost_choice g JOIN round ro ON ro.id = g.round_id WHERE g.settled = 1`,
  )[0];
  const results = last?.id
    ? all(
        db,
        `SELECT ro.number, s.year, e.race_number, d.name AS driver, g.mode, gd.name AS ghost_name,
                g.ghost_time_ms, g.own_time_ms, g.beaten
           FROM ghost_choice g JOIN round ro ON ro.id = g.round_id JOIN season s ON s.id = ro.season_id
           JOIN entry e ON e.id = g.entry_id JOIN driver d ON d.id = e.driver_id
           LEFT JOIN driver gd ON gd.id = g.ghost_driver_id
          WHERE g.round_id = ? AND g.settled = 1 ORDER BY g.entry_id`,
        [last.id as number],
      ).map((r): GhostResult => {
        const ghost = (r.ghost_time_ms as number | null) ?? null;
        const own = (r.own_time_ms as number | null) ?? null;
        return {
          round: r.number as number,
          year: r.year as number,
          raceNumber: r.race_number as number,
          driver: r.driver as string,
          mode: r.mode as GhostMode,
          ghostName: (r.ghost_name as string | null) ?? null,
          ghostTimeMs: ghost,
          ownTimeMs: own,
          beaten: r.beaten === null ? null : r.beaten === 1,
          deltaMs: ghost !== null && own !== null ? ghost - own : null,
        };
      })
    : [];
  return { available, round, options, entries, results };
}

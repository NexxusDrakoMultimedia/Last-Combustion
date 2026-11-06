// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { seasonAwards, type AwardWon } from './awards';
import { all } from './entries';

/** One place on a record's leaderboard: someone with a non-zero score in that category. */
export interface BoardRow {
  subjectType: 'driver' | 'garage';
  subjectId: number;
  name: string;
  value: number;
  /** Set for single-season records: the season of this person's best. */
  year?: number;
}

/** One all-time record: who holds it, how much, and the year for a single-season record. */
export interface RecordLine {
  id: string;
  holder: string;
  value: number;
  /** Set for single-season records. */
  year?: number;
  /** Who holds the record. */
  subjectType: 'driver' | 'garage';
  subjectId: number;
  /** Everyone with a non-zero score in the category, best first (the holder is first). */
  board: BoardRow[];
}

/** A finished season in the history: its champions and awards. */
export interface SeasonSummary {
  year: number;
  championDriverId: number;
  championGarageId: number;
  championDriver: string;
  championGarage: string;
  championPoints: number;
  awards: AwardWon[];
}

export interface RecordBook {
  records: RecordLine[];
  seasons: SeasonSummary[];
}

type Row = Record<string, string | number | null>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** A record and its leaderboard from rows already ordered best first; a category nobody has scored in has no record. */
function recordOf(
  rows: Row[],
  id: string,
  scope: 'driver' | 'garage',
  withYear = false,
): RecordLine | undefined {
  const board: BoardRow[] = rows
    .filter((r) => (r.value as number) > 0)
    .map((r) => ({
      subjectType: scope,
      subjectId: r.id as number,
      name: String(r.name),
      value: round1(r.value as number),
      ...(withYear ? { year: r.year as number } : {}),
    }));
  const top = board[0];
  if (!top) return undefined;
  return {
    id,
    holder: top.name,
    value: top.value,
    ...(withYear ? { year: top.year } : {}),
    subjectType: scope,
    subjectId: top.subjectId,
    board,
  };
}

/**
 * The record book of the Super Series: all-time and single-season records for drivers and garages,
 * each with a leaderboard of everyone who has scored in the category, and the champions and awards of
 * every finished season (newest first). Ties go to whoever set the score first, so the book never
 * changes under a holder.
 */
export function recordBook(db: Database): RecordBook {
  const career = (scope: 'driver' | 'garage', value: string): Row[] =>
    all(
      db,
      `SELECT x.id AS id, x.name AS name, ${value} AS value
         FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN ${scope} x ON x.id = e.${scope}_id
        GROUP BY x.id HAVING value > 0 ORDER BY value DESC, MIN(r.round_id), x.id`,
    );
  // One row for each driver or garage: their best season.
  const bySeason = (scope: 'driver' | 'garage', value: string): Row[] => {
    const rows = all(
      db,
      `SELECT x.id AS id, x.name AS name, s.year AS year, ${value} AS value
         FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
         JOIN ${scope} x ON x.id = e.${scope}_id
        GROUP BY x.id, s.id HAVING value > 0 ORDER BY value DESC, s.year, x.id`,
    );
    const seen = new Set<number>();
    return rows.filter((r) => {
      if (seen.has(r.id as number)) return false;
      seen.add(r.id as number);
      return true;
    });
  };
  const titles = (scope: 'driver' | 'garage'): Row[] =>
    all(
      db,
      `SELECT x.id AS id, x.name AS name, COUNT(*) AS value FROM season s
         JOIN ${scope} x ON x.id = s.champion_${scope}_id
        GROUP BY x.id ORDER BY value DESC, MIN(s.year), x.id`,
    );

  const lines = [
    recordOf(career('driver', 'SUM(r.points)'), 'driver_points', 'driver'),
    recordOf(
      career('driver', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'driver_wins',
      'driver',
    ),
    recordOf(career('driver', 'SUM(r.pole)'), 'driver_poles', 'driver'),
    recordOf(titles('driver'), 'driver_titles', 'driver'),
    recordOf(bySeason('driver', 'SUM(r.points)'), 'driver_season_points', 'driver', true),
    recordOf(
      bySeason('driver', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'driver_season_wins',
      'driver',
      true,
    ),
    recordOf(
      career('garage', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'garage_wins',
      'garage',
    ),
    recordOf(titles('garage'), 'garage_titles', 'garage'),
    recordOf(bySeason('garage', 'SUM(r.points)'), 'garage_season_points', 'garage', true),
  ];

  const seasons = all(
    db,
    `SELECT s.year, s.champion_driver_id AS driver_id, s.champion_garage_id AS garage_id, d.name AS driver, g.name AS garage,
            (SELECT points FROM standing_snapshot WHERE season_id = s.id AND table_kind = 'driver' AND position = 1) AS points
       FROM season s JOIN driver d ON d.id = s.champion_driver_id JOIN garage g ON g.id = s.champion_garage_id
      WHERE s.status = 'complete' ORDER BY s.year DESC`,
  ).map((r) => ({
    year: r.year as number,
    championDriverId: r.driver_id as number,
    championGarageId: r.garage_id as number,
    championDriver: r.driver as string,
    championGarage: r.garage as string,
    championPoints: Math.round(((r.points as number | null) ?? 0) * 10) / 10,
    awards: seasonAwards(db, r.year as number),
  }));

  return { records: lines.filter((l): l is RecordLine => l !== undefined), seasons };
}

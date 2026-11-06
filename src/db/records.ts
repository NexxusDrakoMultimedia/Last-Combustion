// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { seasonAwards, type AwardWon } from './awards';
import { all } from './entries';

/** One all-time record: who holds it, how much, and the year for a single-season record. */
export interface RecordLine {
  id: string;
  holder: string;
  value: number;
  /** Set for single-season records. */
  year?: number;
}

/** A finished season in the history: its champions and awards. */
export interface SeasonSummary {
  year: number;
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

const best = (rows: Row[], id: string, withYear = false): RecordLine | undefined => {
  const r = rows[0];
  if (!r || !((r.value as number) > 0)) return undefined;
  return {
    id,
    holder: String(r.name),
    value: Math.round((r.value as number) * 10) / 10,
    ...(withYear ? { year: r.year as number } : {}),
  };
};

/**
 * The record book of the Super Series: all-time and single-season records for drivers and garages,
 * and the champions and awards of every finished season (newest first). Ties go to whoever set the
 * record first, so the book never changes under a holder.
 */
export function recordBook(db: Database): RecordBook {
  const career = (
    scope: 'driver' | 'garage',
    metric: string,
    value: string,
    extraJoin = '',
  ): Row[] =>
    all(
      db,
      `SELECT x.name AS name, ${value} AS value
         FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN ${scope} x ON x.id = e.${scope}_id ${extraJoin}
        GROUP BY x.id HAVING ${metric} ORDER BY value DESC, MIN(r.round_id), x.id LIMIT 1`,
    );
  const bySeason = (scope: 'driver' | 'garage', value: string): Row[] =>
    all(
      db,
      `SELECT x.name AS name, s.year AS year, ${value} AS value
         FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
         JOIN ${scope} x ON x.id = e.${scope}_id
        GROUP BY x.id, s.id ORDER BY value DESC, s.year, x.id LIMIT 1`,
    );
  const titles = (scope: 'driver' | 'garage'): Row[] =>
    all(
      db,
      `SELECT x.name AS name, COUNT(*) AS value FROM season s
         JOIN ${scope} x ON x.id = s.champion_${scope}_id
        GROUP BY x.id ORDER BY value DESC, MIN(s.year), x.id LIMIT 1`,
    );

  const lines = [
    best(career('driver', 'value > 0', 'SUM(r.points)'), 'driver_points'),
    best(
      career('driver', 'value > 0', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'driver_wins',
    ),
    best(career('driver', 'value > 0', 'SUM(r.pole)'), 'driver_poles'),
    best(titles('driver'), 'driver_titles'),
    best(bySeason('driver', 'SUM(r.points)'), 'driver_season_points', true),
    best(
      bySeason('driver', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'driver_season_wins',
      true,
    ),
    best(
      career('garage', 'value > 0', 'COUNT(CASE WHEN r.final_pos = 1 THEN 1 END)'),
      'garage_wins',
    ),
    best(titles('garage'), 'garage_titles'),
    best(bySeason('garage', 'SUM(r.points)'), 'garage_season_points', true),
  ];

  const seasons = all(
    db,
    `SELECT s.year, d.name AS driver, g.name AS garage,
            (SELECT points FROM standing_snapshot WHERE season_id = s.id AND table_kind = 'driver' AND position = 1) AS points
       FROM season s JOIN driver d ON d.id = s.champion_driver_id JOIN garage g ON g.id = s.champion_garage_id
      WHERE s.status = 'complete' ORDER BY s.year DESC`,
  ).map((r) => ({
    year: r.year as number,
    championDriver: r.driver as string,
    championGarage: r.garage as string,
    championPoints: Math.round(((r.points as number | null) ?? 0) * 10) / 10,
    awards: seasonAwards(db, r.year as number),
  }));

  return { records: lines.filter((l): l is RecordLine => l !== undefined), seasons };
}

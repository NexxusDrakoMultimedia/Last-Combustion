// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';

/** The kinds of incident that are put on the map (a stopped field or an overtake is not a place). */
export const MAP_INCIDENTS = [
  'crash',
  'spin',
  'mistake',
  'wildlife',
  'mechanical_failure',
  'contact',
];

/** The most incidents on one map. */
const MAX_MARKERS = 60;

export interface MapSector {
  startKm: number;
  overtakeSpot: boolean;
}

export interface MapMarker {
  /** Distance along the lap. */
  km: number;
  kind: string;
}

/** What the map of one round shows: the course, its sectors and where things went wrong. */
export interface CourseMapData {
  round: number;
  year: number;
  courseNumber: number;
  name: string;
  lapKm: number;
  sectors: MapSector[];
  markers: MapMarker[];
}

/** The round numbers of the latest season. */
export function mapRounds(db: Database): number[] {
  return all(
    db,
    `SELECT number FROM round WHERE season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)
      ORDER BY number`,
  ).map((r) => r.number as number);
}

/** The round the map opens on: the last one run in the latest season, or the first. */
export function defaultMapRound(db: Database): number {
  const r = all(
    db,
    `SELECT MAX(number) AS n FROM round WHERE status = 'complete'
       AND season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)`,
  )[0];
  return (r?.n as number | null) ?? 1;
}

/**
 * The map data for a round of the latest season (see the GDD, "Course outlines"): the course, its
 * sectors with the overtaking spots, and the incidents of the prelims and the final at the point of the
 * lap where they happened, in lap order and at most 60. A round that has not been run has none.
 */
export function courseMap(db: Database, roundNumber: number): CourseMapData | undefined {
  const round = all(
    db,
    `SELECT ro.id, ro.number, s.year, c.id AS course_id, c.number AS course_number, c.name, c.lap_km
       FROM round ro JOIN season s ON s.id = ro.season_id JOIN course c ON c.id = ro.course_id
      WHERE ro.number = ? AND s.id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)`,
    [roundNumber],
  )[0];
  if (!round) return undefined;
  const lapKm = round.lap_km as number;
  const marks = MAP_INCIDENTS.map(() => '?').join(', ');
  return {
    round: round.number as number,
    year: round.year as number,
    courseNumber: round.course_number as number,
    name: round.name as string,
    lapKm,
    sectors: all(
      db,
      'SELECT start_km, overtake_spot FROM sector WHERE course_id = ? ORDER BY sector_order',
      [round.course_id as number],
    ).map((s) => ({ startKm: s.start_km as number, overtakeSpot: s.overtake_spot === 1 })),
    markers: all(
      db,
      `SELECT km, type FROM event_log
        WHERE round_id = ? AND km IS NOT NULL AND scope IN ('prelim', 'final') AND type IN (${marks})
        ORDER BY km, id LIMIT ?`,
      [round.id as number, ...MAP_INCIDENTS, MAX_MARKERS],
    ).map((m) => ({ km: Math.min(Math.max(m.km as number, 0), lapKm), kind: m.type as string })),
  };
}

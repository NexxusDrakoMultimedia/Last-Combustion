// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';

/** What the almanac holds for a driver or garage that has scored. */
export interface AlmanacStats {
  superPoints: number;
  juniorPoints: number;
  seasons: number;
  firstScoringYear: number;
  lastScoringYear: number;
  wins: number;
  finals: number;
  titles: number;
}

export interface AlmanacEntry {
  kind: 'driver' | 'garage';
  id: number;
  name: string;
  /** The year they began: the first season a driver entered, or the year a garage was founded. */
  yearStarted: number;
  /** The year they retired or stopped operating, or null if they are still active. */
  yearEnded: number | null;
  /** Total points in the Junior and Super Series. */
  points: number;
  /** Full career figures, only for those who ever scored a point. Others are just a line. */
  stats: AlmanacStats | null;
}

export interface Almanac {
  drivers: AlmanacEntry[];
  garages: AlmanacEntry[];
}

/**
 * The almanac of every driver and garage that ever scored a point in the Junior or Super Series.
 * One who retired or stopped operating before ever scoring appears only as a line: no points, the
 * year they started and the year they ended. One who is still active and has not scored yet is not
 * in the almanac until they score or leave.
 */
export function almanac(db: Database): Almanac {
  const drivers = all(
    db,
    `SELECT d.id, d.name, d.retired_year,
            COALESCE((SELECT MIN(s.year) FROM entry e JOIN season s ON s.id = e.season_id WHERE e.driver_id = d.id),
                     CAST(substr(d.birth_date, 1, 4) AS INTEGER) + 18) AS started,
            COALESCE(SUM(r.points), 0) AS points,
            COALESCE(SUM(CASE WHEN e.series = 'main' THEN r.points END), 0) AS super_points,
            COALESCE(SUM(CASE WHEN e.series = 'junior' THEN r.points END), 0) AS junior_points,
            COUNT(DISTINCT CASE WHEN r.points > 0 THEN ro.season_id END) AS seasons,
            MIN(CASE WHEN r.points > 0 THEN s.year END) AS first_year,
            MAX(CASE WHEN r.points > 0 THEN s.year END) AS last_year,
            COUNT(CASE WHEN r.final_pos = 1 THEN 1 END) AS wins,
            COUNT(CASE WHEN r.final_pos IS NOT NULL THEN 1 END) AS finals,
            (SELECT COUNT(*) FROM season WHERE champion_driver_id = d.id) AS titles
       FROM driver d
       LEFT JOIN entry e ON e.driver_id = d.id
       LEFT JOIN result r ON r.entry_id = e.id
       LEFT JOIN round ro ON ro.id = r.round_id
       LEFT JOIN season s ON s.id = ro.season_id
      GROUP BY d.id ORDER BY d.name, d.id`,
  );
  const garages = all(
    db,
    `SELECT g.id, g.name, g.founded_year AS started, g.closed_year,
            COALESCE(SUM(r.points), 0) AS points,
            COALESCE(SUM(CASE WHEN e.series = 'main' THEN r.points END), 0) AS super_points,
            COALESCE(SUM(CASE WHEN e.series = 'junior' THEN r.points END), 0) AS junior_points,
            COUNT(DISTINCT CASE WHEN r.points > 0 THEN ro.season_id END) AS seasons,
            MIN(CASE WHEN r.points > 0 THEN s.year END) AS first_year,
            MAX(CASE WHEN r.points > 0 THEN s.year END) AS last_year,
            COUNT(CASE WHEN r.final_pos = 1 THEN 1 END) AS wins,
            COUNT(CASE WHEN r.final_pos IS NOT NULL THEN 1 END) AS finals,
            (SELECT COUNT(*) FROM season WHERE champion_garage_id = g.id) AS titles
       FROM garage g
       LEFT JOIN entry e ON e.garage_id = g.id
       LEFT JOIN result r ON r.entry_id = e.id
       LEFT JOIN round ro ON ro.id = r.round_id
       LEFT JOIN season s ON s.id = ro.season_id
      WHERE g.kind = 'racing'
      GROUP BY g.id ORDER BY g.name, g.id`,
  );

  const build =
    (kind: 'driver' | 'garage') =>
    (row: Record<string, string | number | null>): AlmanacEntry | null => {
      const points = Math.round((row.points as number) * 10) / 10;
      const yearEnded = (kind === 'driver' ? row.retired_year : row.closed_year) as number | null;
      const base = {
        kind,
        id: row.id as number,
        name: row.name as string,
        yearStarted: row.started as number,
        yearEnded,
      };
      if (points > 0) {
        return {
          ...base,
          points,
          stats: {
            superPoints: Math.round((row.super_points as number) * 10) / 10,
            juniorPoints: Math.round((row.junior_points as number) * 10) / 10,
            seasons: row.seasons as number,
            firstScoringYear: row.first_year as number,
            lastScoringYear: row.last_year as number,
            wins: row.wins as number,
            finals: row.finals as number,
            titles: row.titles as number,
          },
        };
      }
      if (yearEnded !== null) return { ...base, points: 0, stats: null };
      return null;
    };
  return {
    drivers: drivers.map(build('driver')).filter((e): e is AlmanacEntry => e !== null),
    garages: garages.map(build('garage')).filter((e): e is AlmanacEntry => e !== null),
  };
}

/** Records that a driver retired in a year. */
export function retireDriver(db: Database, driverId: number, year: number): void {
  const changed = db.exec('SELECT 1 FROM driver WHERE id = ?', [driverId]);
  if (changed.length === 0) throw new Error(`There is no driver ${driverId}.`);
  db.run('UPDATE driver SET retired_year = ? WHERE id = ?', [year, driverId]);
}

/** Records that a garage stopped operating in a year. */
export function closeGarage(db: Database, garageId: number, year: number): void {
  const found = db.exec("SELECT 1 FROM garage WHERE id = ? AND kind = 'racing'", [garageId]);
  if (found.length === 0) throw new Error(`There is no racing garage ${garageId}.`);
  db.run('UPDATE garage SET closed_year = ? WHERE id = ?', [year, garageId]);
}

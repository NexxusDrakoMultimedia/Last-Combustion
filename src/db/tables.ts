// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { flagNames } from '../sim/worldgen/data';
import { badgesFor, NO_BADGE, type NumberBadge } from './badges';
import { all } from './entries';
import { computeStandings } from './season';

/** The five championship tables. */
export type TableKind = 'drivers' | 'garages' | 'manufacturers' | 'driverNations' | 'garageNations';
export const TABLE_KINDS: TableKind[] = [
  'drivers',
  'garages',
  'manufacturers',
  'driverNations',
  'garageNations',
];

export interface TableRow {
  badge: NumberBadge;
  /** The driver's or garage's id (0 for a manufacturer or nation), for linking to its profile. */
  driverId: number;
  garageId: number;
  rank: number;
  name: string;
  /** The garage for a driver, the home country for a manufacturer; empty otherwise. */
  detail: string;
  /** A driver's race number, or 0. */
  raceNumber: number;
  points: number;
  wins: number;
  /** Whether this is the player's driver or garage. */
  mine: boolean;
}

export interface FullStandings {
  year: number;
  /** Whether the season has ended (the tables are final). */
  complete: boolean;
  /** How many rounds have a result so far, and how many the season has. */
  rounds: number;
  roundsTotal: number;
  tables: Record<TableKind, TableRow[]>;
}

/** Every season in the save, newest first. */
export function seasonYears(db: Database): number[] {
  return all(db, 'SELECT year FROM season ORDER BY year DESC').map((r) => r.year as number);
}

const flagName = (code: string): string => flagNames[code]?.short ?? code;

/**
 * The full championship tables of a season: every driver, garage, manufacturer and nation that
 * has scored or raced, ranked (not just the leaders). Works for any season in the save.
 */
export function fullStandings(db: Database, year: number): FullStandings {
  const season = all(db, 'SELECT id, status FROM season WHERE year = ?', [year])[0];
  if (!season) throw new Error(`There is no ${year} season.`);
  const seasonId = season.id as number;
  const standings = computeStandings(db, seasonId);
  const badges = badgesFor(db, year);

  const drivers = new Map(
    all(
      db,
      `SELECT d.id, d.name, e.race_number, e.garage_id, g.name AS garage, g.is_player
         FROM entry e JOIN driver d ON d.id = e.driver_id JOIN garage g ON g.id = e.garage_id
        WHERE e.season_id = ? AND e.series = 'main'`,
      [seasonId],
    ).map((r) => [r.id as number, r] as const),
  );
  const garages = new Map(
    all(db, 'SELECT id, name, is_player FROM garage').map((r) => [r.id as number, r] as const),
  );
  const makers = new Map(
    all(db, 'SELECT id, name, home_country FROM manufacturer').map(
      (r) => [r.id as number, r] as const,
    ),
  );
  const rounds = Number(
    all(
      db,
      `SELECT COUNT(DISTINCT r.round_id) AS n FROM result r JOIN round ro ON ro.id = r.round_id
        WHERE ro.season_id = ? AND r.final_pos IS NOT NULL`,
      [seasonId],
    )[0]!.n,
  );

  const row = (
    s: { rank: number; points: number; wins: number },
    extra: Pick<TableRow, 'name'> & Partial<TableRow>,
  ): TableRow => ({
    badge: NO_BADGE,
    driverId: 0,
    garageId: 0,
    detail: '',
    raceNumber: 0,
    mine: false,
    rank: s.rank,
    points: Math.round(s.points * 10) / 10,
    wins: s.wins,
    ...extra,
  });
  return {
    year,
    complete: season.status === 'complete',
    rounds,
    roundsTotal: Number(
      all(db, 'SELECT COUNT(*) AS n FROM round WHERE season_id = ?', [seasonId])[0]!.n,
    ),
    tables: {
      drivers: standings.drivers.map((s) => {
        const d = drivers.get(s.id as number);
        return row(s, {
          name: String(d?.name ?? ''),
          driverId: s.id as number,
          badge: badges.get(s.id as number) ?? NO_BADGE,
          garageId: Number(d?.garage_id ?? 0),
          detail: String(d?.garage ?? ''),
          raceNumber: Number(d?.race_number ?? 0),
          mine: d?.is_player === 1,
        });
      }),
      garages: standings.garages.map((s) => {
        const g = garages.get(s.id as number);
        return row(s, {
          name: String(g?.name ?? ''),
          garageId: s.id as number,
          mine: g?.is_player === 1,
        });
      }),
      manufacturers: standings.manufacturers.map((s) => {
        const m = makers.get(s.id as number);
        return row(s, { name: String(m?.name ?? ''), detail: String(m?.home_country ?? '') });
      }),
      driverNations: standings.driverNations.map((s) => row(s, { name: flagName(String(s.id)) })),
      garageNations: standings.garageNations.map((s) => row(s, { name: flagName(String(s.id)) })),
    },
  };
}

/** One line of a prelim or final classification. */
export interface ResultRow {
  /** What the driver's number carries that season. */
  badge: NumberBadge;
  driverId: number;
  garageId: number;
  carId: number;
  plate: string;
  plateState: string;
  /** The finishing position, or null for a car that did not finish. */
  position: number | null;
  raceNumber: number;
  driver: string;
  garage: string;
  car: string;
  /** The time in milliseconds, or null with no time set. */
  timeMs: number | null;
  /** The gap to the leader in milliseconds (0 for the leader), or null with no time. */
  gapMs: number | null;
  points: number;
  prize: number;
  pole: boolean;
  /** Why the car did not finish (for example "crash"), or null. */
  dnf: string | null;
  mine: boolean;
  /** The series' computer flagged this run for pace well beyond what the car should manage. */
  attention: boolean;
}

export interface RoundClassification {
  year: number;
  round: number;
  course: string;
  finalDate: string;
  status: string;
  /** The dates: the first practice day, the first prelim day and the final. */
  practiceStart: string;
  prelimStart: string;
  /** The weather and temperature of each day of the round, once the prelims have been run. */
  days: { date: string; kind: string; weather: string; temperatureC: number }[];
  /** Every car that ran the prelims, fastest first, then those with no time. */
  prelims: ResultRow[];
  /** Every car that started the final, in finishing order, then those that did not finish. */
  final: ResultRow[];
}

/**
 * The full classification of a round: every entry's prelim time and position, and the final with
 * times, gaps, points and prize money. Works for any round of any season in the save.
 */
export function roundClassification(
  db: Database,
  year: number,
  roundNumber: number,
): RoundClassification {
  const round = all(
    db,
    `SELECT r.id, r.final_date, r.status, r.practice_start, r.prelim_start, r.weather_log, c.name AS course
       FROM round r JOIN course c ON c.id = r.course_id JOIN season s ON s.id = r.season_id
      WHERE s.year = ? AND r.number = ?`,
    [year, roundNumber],
  )[0];
  if (!round) throw new Error(`There is no round ${roundNumber} in ${year}.`);
  const rows = all(
    db,
    `SELECT r.entry_id, r.prelim_pos, r.prelim_time_ms, r.final_pos, r.final_time_ms, r.points, r.prize, r.pole,
            r.dnf_reason, e.race_number, e.driver_id, e.garage_id, e.car_id, c.plate, c.plate_state, d.name AS driver, g.name AS garage, g.is_player, m.name AS car
       FROM result r
       JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
       JOIN driver d ON d.id = e.driver_id
       JOIN garage g ON g.id = e.garage_id
       JOIN car c ON c.id = e.car_id
       JOIN car_model m ON m.id = c.car_model_id
      WHERE r.round_id = ?`,
    [round.id as number],
  );
  const flagged = all(
    db,
    "SELECT entry_id, scope FROM event_log WHERE round_id = ? AND type = 'attention'",
    [round.id as number],
  );
  const toRow = (
    r: (typeof rows)[number],
    scope: 'prelim' | 'final',
    position: number | null,
    timeMs: number | null,
    leaderMs: number | null,
    points: number,
  ): ResultRow => ({
    position,
    badge: badges.get(r.driver_id as number) ?? NO_BADGE,
    driverId: r.driver_id as number,
    garageId: r.garage_id as number,
    carId: r.car_id as number,
    plate: String(r.plate ?? ''),
    plateState: String(r.plate_state ?? ''),
    raceNumber: r.race_number as number,
    driver: r.driver as string,
    garage: r.garage as string,
    car: r.car as string,
    timeMs,
    gapMs: timeMs !== null && leaderMs !== null ? timeMs - leaderMs : null,
    points: Math.round(points * 10) / 10,
    prize: r.prize as number,
    pole: r.pole === 1,
    dnf: (r.dnf_reason as string | null) ?? null,
    mine: r.is_player === 1,
    attention: flagged.some((f) => f.entry_id === r.entry_id && f.scope === scope),
  });

  const badges = badgesFor(db, year);
  const prelimRows = rows
    .filter((r) => r.prelim_time_ms !== null || r.dnf_reason !== null)
    .sort(
      (a, b) =>
        (a.prelim_pos === null ? 1 : 0) - (b.prelim_pos === null ? 1 : 0) ||
        ((a.prelim_pos as number) ?? 0) - ((b.prelim_pos as number) ?? 0) ||
        (a.race_number as number) - (b.race_number as number),
    );
  const prelimLeader = (prelimRows.find((r) => r.prelim_pos !== null)?.prelim_time_ms ?? null) as
    number | null;
  const prelims = prelimRows.map((r) =>
    toRow(
      r,
      'prelim',
      r.prelim_pos as number | null,
      r.prelim_time_ms as number | null,
      r.prelim_pos === null ? null : prelimLeader,
      // Places below the final's size score from the prelims; cars in the final score from the final.
      r.final_pos === null ? (r.points as number) : 0,
    ),
  );

  const finalRows = rows
    .filter((r) => r.final_pos !== null)
    .sort((a, b) => (a.final_pos as number) - (b.final_pos as number));
  const finalLeader = (finalRows.find((r) => r.final_time_ms !== null)?.final_time_ms ?? null) as
    number | null;
  const final = finalRows.map((r) =>
    toRow(
      r,
      'final',
      r.final_time_ms === null ? null : (r.final_pos as number),
      r.final_time_ms as number | null,
      finalLeader,
      r.points as number,
    ),
  );

  return {
    year,
    round: roundNumber,
    course: round.course as string,
    finalDate: round.final_date as string,
    status: round.status as string,
    practiceStart: round.practice_start as string,
    prelimStart: round.prelim_start as string,
    days: parseDays(String(round.weather_log ?? '[]')),
    prelims,
    final,
  };
}

/** The days of a round's schedule from its saved log (empty before the prelims are run). */
function parseDays(log: string): RoundClassification['days'] {
  try {
    return (JSON.parse(log) as Record<string, unknown>[]).map((d) => ({
      date: String(d.date),
      kind: String(d.kind),
      weather: String(d.weather),
      temperatureC: Number(d.temperatureC),
    }));
  } catch {
    return [];
  }
}

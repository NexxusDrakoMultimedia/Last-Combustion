// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';
import { readCareer, type CareerMode, type Difficulty } from './career';
import { latestSchemaVersion } from './migrate';
import { APP_VERSION } from './session';

/** The facts of this save, as the Game screen's first block gives them. */
export interface GameFacts {
  garage: string;
  owner: string;
  mode: CareerMode;
  difficulty: Difficulty;
  masterSeed: string;
  startYear: number;
  gameDate: string;
  /** Whole days from the first of February of the start year to the game date. */
  daysPlayed: number;
  appVersion: string;
  schemaVersion: number;
}

/** How big the world is, counted from the database. */
export interface WorldCounts {
  garages: number;
  drivers: number;
  retiredDrivers: number;
  cars: number;
  manufacturers: number;
  models: number;
  sponsors: number;
  suppliers: number;
  courses: number;
  nations: number;
  places: number;
  mechanics: number;
  executives: number;
  shareholders: number;
}

/** What the series has done so far. */
export interface SeriesCounts {
  seasons: number;
  seasonsComplete: number;
  rounds: number;
  roundsRun: number;
  classified: number;
  distanceKm: number;
  prizeMoney: number;
  fastestPrelim: { ms: number; driver: string; year: number } | null;
  deaths: number;
  /** The series' own fans in the latest season, and the fans of everyone in it, added up. */
  seriesFans: number;
  driverFans: number;
  garageFans: number;
  carFans: number;
}

/** Figures that describe the state of the world at the game date. */
export interface StateOfPlay {
  /** The total cash held by every racing garage. */
  garageCash: number;
  averagePrestige: number;
  averageDriverAge: number;
  richestGarage: { name: string; cash: number } | null;
  mostPrestigiousGarage: { name: string; prestige: number } | null;
  mostFamousDriver: { name: string; fans: number } | null;
}

/** What the player's garage has done. */
export interface YourCounts {
  titles: number;
  wins: number;
  podiums: number;
  poles: number;
  races: number;
  points: number;
  prizeMoney: number;
}

/** A dated line of the chronicle: a kind (which text to use) and the figures that go in it. */
export interface ChronicleLine {
  date: string;
  kind: 'champion' | 'death' | 'win';
  values: Record<string, string | number>;
}

export interface GameView {
  facts: GameFacts;
  world: WorldCounts;
  series: SeriesCounts;
  state: StateOfPlay;
  you: YourCounts;
  chronicle: ChronicleLine[];
}

const count = (db: Database, sql: string): number => Number(all(db, sql)[0]?.n ?? 0);

const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** The Game screen: facts about this save, the world, the series and the player, and a dated chronicle. */
export function gameView(db: Database): GameView {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const player = all(
    db,
    `SELECT g.id, g.name, COALESCE(o.name, '') AS owner FROM garage g LEFT JOIN owner o ON o.garage_id = g.id
      WHERE g.is_player = 1`,
  )[0];
  const playerId = Number(player?.id ?? 0);

  const facts: GameFacts = {
    garage: String(player?.name ?? ''),
    owner: String(player?.owner ?? ''),
    mode: career.mode,
    difficulty: career.difficulty,
    masterSeed: career.masterSeed,
    startYear: career.startYear,
    gameDate: career.gameDate,
    daysPlayed: Math.max(0, dayNumber(career.gameDate) - dayNumber(`${career.startYear}-02-01`)),
    appVersion: APP_VERSION,
    schemaVersion: latestSchemaVersion(),
  };

  const world: WorldCounts = {
    garages: count(db, "SELECT COUNT(*) AS n FROM garage WHERE kind = 'racing'"),
    drivers: count(db, 'SELECT COUNT(*) AS n FROM driver'),
    retiredDrivers: count(db, 'SELECT COUNT(*) AS n FROM driver WHERE retired_year IS NOT NULL'),
    cars: count(db, 'SELECT COUNT(*) AS n FROM car'),
    manufacturers: count(db, 'SELECT COUNT(*) AS n FROM manufacturer'),
    models: count(db, 'SELECT COUNT(*) AS n FROM car_model'),
    sponsors: count(db, 'SELECT COUNT(*) AS n FROM sponsor'),
    suppliers: count(db, 'SELECT COUNT(*) AS n FROM part_supplier'),
    courses: count(db, 'SELECT COUNT(*) AS n FROM course'),
    nations: count(db, 'SELECT COUNT(DISTINCT flag) AS n FROM driver'),
    places: count(db, 'SELECT COUNT(*) AS n FROM place'),
    mechanics: count(db, 'SELECT COUNT(*) AS n FROM staff'),
    executives: count(db, 'SELECT COUNT(*) AS n FROM executive'),
    shareholders: count(db, 'SELECT COUNT(*) AS n FROM shareholding'),
  };

  const fastest = all(
    db,
    `SELECT r.prelim_time_ms AS ms, d.name AS driver, s.year AS year
       FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
       JOIN driver d ON d.id = e.driver_id JOIN round ro ON ro.id = r.round_id
       JOIN season s ON s.id = ro.season_id
      WHERE r.prelim_time_ms IS NOT NULL ORDER BY r.prelim_time_ms, r.id LIMIT 1`,
  )[0];
  const series: SeriesCounts = {
    seasons: count(db, 'SELECT COUNT(*) AS n FROM season'),
    seasonsComplete: count(db, "SELECT COUNT(*) AS n FROM season WHERE status = 'complete'"),
    rounds: count(db, 'SELECT COUNT(*) AS n FROM round'),
    roundsRun: count(db, "SELECT COUNT(*) AS n FROM round WHERE status = 'complete'"),
    classified: count(db, 'SELECT COUNT(*) AS n FROM result WHERE final_pos IS NOT NULL'),
    distanceKm: Math.round(
      Number(
        all(
          db,
          `SELECT COALESCE(SUM(c.lap_km * c.final_laps), 0) AS n FROM round ro
             JOIN course c ON c.id = ro.course_id WHERE ro.status = 'complete'`,
        )[0]?.n ?? 0,
      ),
    ),
    prizeMoney: count(db, 'SELECT COALESCE(SUM(prize), 0) AS n FROM result'),
    fastestPrelim: fastest
      ? { ms: Number(fastest.ms), driver: String(fastest.driver), year: Number(fastest.year) }
      : null,
    deaths: count(db, 'SELECT COUNT(*) AS n FROM death'),
    seriesFans: count(db, 'SELECT series_fans AS n FROM season ORDER BY year DESC LIMIT 1'),
    driverFans: count(db, 'SELECT COALESCE(SUM(fans), 0) AS n FROM driver'),
    garageFans: count(db, "SELECT COALESCE(SUM(fans), 0) AS n FROM garage WHERE kind = 'racing'"),
    carFans: count(db, 'SELECT COALESCE(SUM(fans), 0) AS n FROM car'),
  };

  const richest = all(
    db,
    "SELECT name, cash FROM garage WHERE kind = 'racing' ORDER BY cash DESC, id LIMIT 1",
  )[0];
  const prestigious = all(
    db,
    "SELECT name, prestige FROM garage WHERE kind = 'racing' ORDER BY prestige DESC, id LIMIT 1",
  )[0];
  const famous = all(db, 'SELECT name, fans FROM driver ORDER BY fans DESC, id LIMIT 1')[0];
  const ages = all(db, 'SELECT birth_date FROM driver WHERE retired_year IS NULL').map(
    (r) => (dayNumber(career.gameDate) - dayNumber(String(r.birth_date))) / 365.25,
  );
  const state: StateOfPlay = {
    garageCash: count(db, "SELECT COALESCE(SUM(cash), 0) AS n FROM garage WHERE kind = 'racing'"),
    averagePrestige:
      Math.round(
        Number(all(db, "SELECT AVG(prestige) AS n FROM garage WHERE kind = 'racing'")[0]?.n ?? 0) *
          10,
      ) / 10,
    averageDriverAge: ages.length
      ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10
      : 0,
    richestGarage: richest ? { name: String(richest.name), cash: Number(richest.cash) } : null,
    mostPrestigiousGarage: prestigious
      ? { name: String(prestigious.name), prestige: Number(prestigious.prestige) }
      : null,
    mostFamousDriver: famous ? { name: String(famous.name), fans: Number(famous.fans) } : null,
  };

  const mine = all(
    db,
    `SELECT COUNT(*) AS races, COALESCE(SUM(r.final_pos = 1), 0) AS wins,
            COALESCE(SUM(r.final_pos BETWEEN 1 AND 3), 0) AS podiums, COALESCE(SUM(r.pole), 0) AS poles,
            COALESCE(SUM(r.points), 0) AS points, COALESCE(SUM(r.prize), 0) AS prize
       FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
      WHERE e.garage_id = ? AND r.final_pos IS NOT NULL`,
    [playerId],
  )[0];
  const you: YourCounts = {
    titles: count(db, `SELECT COUNT(*) AS n FROM season WHERE champion_garage_id = ${playerId}`),
    wins: Number(mine?.wins ?? 0),
    podiums: Number(mine?.podiums ?? 0),
    poles: Number(mine?.poles ?? 0),
    races: Number(mine?.races ?? 0),
    points: Math.round(Number(mine?.points ?? 0) * 10) / 10,
    prizeMoney: Number(mine?.prize ?? 0),
  };

  const chronicle: ChronicleLine[] = [
    ...all(
      db,
      `SELECT s.year AS year, d.name AS driver, g.name AS garage FROM season s
         JOIN driver d ON d.id = s.champion_driver_id JOIN garage g ON g.id = s.champion_garage_id
        WHERE s.status = 'complete'`,
    ).map((r) => ({
      date: `${r.year}-11-11`,
      kind: 'champion' as const,
      values: { year: Number(r.year), driver: String(r.driver), garage: String(r.garage) },
    })),
    ...all(db, 'SELECT name, date, cause, person_type AS type FROM death').map((r) => ({
      date: String(r.date),
      kind: 'death' as const,
      values: { name: String(r.name), cause: String(r.cause), type: String(r.type) },
    })),
    ...all(
      db,
      `SELECT ro.final_date AS date, d.name AS driver, c.name AS course
         FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN driver d ON d.id = e.driver_id JOIN round ro ON ro.id = r.round_id
         JOIN course c ON c.id = ro.course_id
        WHERE e.garage_id = ? AND r.final_pos = 1`,
      [playerId],
    ).map((r) => ({
      date: String(r.date),
      kind: 'win' as const,
      values: { driver: String(r.driver), course: String(r.course) },
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { facts, world, series, state, you, chronicle };
}

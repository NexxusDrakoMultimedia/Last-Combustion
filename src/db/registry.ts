// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { restorationFloor } from '../sim/wear';
import type { Tier } from '../sim/worldgen/types';
import { registryStatuses, type RegistryStatus } from './status';
import { badgesFor, NO_BADGE, type NumberBadge } from './badges';
export { badgesFor, NO_BADGE, type NumberBadge };
import { readCareer } from './career';
import { all } from './entries';
import { computeStandings } from './season';
import { roundClassification, type ResultRow } from './tables';
import { titlesOf } from './titles';

const gameYear = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

const latestYear = (db: Database): number =>
  Number(all(db, 'SELECT MAX(year) AS y FROM season')[0]?.y ?? gameYear(db));

/** One trophy (a race win) or shield (a championship) on a car's or driver's livery. */
export interface Decal {
  kind: 'trophy' | 'shield' | 'star';
  /** Gold for the Super Series, silver for the Junior Series. */
  series: 'main' | 'junior';
  year: number;
  /** The round and course of a win; null for a championship or a star. */
  round: number | null;
  course: string | null;
}

/** The trophy and shield decals of a driver (right rear) or a car (left rear), oldest first. */
export function decalsOf(db: Database, owner: 'driver' | 'car', id: number): Decal[] {
  return all(
    db,
    `SELECT t.kind, t.series, s.year, r.number AS round, c.name AS course
       FROM trophy t JOIN season s ON s.id = t.season_id
       LEFT JOIN round r ON r.id = t.round_id
       LEFT JOIN course c ON c.id = r.course_id
      WHERE t.owner_type = ? AND t.owner_id = ? ORDER BY s.year, r.number, t.id`,
    [owner, id],
  ).map((r) => ({
    kind: r.kind === 'title' ? 'shield' : 'trophy',
    series: r.series as 'main' | 'junior',
    year: r.year as number,
    round: (r.round as number | null) ?? null,
    course: (r.course as string | null) ?? null,
  }));
}

/** A star for each Garage Championship a garage has won, oldest first (a garage's trophies, as it were). */
export function garageStars(db: Database, garageId: number): Decal[] {
  return all(db, 'SELECT year FROM season WHERE champion_garage_id = ? ORDER BY year', [
    garageId,
  ]).map((s) => ({
    kind: 'star',
    series: 'main',
    year: s.year as number,
    round: null,
    course: null,
  }));
}

/** A link to someone or something with a profile. */
export interface Ref {
  id: number;
  name: string;
}

export interface CarRef {
  id: number;
  plate: string;
  plateState: string;
  model: string;
}

/** The seasons in which someone scored, and the first and last of them. */
export interface ScoringSpan {
  seasons: number;
  firstYear: number | null;
  lastYear: number | null;
}

function scoringSpan(lines: { year: number; points: number }[]): ScoringSpan {
  const years = lines.filter((l) => l.points > 0).map((l) => l.year);
  return {
    seasons: years.length,
    firstYear: years.length > 0 ? Math.min(...years) : null,
    lastYear: years.length > 0 ? Math.max(...years) : null,
  };
}

export interface SeasonLine {
  year: number;
  rank: number | null;
  points: number;
  wins: number;
}

/** The final rank of every driver and garage in a season, from the saved table once it has ended. */
function ranksOf(
  db: Database,
  seasonId: number,
): { drivers: Map<number, number>; garages: Map<number, number> } {
  const tables = computeStandings(db, seasonId);
  return {
    drivers: new Map(tables.drivers.map((d) => [d.id as number, d.rank])),
    garages: new Map(tables.garages.map((g) => [g.id as number, g.rank])),
  };
}

export interface DriverSeason extends SeasonLine {
  number: number;
  garage: Ref;
  car: CarRef;
  badge: NumberBadge;
}

export interface DriverProfile {
  id: number;
  name: string;
  nickname: string | null;
  identity: string;
  age: number;
  flag: string;
  hometown: string;
  residence: string;
  retiredYear: number | null;
  /** The number now (or last worn), and the one the driver prefers. */
  number: number | null;
  preferredNumber: number | null;
  badge: NumberBadge;
  goldBorderYear: number | null;
  silverBorderYear: number | null;
  stats: Record<
    | 'pace'
    | 'consistency'
    | 'racecraft'
    | 'tyreManagement'
    | 'composure'
    | 'wetSkill'
    | 'potential',
    number
  >;
  fans: number;
  fame: number;
  reputation: number;
  career: {
    points: number;
    wins: number;
    podiums: number;
    finals: number;
    poles: number;
    championships: number;
    /** The seasons with at least a point, and the first and last of them. */
    scoring: ScoringSpan;
  };
  /** The first season they entered, or null if they never have. */
  debutYear: number | null;
  garage: Ref | null;
  seasons: DriverSeason[];
  contracts: { garage: Ref; startYear: number; endYear: number; salary: number }[];
  titles: { name: string; year: number }[];
  decals: Decal[];
}

/** The profile of a driver: who they are, the number and borders they carry, their record, season by season, and their decals. */
export function driverProfile(db: Database, driverId: number): DriverProfile {
  const d = all(
    db,
    `SELECT d.*, h.name AS hometown, h.region AS hometown_region, res.name AS residence, res.region AS residence_region
       FROM driver d JOIN place h ON h.id = d.hometown_place_id JOIN place res ON res.id = d.residence_place_id
      WHERE d.id = ?`,
    [driverId],
  )[0];
  if (!d) throw new Error(`There is no driver ${driverId}.`);
  const gameDate = readCareer(db)?.gameDate ?? '2031-02-01';
  const born = String(d.birth_date);
  const age =
    Number(gameDate.slice(0, 4)) -
    Number(born.slice(0, 4)) -
    (gameDate.slice(5) < born.slice(5) ? 1 : 0);

  const entries = all(
    db,
    `SELECT e.season_id, s.year, e.race_number, e.garage_id, g.name AS garage, e.car_id, c.plate, c.plate_state, m.name AS model
       FROM entry e JOIN season s ON s.id = e.season_id JOIN garage g ON g.id = e.garage_id
       JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE e.driver_id = ? AND e.series = 'main' ORDER BY s.year`,
    [driverId],
  );
  const results = all(
    db,
    `SELECT s.year, SUM(r.points) AS points, COUNT(CASE WHEN r.final_pos = 1 THEN 1 END) AS wins,
            COUNT(CASE WHEN r.final_pos <= 3 THEN 1 END) AS podiums,
            COUNT(CASE WHEN r.final_pos IS NOT NULL THEN 1 END) AS finals, SUM(r.pole) AS poles
       FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
       JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
      WHERE e.driver_id = ? GROUP BY s.year`,
    [driverId],
  );
  const byYear = new Map(results.map((r) => [r.year as number, r]));
  const seasons: DriverSeason[] = entries.map((e) => {
    const year = e.year as number;
    const r = byYear.get(year);
    return {
      year,
      rank: ranksOf(db, e.season_id as number).drivers.get(driverId) ?? null,
      points: Math.round(Number(r?.points ?? 0) * 10) / 10,
      wins: Number(r?.wins ?? 0),
      number: e.race_number as number,
      garage: { id: e.garage_id as number, name: e.garage as string },
      car: {
        id: e.car_id as number,
        plate: e.plate as string,
        plateState: e.plate_state as string,
        model: e.model as string,
      },
      badge: badgesFor(db, year).get(driverId) ?? NO_BADGE,
    };
  });
  const sum = (key: string) => results.reduce((n, r) => n + Number(r[key] ?? 0), 0);
  const last = seasons[seasons.length - 1];
  return {
    id: driverId,
    name: d.name as string,
    nickname: (d.nickname as string | null) ?? null,
    identity: d.identity as string,
    age,
    flag: d.flag as string,
    hometown: `${d.hometown as string}, ${d.hometown_region as string}`,
    residence: `${d.residence as string}, ${d.residence_region as string}`,
    retiredYear: (d.retired_year as number | null) ?? null,
    number: last?.number ?? null,
    preferredNumber: (d.preferred_number as number | null) ?? null,
    badge: badgesFor(db, latestYear(db)).get(driverId) ?? NO_BADGE,
    goldBorderYear: (d.gold_border_year as number | null) ?? null,
    silverBorderYear: (d.silver_border_year as number | null) ?? null,
    stats: {
      pace: d.pace as number,
      consistency: d.consistency as number,
      racecraft: d.racecraft as number,
      tyreManagement: d.tyre_management as number,
      composure: d.composure as number,
      wetSkill: d.wet_skill as number,
      potential: d.potential as number,
    },
    fans: d.fans as number,
    fame: Math.round(Number(d.fame)),
    reputation: d.reputation as number,
    career: {
      points: Math.round(sum('points') * 10) / 10,
      wins: sum('wins'),
      podiums: sum('podiums'),
      finals: sum('finals'),
      poles: sum('poles'),
      championships: Number(
        all(db, 'SELECT COUNT(*) AS n FROM season WHERE champion_driver_id = ?', [driverId])[0]!.n,
      ),
      scoring: scoringSpan(seasons),
    },
    debutYear: seasons[0]?.year ?? null,
    garage: last ? last.garage : null,
    seasons,
    contracts: all(
      db,
      `SELECT c.garage_id, g.name, c.start_year, c.end_year, c.salary FROM contract c
         JOIN garage g ON g.id = c.garage_id WHERE c.driver_id = ? ORDER BY c.start_year, c.id`,
      [driverId],
    ).map((c) => ({
      garage: { id: c.garage_id as number, name: c.name as string },
      startYear: c.start_year as number,
      endYear: c.end_year as number,
      salary: c.salary as number,
    })),
    titles: titlesOf(db, driverId).map((t) => ({ name: t.name, year: t.year })),
    decals: decalsOf(db, 'driver', driverId),
  };
}

export interface CarProfile {
  id: number;
  plate: string;
  plateState: string;
  chassisNo: string;
  model: string;
  manufacturer: string;
  tier: string;
  modelYear: number;
  flag: string;
  fans: number;
  roadKm: number;
  raceKm: number;
  wear: number;
  /** How many full restorations the chassis has had, and the least wear it can have now. */
  restorations: number;
  wearFloor: number;
  kerbKg: number;
  tyreWidthMm: number;
  /** The season it retired after, if it did (too old, never scored). */
  retiredYear: number | null;
  /** The garage that has it now, or null while it is for sale or once it has retired. */
  garage: Ref | null;
  owners: {
    garage: Ref;
    from: string;
    to: string | null;
    price: number;
    route: string;
    forSale: boolean;
  }[];
  parts: { category: string; name: string; supplier: string; grade: string; installed: string }[];
  seasons: {
    year: number;
    number: number;
    driver: Ref;
    garage: Ref;
    points: number;
    wins: number;
    badge: NumberBadge;
  }[];
  career: { points: number; wins: number; finals: number };
  decals: Decal[];
}

/** The profile of a car: its identity, history of owners, fitted parts, the drivers who raced it and its decals. */
export function carProfile(db: Database, carId: number): CarProfile {
  const c = all(
    db,
    `SELECT c.*, m.name AS model, m.tier, mf.name AS manufacturer, g.name AS garage_name, g.kind AS garage_kind
       FROM car c JOIN car_model m ON m.id = c.car_model_id
       JOIN manufacturer mf ON mf.id = m.manufacturer_id JOIN garage g ON g.id = c.garage_id
      WHERE c.id = ?`,
    [carId],
  )[0];
  if (!c) throw new Error(`There is no car ${carId}.`);
  const rows = all(
    db,
    `SELECT s.year, e.race_number, e.driver_id, d.name AS driver, e.garage_id, g.name AS garage,
            COALESCE(SUM(r.points), 0) AS points, COUNT(CASE WHEN r.final_pos = 1 THEN 1 END) AS wins,
            COUNT(CASE WHEN r.final_pos IS NOT NULL THEN 1 END) AS finals
       FROM entry e JOIN season s ON s.id = e.season_id JOIN driver d ON d.id = e.driver_id
       JOIN garage g ON g.id = e.garage_id LEFT JOIN result r ON r.entry_id = e.id
      WHERE e.car_id = ? AND e.series = 'main' GROUP BY e.id ORDER BY s.year`,
    [carId],
  );
  const sum = (key: string) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
  return {
    id: carId,
    plate: String(c.plate ?? ''),
    plateState: String(c.plate_state ?? ''),
    chassisNo: c.chassis_no as string,
    model: c.model as string,
    manufacturer: c.manufacturer as string,
    tier: c.tier as string,
    modelYear: c.model_year as number,
    flag: c.flag as string,
    fans: c.fans as number,
    roadKm: c.road_km as number,
    raceKm: c.race_km as number,
    wear: Math.round(Number(c.wear) * 10) / 10,
    restorations: c.restorations as number,
    wearFloor: restorationFloor(c.restorations as number, c.tier as Tier),
    kerbKg: c.kerb_kg_current as number,
    tyreWidthMm: c.tyre_width_mm as number,
    retiredYear: (c.retired_year as number | null) ?? null,
    garage:
      c.garage_kind === 'market'
        ? null
        : { id: c.garage_id as number, name: c.garage_name as string },
    owners: all(
      db,
      `SELECT o.garage_id, g.name, g.kind, o.from_date, o.to_date, o.price, o.route FROM car_ownership o
         JOIN garage g ON g.id = o.garage_id WHERE o.car_id = ? ORDER BY o.from_date, o.id`,
      [carId],
    ).map((o) => ({
      garage: { id: o.garage_id as number, name: o.name as string },
      from: o.from_date as string,
      to: (o.to_date as string | null) ?? null,
      price: o.price as number,
      route: o.route as string,
      forSale: o.kind === 'market',
    })),
    parts: all(
      db,
      `SELECT cp.category, p.name, ps.name AS supplier, p.grade, cp.installed_date FROM car_part cp
         JOIN part p ON p.id = cp.part_id JOIN part_supplier ps ON ps.id = p.supplier_id
        WHERE cp.car_id = ? ORDER BY cp.category`,
      [carId],
    ).map((p) => ({
      category: p.category as string,
      name: p.name as string,
      supplier: p.supplier as string,
      grade: p.grade as string,
      installed: p.installed_date as string,
    })),
    seasons: rows.map((r) => ({
      year: r.year as number,
      number: r.race_number as number,
      driver: { id: r.driver_id as number, name: r.driver as string },
      garage: { id: r.garage_id as number, name: r.garage as string },
      points: Math.round(Number(r.points) * 10) / 10,
      wins: Number(r.wins),
      badge: badgesFor(db, r.year as number).get(r.driver_id as number) ?? NO_BADGE,
    })),
    career: {
      points: Math.round(sum('points') * 10) / 10,
      wins: sum('wins'),
      finals: sum('finals'),
    },
    decals: decalsOf(db, 'car', carId),
  };
}

export interface GarageProfile {
  id: number;
  name: string;
  flag: string;
  /** The Australian place the garage works and races from. */
  base: string;
  /** Where its main factory, founder, owner or executive office is, which its flag stands for. */
  headquarters: string;
  homeState: string;
  colours: [string, string];
  prestige: number;
  fans: number;
  foundedYear: number;
  closedYear: number | null;
  isPlayer: boolean;
  /** Only the player's own garage shows its cash. */
  cash: number | null;
  entries: { number: number; driver: Ref; car: CarRef; badge: NumberBadge }[];
  cars: CarRef[];
  seasons: (SeasonLine & { entries: number })[];
  championships: number[];
  /** A star for each Garage Championship won. */
  decals: Decal[];
  /** The seasons with at least a point, and the first and last of them. */
  scoring: ScoringSpan;
  drivers: (Ref & { years: string })[];
}

/** The profile of a garage: where it is, who and what it races now, its seasons, its cars and its past drivers. */
export function garageProfile(db: Database, garageId: number): GarageProfile {
  const g = all(
    db,
    `SELECT g.*, p.name AS base, p.region, h.name AS hq_name, h.region AS hq_region
       FROM garage g JOIN place p ON p.id = g.base_place_id
       LEFT JOIN place h ON h.id = g.hq_place_id
      WHERE g.id = ? AND g.kind = 'racing'`,
    [garageId],
  )[0];
  if (!g) throw new Error(`There is no garage ${garageId}.`);
  const year = latestYear(db);
  const badges = badgesFor(db, year);
  const entries = all(
    db,
    `SELECT e.race_number, e.driver_id, d.name AS driver, e.car_id, c.plate, c.plate_state, m.name AS model
       FROM entry e JOIN season s ON s.id = e.season_id JOIN driver d ON d.id = e.driver_id
       JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE e.garage_id = ? AND e.series = 'main' AND s.year = ? ORDER BY e.race_number`,
    [garageId, year],
  );
  const seasonRows = all(
    db,
    `SELECT s.id, s.year, COUNT(DISTINCT e.id) AS entries, COALESCE(SUM(r.points), 0) AS points,
            COUNT(CASE WHEN r.final_pos = 1 THEN 1 END) AS wins
       FROM entry e JOIN season s ON s.id = e.season_id LEFT JOIN result r ON r.entry_id = e.id
      WHERE e.garage_id = ? AND e.series = 'main' GROUP BY s.id ORDER BY s.year`,
    [garageId],
  );
  const player = g.is_player === 1;
  return {
    id: garageId,
    name: g.name as string,
    flag: g.flag as string,
    base: `${g.base as string}, ${g.region as string}`,
    headquarters: g.hq_name
      ? `${g.hq_name as string}, ${g.hq_region as string}`
      : `${g.base as string}, ${g.region as string}`,
    homeState: g.home_state as string,
    colours: [g.primary_colour as string, g.secondary_colour as string],
    prestige: g.prestige as number,
    fans: g.fans as number,
    foundedYear: g.founded_year as number,
    closedYear: (g.closed_year as number | null) ?? null,
    isPlayer: player,
    cash: player ? (g.cash as number) : null,
    entries: entries.map((e) => ({
      number: e.race_number as number,
      driver: { id: e.driver_id as number, name: e.driver as string },
      car: {
        id: e.car_id as number,
        plate: e.plate as string,
        plateState: e.plate_state as string,
        model: e.model as string,
      },
      badge: badges.get(e.driver_id as number) ?? NO_BADGE,
    })),
    cars: all(
      db,
      `SELECT c.id, c.plate, c.plate_state, m.name AS model FROM car c JOIN car_model m ON m.id = c.car_model_id
        WHERE c.garage_id = ? ORDER BY c.plate_state, c.plate, c.id`,
      [garageId],
    ).map((c) => ({
      id: c.id as number,
      plate: String(c.plate ?? ''),
      plateState: String(c.plate_state ?? ''),
      model: c.model as string,
    })),
    seasons: seasonRows.map((s) => ({
      year: s.year as number,
      entries: Number(s.entries),
      points: Math.round(Number(s.points) * 10) / 10,
      wins: Number(s.wins),
      rank: ranksOf(db, s.id as number).garages.get(garageId) ?? null,
    })),
    championships: all(db, 'SELECT year FROM season WHERE champion_garage_id = ? ORDER BY year', [
      garageId,
    ]).map((s) => s.year as number),
    decals: garageStars(db, garageId),
    scoring: scoringSpan(
      seasonRows.map((s) => ({ year: s.year as number, points: Number(s.points) })),
    ),
    drivers: all(
      db,
      `SELECT e.driver_id AS id, d.name, MIN(s.year) AS first, MAX(s.year) AS last FROM entry e
         JOIN season s ON s.id = e.season_id JOIN driver d ON d.id = e.driver_id
        WHERE e.garage_id = ? AND e.series = 'main' GROUP BY e.driver_id ORDER BY first, d.name`,
      [garageId],
    ).map((d) => ({
      id: d.id as number,
      name: d.name as string,
      years: d.first === d.last ? String(d.first) : `${d.first as number}-${d.last as number}`,
    })),
  };
}

export type SessionKind = 'prelim' | 'race';

export interface RoundProfile {
  kind: SessionKind;
  year: number;
  round: number;
  course: string;
  status: string;
  /** The dates: the first practice day, the first prelim day and the final. */
  practiceStart: string;
  prelimStart: string;
  finalDate: string;
  /** The weather and temperature of each day of the round, once the prelims have been run. */
  days: { date: string; kind: string; weather: string; temperatureC: number }[];
  pole: Ref | null;
  winner: Ref | null;
  rows: ResultRow[];
}

/** The days of a round's schedule from its saved log (empty before the prelims are run). */
function parseDays(log: string): RoundProfile['days'] {
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

/** The profile of a round's prelims or of its race (the final): the conditions and the full classification. */
export function roundProfile(
  db: Database,
  kind: SessionKind,
  year: number,
  roundNumber: number,
): RoundProfile {
  const c = roundClassification(db, year, roundNumber);
  const round = all(
    db,
    `SELECT r.practice_start, r.prelim_start, r.weather_log FROM round r JOIN season s ON s.id = r.season_id
      WHERE s.year = ? AND r.number = ?`,
    [year, roundNumber],
  )[0]!;
  const list = kind === 'race' ? c.final : c.prelims;
  const pole = c.prelims.find((r) => r.pole);
  const winner = c.final.find((r) => r.position === 1);
  const ref = (r: ResultRow | undefined): Ref | null =>
    r ? { id: r.driverId, name: r.driver } : null;
  const days = parseDays(String(round.weather_log ?? '[]'));
  return {
    kind,
    year,
    round: roundNumber,
    course: c.course,
    status: c.status,
    practiceStart: round.practice_start as string,
    prelimStart: round.prelim_start as string,
    finalDate: c.finalDate,
    days,
    pole: ref(pole),
    winner: ref(winner),
    rows: list,
  };
}

/** The keys (`driver:12`, `car:7`, `garage:3`) of everything greylinked: retired or folded without ever scoring. */
export { greylinkedKeys } from './status';

/** The seasons someone was around: their first season and their last, or null while still active. */
export type ActiveYears = readonly [start: number, end: number | null];

/**
 * The years each driver, garage and car has been active, keyed `driver:12`, `garage:3` and `car:7`.
 * A driver or garage starts with its first entry (a garage founded earlier counts from its founding
 * only if it never entered) and ends the season it retired or closed. A car starts with its first
 * entry (or, if it never raced, its first owner) and ends the season it retired.
 */
export function activeYearsOf(db: Database): Map<string, ActiveYears> {
  const out = new Map<string, ActiveYears>();
  const firstEntry = (col: 'driver_id' | 'garage_id' | 'car_id') =>
    new Map(
      all(
        db,
        `SELECT e.${col} AS id, MIN(s.year) AS start FROM entry e JOIN season s ON s.id = e.season_id GROUP BY e.${col}`,
      ).map((r) => [r.id as number, r.start as number]),
    );
  const driverStart = firstEntry('driver_id');
  for (const d of all(db, 'SELECT id, retired_year FROM driver')) {
    const start = driverStart.get(d.id as number);
    if (start !== undefined)
      out.set(`driver:${d.id as number}`, [start, (d.retired_year as number | null) ?? null]);
  }
  const garageStart = firstEntry('garage_id');
  for (const g of all(
    db,
    "SELECT id, founded_year, closed_year FROM garage WHERE kind = 'racing'",
  )) {
    const start = garageStart.get(g.id as number) ?? (g.founded_year as number);
    out.set(`garage:${g.id as number}`, [start, (g.closed_year as number | null) ?? null]);
  }
  const carStart = firstEntry('car_id');
  for (const c of all(
    db,
    `SELECT c.id, c.model_year, c.retired_year,
            (SELECT MIN(CAST(substr(o.from_date, 1, 4) AS INTEGER)) FROM car_ownership o WHERE o.car_id = c.id) AS owned
       FROM car c`,
  )) {
    out.set(`car:${c.id as number}`, [
      carStart.get(c.id as number) ?? (c.owned as number | null) ?? (c.model_year as number),
      (c.retired_year as number | null) ?? null,
    ]);
  }
  return out;
}

/** The flag code of every driver and garage (keyed `driver:12` and `garage:3`), as it is now. */
export function flagsOf(db: Database): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of all(db, 'SELECT id, flag FROM driver'))
    out.set(`driver:${d.id as number}`, d.flag as string);
  for (const g of all(db, "SELECT id, flag FROM garage WHERE kind = 'racing'"))
    out.set(`garage:${g.id as number}`, g.flag as string);
  return out;
}

/** Whether Australia has become the Commonwealth of Vyktory in this career. */
export function vyktoryHappened(db: Database): boolean {
  return all(db, "SELECT 1 AS n FROM world_event WHERE event_id = 'vyktory' LIMIT 1").length > 0;
}

/** The dragon-blooded drivers: the twelve canonical characters, who carry the dragon mark. */
export function dragonDriverIds(db: Database): Set<number> {
  return new Set(all(db, 'SELECT id FROM driver WHERE easter_egg = 1').map((d) => d.id as number));
}

/**
 * Everything in the Registry, as short lines to browse and search. Drivers with a number this
 * season come first, in number order; the rest (retirees, free agents) follow alphabetically.
 */
export interface RegistryIndex {
  drivers: {
    id: number;
    name: string;
    number: number | null;
    garage: string | null;
    badge: NumberBadge;
    status: RegistryStatus;
  }[];
  cars: (CarRef & { status: RegistryStatus })[];
  garages: (Ref & { status: RegistryStatus })[];
  rounds: { year: number; round: number; course: string; status: string }[];
}

export function registryIndex(db: Database): RegistryIndex {
  const year = latestYear(db);
  const badges = badgesFor(db, year);
  const status = registryStatuses(db);
  return {
    drivers: all(
      db,
      `SELECT d.id, d.name, e.race_number, g.name AS garage FROM driver d
         LEFT JOIN entry e ON e.driver_id = d.id AND e.series = 'main' AND e.season_id = (SELECT id FROM season WHERE year = ?)
         LEFT JOIN garage g ON g.id = e.garage_id
        ORDER BY e.race_number IS NULL, e.race_number, d.name, d.id`,
      [year],
    ).map((d) => ({
      id: d.id as number,
      name: d.name as string,
      number: (d.race_number as number | null) ?? null,
      garage: (d.garage as string | null) ?? null,
      badge: badges.get(d.id as number) ?? NO_BADGE,
      status: status.driver.get(d.id as number) ?? 'active',
    })),
    cars: all(
      db,
      `SELECT c.id, c.plate, c.plate_state, m.name AS model FROM car c JOIN car_model m ON m.id = c.car_model_id
        ORDER BY c.plate_state, c.plate`,
    ).map((c) => ({
      id: c.id as number,
      plate: String(c.plate ?? ''),
      plateState: String(c.plate_state ?? ''),
      model: c.model as string,
      status: status.car.get(c.id as number) ?? 'active',
    })),
    garages: all(db, "SELECT id, name FROM garage WHERE kind = 'racing' ORDER BY name").map(
      (g) => ({
        id: g.id as number,
        name: g.name as string,
        status: status.garage.get(g.id as number) ?? 'active',
      }),
    ),
    rounds: all(
      db,
      `SELECT s.year, r.number, c.name AS course, r.status FROM round r JOIN season s ON s.id = r.season_id
         JOIN course c ON c.id = r.course_id ORDER BY s.year DESC, r.number`,
    ).map((r) => ({
      year: r.year as number,
      round: r.number as number,
      course: r.course as string,
      status: r.status as string,
    })),
  };
}

/** Where in the Registry to look. */
export type RegistryTarget =
  | { kind: 'index' }
  | { kind: 'driver' | 'car' | 'garage'; id: number }
  | { kind: SessionKind; year: number; round: number };

/** A page of the Registry, loaded from the database. */
export type RegistryPage =
  | { kind: 'index'; data: RegistryIndex }
  | { kind: 'driver'; data: DriverProfile }
  | { kind: 'car'; data: CarProfile }
  | { kind: 'garage'; data: GarageProfile }
  | { kind: SessionKind; data: RoundProfile };

/** Loads the page for a target. */
export function registryPage(db: Database, target: RegistryTarget): RegistryPage {
  switch (target.kind) {
    case 'index':
      return { kind: 'index', data: registryIndex(db) };
    case 'driver':
      return { kind: 'driver', data: driverProfile(db, target.id) };
    case 'car':
      return { kind: 'car', data: carProfile(db, target.id) };
    case 'garage':
      return { kind: 'garage', data: garageProfile(db, target.id) };
    default:
      return {
        kind: target.kind,
        data: roundProfile(db, target.kind, target.year, target.round),
      };
  }
}

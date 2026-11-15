// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  knowledgeOf,
  placement,
  potentialKnowledge,
  readScaled,
  readValue,
  type Reading,
  type Scout,
  type Subject,
} from '../sim/scouting';
import { scoutingBalance } from '../sim/worldgen/data';
import { fameFromFans } from '../sim/worldgen';
import { restorationFloor } from '../sim/wear';
import type { Tier } from '../sim/worldgen/types';
import { overallRating } from '../sim/worldgen/rating';
import { ROAD_TYPES, type RoadType } from '../sim/worldgen/types';
import { readCareer } from './career';
import { all } from './entries';
import { garageScoutLift, scoutsForEngine } from './scouts';

/** What the player's garage knows, gathered once so a list of drivers does not ask the database for each. */
export interface KnowledgeContext {
  seed: string;
  year: number;
  garageId: number;
  scouts: Scout[];
  scoutLift: number;
  prestige: number;
  playerFame: number;
  /** Scored finals of each driver in the last three seasons. */
  finals: Map<number, number>;
  /** Drivers who raised an attention flag this season. */
  flagged: Set<number>;
  /** The last year of the driver's latest contract with this garage. */
  lastContractEnd: Map<number, number>;
  /** Drivers in one of this garage's entries this season. */
  entered: Set<number>;
  /** Cars: scored finals in the last three seasons, attention flags this season, and the last year the garage owned each. */
  carFinals: Map<number, number>;
  carFlagged: Set<number>;
  carLastOwned: Map<number, number>;
  /** Garages: scored finals of their entries in the last three seasons and attention flags this season. */
  garageFinals: Map<number, number>;
  garageFlagged: Set<number>;
  /** Cars the garage owns now. */
  carsOwned: Set<number>;
  /** Cars with a paid inspection that still counts (the car has the same owner as when it was inspected). */
  inspected: Set<number>;
}

export function knowledgeContext(db: Database, garageId: number): KnowledgeContext {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const year = Number(career.gameDate.slice(0, 4));
  const garage = all(db, 'SELECT prestige, fans FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const toMap = (rows: Record<string, unknown>[], key: string, value: string) =>
    new Map(rows.map((r) => [r[key] as number, Number(r[value])]));
  return {
    seed: career.masterSeed,
    year,
    garageId,
    scouts: scoutsForEngine(db, garageId),
    scoutLift: garageScoutLift(db, garageId),
    prestige: Number(garage.prestige),
    playerFame: fameFromFans(Number(garage.fans)),
    finals: toMap(
      all(
        db,
        `SELECT e.driver_id AS id, COUNT(*) AS n
           FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
          WHERE r.final_pos IS NOT NULL AND s.year > ? GROUP BY e.driver_id`,
        [year - scoutingBalance.evidence.seasons],
      ),
      'id',
      'n',
    ),
    flagged: new Set(
      all(
        db,
        `SELECT DISTINCT e.driver_id AS id
           FROM event_log ev JOIN entry e ON e.id = ev.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = ev.round_id JOIN season s ON s.id = ro.season_id
          WHERE ev.type = 'attention' AND s.year = ?`,
        [year],
      ).map((r) => r.id as number),
    ),
    lastContractEnd: toMap(
      all(
        db,
        'SELECT driver_id AS id, MAX(end_year) AS n FROM contract WHERE garage_id = ? GROUP BY driver_id',
        [garageId],
      ),
      'id',
      'n',
    ),
    entered: new Set(
      all(
        db,
        `SELECT driver_id AS id FROM entry
          WHERE garage_id = ? AND season_id = (SELECT MAX(id) FROM season)`,
        [garageId],
      ).map((r) => r.id as number),
    ),
    carFinals: toMap(
      all(
        db,
        `SELECT e.car_id AS id, COUNT(*) AS n
           FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
          WHERE r.final_pos IS NOT NULL AND s.year > ? GROUP BY e.car_id`,
        [year - scoutingBalance.evidence.seasons],
      ),
      'id',
      'n',
    ),
    carFlagged: new Set(
      all(
        db,
        `SELECT DISTINCT e.car_id AS id
           FROM event_log ev JOIN entry e ON e.id = ev.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = ev.round_id JOIN season s ON s.id = ro.season_id
          WHERE ev.type = 'attention' AND s.year = ?`,
        [year],
      ).map((r) => r.id as number),
    ),
    carLastOwned: new Map(
      all(
        db,
        `SELECT car_id AS id, MAX(COALESCE(to_date, ?)) AS last FROM car_ownership
          WHERE garage_id = ? GROUP BY car_id`,
        [career.gameDate, garageId],
      ).map((r) => [r.id as number, Number(String(r.last).slice(0, 4))]),
    ),
    garageFinals: toMap(
      all(
        db,
        `SELECT e.garage_id AS id, COUNT(*) AS n
           FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = r.round_id JOIN season s ON s.id = ro.season_id
          WHERE r.final_pos IS NOT NULL AND s.year > ? GROUP BY e.garage_id`,
        [year - scoutingBalance.evidence.seasons],
      ),
      'id',
      'n',
    ),
    garageFlagged: new Set(
      all(
        db,
        `SELECT DISTINCT e.garage_id AS id
           FROM event_log ev JOIN entry e ON e.id = ev.entry_id AND e.series = 'main'
           JOIN round ro ON ro.id = ev.round_id JOIN season s ON s.id = ro.season_id
          WHERE ev.type = 'attention' AND s.year = ?`,
        [year],
      ).map((r) => r.id as number),
    ),
    carsOwned: new Set(
      all(db, 'SELECT id FROM car WHERE garage_id = ?', [garageId]).map((r) => r.id as number),
    ),
    inspected: new Set(
      all(
        db,
        `SELECT i.car_id AS id FROM car_inspection i JOIN car c ON c.id = i.car_id
          WHERE i.garage_id = ? AND c.garage_id = i.seller_garage_id`,
        [garageId],
      ).map((r) => r.id as number),
    ),
  };
}

/** A driver's true numbers, as the database holds them. These never reach a screen unread. */
export interface DriverTruth {
  id: number;
  fame: number;
  rating: number;
  pace: number;
  consistency: number;
  racecraft: number;
  tyreManagement: number;
  composure: number;
  wetSkill: number;
  potential: number;
}

export const DRIVER_STATS = [
  'pace',
  'consistency',
  'racecraft',
  'tyreManagement',
  'composure',
  'wetSkill',
] as const;

export type DriverStat = (typeof DRIVER_STATS)[number];

/** What the player sees of a driver: a word, a range or the exact value for each hidden number. */
export interface DriverReading {
  /** The driver is signed or entered with the player's garage, so nothing is hidden. */
  owned: boolean;
  /** 0 to 100. */
  knowledge: number;
  rating: Reading;
  potential: Reading;
  stats: Record<DriverStat, Reading>;
}

/** Whether the driver is under contract to the garage, or in one of its entries. */
export function isOwnedDriver(ctx: KnowledgeContext, driverId: number): boolean {
  return ctx.entered.has(driverId) || (ctx.lastContractEnd.get(driverId) ?? -1) >= ctx.year;
}

/** The knowledge score for a driver the player does not own. */
export function driverKnowledge(ctx: KnowledgeContext, truth: DriverTruth): number {
  const subject: Subject = { kind: 'drivers', id: truth.id };
  const end = ctx.lastContractEnd.get(truth.id);
  return knowledgeOf({
    subject,
    scouts: ctx.scouts,
    scoutLift: ctx.scoutLift,
    scoredFinals: ctx.finals.get(truth.id) ?? 0,
    fame: truth.fame,
    prestige: ctx.prestige,
    playerFame: ctx.playerFame,
    owned: false,
    yearsSinceWorked: end === undefined ? null : ctx.year - end,
    flagged: ctx.flagged.has(truth.id),
  }).total;
}

const exact = (value: number): Reading => ({ kind: 'exact', value: Math.round(value) });

/** Every number exact: for a driver the player owns, or when there is no garage to learn for yet. */
export function exactReading(truth: DriverTruth, owned: boolean): DriverReading {
  return {
    owned,
    knowledge: 100,
    rating: exact(truth.rating),
    potential: exact(truth.potential),
    stats: Object.fromEntries(DRIVER_STATS.map((k) => [k, exact(truth[k])])) as Record<
      DriverStat,
      Reading
    >,
  };
}

/** What the player sees of a driver. Everything is exact for a driver the player owns. */
export function readDriver(ctx: KnowledgeContext, truth: DriverTruth): DriverReading {
  if (isOwnedDriver(ctx, truth.id)) return exactReading(truth, true);
  const knowledge = driverKnowledge(ctx, truth);
  const subject: Subject = { kind: 'drivers', id: truth.id };
  const read = (value: number, stat: string, k: number): Reading =>
    readValue(Math.round(value), k, placement(ctx.seed, subject, ctx.year, stat));
  return {
    owned: false,
    knowledge,
    rating: read(truth.rating, 'rating', knowledge),
    potential: read(truth.potential, 'potential', potentialKnowledge(knowledge)),
    stats: Object.fromEntries(DRIVER_STATS.map((k) => [k, read(truth[k], k, knowledge)])) as Record<
      DriverStat,
      Reading
    >,
  };
}

/**
 * What the player's garage reads of any driver, by id (the Registry page). With no player garage yet
 * (the starter screen) nothing is hidden.
 */
export function readDriverById(db: Database, driverId: number): DriverReading {
  const d = all(db, 'SELECT * FROM driver WHERE id = ?', [driverId])[0];
  if (!d) throw new Error(`There is no driver ${driverId}.`);
  const affinities = {} as Record<RoadType, number>;
  for (const type of ROAD_TYPES) affinities[type] = 0;
  for (const a of all(
    db,
    'SELECT road_type, rating FROM driver_road_affinity WHERE driver_id = ?',
    [driverId],
  ))
    affinities[a.road_type as RoadType] = a.rating as number;
  const truth: DriverTruth = {
    id: driverId,
    fame: d.fame as number,
    rating: overallRating({
      pace: d.pace as number,
      consistency: d.consistency as number,
      racecraft: d.racecraft as number,
      tyreManagement: d.tyre_management as number,
      composure: d.composure as number,
      wetSkill: d.wet_skill as number,
      affinities,
    }),
    pace: d.pace as number,
    consistency: d.consistency as number,
    racecraft: d.racecraft as number,
    tyreManagement: d.tyre_management as number,
    composure: d.composure as number,
    wetSkill: d.wet_skill as number,
    potential: d.potential as number,
  };
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  return player
    ? readDriver(knowledgeContext(db, player.id as number), truth)
    : exactReading(truth, false);
}

/** A car's true numbers, as the database holds them. */
export interface CarTruth {
  id: number;
  fans: number;
  /** Chassis wear, 0 (new) to 100. */
  wear: number;
  restorations: number;
  /** The least wear the chassis can have now. */
  wearFloor: number;
  kerbKg: number;
  tyreWidthMm: number;
}

/** What the player sees of a car: its condition (100 minus wear) and the hidden numbers behind its profile. */
export interface CarReading {
  /** The garage owns it, or has paid to inspect it, so nothing is hidden. */
  owned: boolean;
  inspected: boolean;
  /** 0 to 100. */
  knowledge: number;
  /** 100 is new, 0 is worn out. */
  condition: Reading;
  /** The best condition a restoration could still reach: 100 minus the wear floor. */
  bestCondition: Reading;
  /** How many full restorations it has had: known only when exact, else null. */
  restorations: number | null;
  /** Kerb weight in kilograms and tyre width in millimetres: none while only a word is known. */
  kerbKg: Reading | null;
  tyreWidthMm: Reading | null;
}

/** The scale kerb weight and tyre width are read on (kilograms and millimetres). */
const KG_SCALE: [number, number] = [400, 2500];
const MM_SCALE: [number, number] = [120, 460];

export const exactCar = (truth: CarTruth, owned: boolean, inspected: boolean): CarReading => ({
  owned,
  inspected,
  knowledge: 100,
  condition: exact(100 - truth.wear),
  bestCondition: exact(100 - truth.wearFloor),
  restorations: truth.restorations,
  kerbKg: exact(truth.kerbKg),
  tyreWidthMm: exact(truth.tyreWidthMm),
});

/** The knowledge score for a car the player does not own and has not inspected. */
export function carKnowledge(ctx: KnowledgeContext, truth: CarTruth): number {
  const last = ctx.carLastOwned.get(truth.id);
  return knowledgeOf({
    subject: { kind: 'cars', id: truth.id },
    scouts: ctx.scouts,
    scoutLift: ctx.scoutLift,
    scoredFinals: ctx.carFinals.get(truth.id) ?? 0,
    fame: fameFromFans(truth.fans),
    prestige: ctx.prestige,
    playerFame: ctx.playerFame,
    owned: false,
    yearsSinceWorked: last === undefined ? null : ctx.year - last,
    flagged: ctx.carFlagged.has(truth.id),
  }).total;
}

/** What the player sees of a car: exact if owned or inspected, otherwise behind the fog. */
export function readCar(ctx: KnowledgeContext, truth: CarTruth): CarReading {
  if (ctx.carsOwned.has(truth.id)) return exactCar(truth, true, false);
  if (ctx.inspected.has(truth.id)) return exactCar(truth, false, true);
  const knowledge = carKnowledge(ctx, truth);
  const subject: Subject = { kind: 'cars', id: truth.id };
  const place = (stat: string): number => placement(ctx.seed, subject, ctx.year, stat);
  const condition = readValue(Math.round(100 - truth.wear), knowledge, place('condition'));
  const bestCondition = readValue(
    Math.round(100 - truth.wearFloor),
    knowledge,
    place('bestCondition'),
  );
  const known = condition.kind === 'exact';
  return {
    owned: false,
    inspected: false,
    knowledge,
    condition,
    bestCondition,
    restorations: known ? truth.restorations : null,
    kerbKg:
      known || knowledge >= scoutingBalance.rangeFrom
        ? readScaled(truth.kerbKg, knowledge, place('kerb'), ...KG_SCALE)
        : null,
    tyreWidthMm:
      known || knowledge >= scoutingBalance.rangeFrom
        ? readScaled(truth.tyreWidthMm, knowledge, place('tyre'), ...MM_SCALE)
        : null,
  };
}

/** Whether a car is for sale (on the used market or in the open auction): the only cars that can be inspected. */
export function isForSale(db: Database, carId: number): boolean {
  return (
    all(db, "SELECT 1 FROM market_listing WHERE car_id = ? AND status = 'open'", [carId]).length >
      0 ||
    all(
      db,
      `SELECT 1 FROM auction_lot l JOIN auction a ON a.id = l.auction_id AND a.status = 'open'
        WHERE l.car_id = ?`,
      [carId],
    ).length > 0
  );
}

/** A car's true numbers from its row, for the Registry page and the lists. */
export function carTruthOf(db: Database, carId: number): CarTruth {
  const c = all(
    db,
    `SELECT c.id, c.fans, c.wear, c.restorations, c.kerb_kg_current, c.tyre_width_mm, m.tier
       FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ?`,
    [carId],
  )[0];
  if (!c) throw new Error(`There is no car ${carId}.`);
  return {
    id: carId,
    fans: c.fans as number,
    wear: c.wear as number,
    restorations: c.restorations as number,
    wearFloor: restorationFloor(c.restorations as number, c.tier as Tier),
    kerbKg: c.kerb_kg_current as number,
    tyreWidthMm: c.tyre_width_mm as number,
  };
}

/** What the player's garage reads of any car, by id. With no player garage yet nothing is hidden. */
export function readCarById(db: Database, carId: number): CarReading {
  const truth = carTruthOf(db, carId);
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  return player
    ? readCar(knowledgeContext(db, player.id as number), truth)
    : exactCar(truth, false, false);
}

/** A garage's true numbers, as the database holds them. */
export interface GarageTruth {
  id: number;
  prestige: number;
  fans: number;
}

/** What the player sees of a garage: its prestige and following, and whether its business is known. */
export interface GarageReading {
  /** The player's own garage: nothing is hidden. */
  owned: boolean;
  /** 0 to 100. */
  knowledge: number;
  prestige: Reading;
  /** The garage's fame (0 to 100, which follows its fans), read in place of an exact fan count. */
  following: Reading;
  /** Enough is known to say who its sponsor and supplier are and what facilities it runs. */
  detail: boolean;
}

/** The knowledge score for a garage that is not the player's. */
export function garageKnowledge(ctx: KnowledgeContext, truth: GarageTruth): number {
  return knowledgeOf({
    subject: { kind: 'garages', id: truth.id },
    scouts: ctx.scouts,
    scoutLift: ctx.scoutLift,
    scoredFinals: ctx.garageFinals.get(truth.id) ?? 0,
    fame: fameFromFans(truth.fans),
    prestige: ctx.prestige,
    playerFame: ctx.playerFame,
    owned: false,
    yearsSinceWorked: null,
    flagged: ctx.garageFlagged.has(truth.id),
  }).total;
}

/** What the player sees of a garage: exact for their own, behind the fog for any other. */
export function readGarage(ctx: KnowledgeContext, truth: GarageTruth): GarageReading {
  const fame = Math.round(fameFromFans(truth.fans));
  if (truth.id === ctx.garageId)
    return {
      owned: true,
      knowledge: 100,
      prestige: exact(truth.prestige),
      following: exact(fame),
      detail: true,
    };
  const knowledge = garageKnowledge(ctx, truth);
  const subject: Subject = { kind: 'garages', id: truth.id };
  const place = (stat: string): number => placement(ctx.seed, subject, ctx.year, stat);
  return {
    owned: false,
    knowledge,
    prestige: readValue(Math.round(truth.prestige), knowledge, place('prestige')),
    following: readValue(fame, knowledge, place('following')),
    detail: knowledge >= scoutingBalance.rangeFrom,
  };
}

/** What the player's garage reads of a garage, by id. With no player garage yet nothing is hidden. */
export function readGarageById(db: Database, garageId: number): GarageReading {
  const g = all(db, 'SELECT id, prestige, fans FROM garage WHERE id = ?', [garageId])[0];
  if (!g) throw new Error(`There is no garage ${garageId}.`);
  const truth: GarageTruth = {
    id: garageId,
    prestige: g.prestige as number,
    fans: g.fans as number,
  };
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!player)
    return {
      owned: false,
      knowledge: 100,
      prestige: exact(truth.prestige),
      following: exact(fameFromFans(truth.fans)),
      detail: true,
    };
  return readGarage(knowledgeContext(db, player.id as number), truth);
}

/**
 * What the player reads of the skill (0 to 100) of someone who works for a garage (an executive, a
 * mechanic): they are known as well as their garage is, and exact at the player's own garage.
 */
export function readStaffSkill(
  db: Database,
  garageId: number,
  kind: 'executive' | 'staff',
  personId: number,
  skill: number,
): { reading: Reading; knowledge: number; owned: boolean } {
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!player || (player.id as number) === garageId)
    return { reading: exact(skill), knowledge: 100, owned: (player?.id as number) === garageId };
  const ctx = knowledgeContext(db, player.id as number);
  const g = all(db, 'SELECT id, prestige, fans FROM garage WHERE id = ?', [garageId])[0];
  const knowledge = garageKnowledge(ctx, {
    id: garageId,
    prestige: Number(g?.prestige ?? 0),
    fans: Number(g?.fans ?? 0),
  });
  const subject: Subject = { kind: 'garages', id: garageId };
  return {
    reading: readValue(
      Math.round(skill),
      knowledge,
      placement(ctx.seed, subject, ctx.year, `skill:${kind}:${personId}`),
    ),
    knowledge,
    owned: false,
  };
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  knowledgeOf,
  placement,
  potentialKnowledge,
  readValue,
  type Reading,
  type Scout,
  type Subject,
} from '../sim/scouting';
import { scoutingBalance } from '../sim/worldgen/data';
import { fameFromFans } from '../sim/worldgen';
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

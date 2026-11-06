// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  affinityCap,
  affinityGain,
  areaFactor,
  dailyKm,
  daysBefore,
  deliveryIncome,
  relocationCost,
  roadTypeOfPlace,
} from '../sim/daily';
import { wearFromKm } from '../sim/wear';
import type { RoadType } from '../sim/worldgen/types';
import type { Tier } from '../sim/worldgen/types';
import { readCareer } from './career';
import { all } from './entries';
import { wearParts } from './repairs';

/** The days of daily life that come before a round, from the calendar in the database. */
function gapDaysBefore(db: Database, seasonId: number, roundNumber: number): number {
  const round = all(db, 'SELECT practice_start FROM round WHERE season_id = ? AND number = ?', [
    seasonId,
    roundNumber,
  ])[0];
  if (!round) throw new Error(`There is no round ${roundNumber}.`);
  const previous = all(db, 'SELECT final_date FROM round WHERE season_id = ? AND number = ?', [
    seasonId,
    roundNumber - 1,
  ])[0];
  return daysBefore(
    roundNumber,
    round.practice_start as string,
    (previous?.final_date as string | undefined) ?? null,
  );
}

export interface DailyLife {
  days: number;
  income: number;
  km: number;
}

/**
 * Settles the daily life of a garage in the days before a round (see the GDD, "Driver origins:
 * hometown and residence"). Each entered car is driven on everyday and delivery roads for those
 * days: it earns delivery income for the garage (more in a busy area, set by where its driver
 * lives), covers road kilometres that wear the chassis and its parts, and its driver gets better,
 * slowly, at the kind of road around their home. Called from `settleRound` inside its transaction,
 * for the player's garage only (the computer garages' costs and income are not modelled bill by bill).
 */
export function settleDailyLife(
  db: Database,
  garageId: number,
  roundId: number,
  roundNumber: number,
  date: string,
): DailyLife {
  const round = all(db, 'SELECT season_id FROM round WHERE id = ?', [roundId])[0]!;
  const seasonId = round.season_id as number;
  const days = gapDaysBefore(db, seasonId, roundNumber);
  const entries = all(
    db,
    `SELECT e.car_id, e.driver_id, c.road_km, c.race_km, c.wear_offset, m.tier,
            p.stable_id AS place, p.region
       FROM entry e JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
       JOIN driver d ON d.id = e.driver_id JOIN place p ON p.id = d.residence_place_id
      WHERE e.garage_id = ? AND e.season_id = ? AND e.series = 'main' ORDER BY e.id`,
    [garageId, seasonId],
  );
  let income = 0;
  let km = 0;
  if (days <= 0) return { days: 0, income: 0, km: 0 };
  const cap = affinityCap();
  for (const e of entries) {
    const distance = dailyKm(days);
    const roadKm = (e.road_km as number) + distance;
    const tier = e.tier as Tier;
    db.run('UPDATE car SET road_km = ?, wear = ? WHERE id = ?', [
      Math.round(roadKm),
      Math.max(0, wearFromKm(roadKm, e.race_km as number, tier) - (e.wear_offset as number)),
      e.car_id as number,
    ]);
    wearParts(db, e.car_id as number, distance, 'road', tier);
    income += deliveryIncome(days, e.region as string);
    km += distance;
    // The roads around home slowly train that road type, up to a cap (a driver already above it keeps their rating).
    const type: RoadType = roadTypeOfPlace({ id: e.place as string });
    const rating = Number(
      all(db, 'SELECT rating FROM driver_road_affinity WHERE driver_id = ? AND road_type = ?', [
        e.driver_id as number,
        type,
      ])[0]?.rating ?? 0,
    );
    if (rating < cap) {
      db.run('UPDATE driver_road_affinity SET rating = ? WHERE driver_id = ? AND road_type = ?', [
        Math.round(Math.min(cap, rating + affinityGain(days)) * 10) / 10,
        e.driver_id as number,
        type,
      ]);
    }
  }
  if (income > 0) {
    db.run(
      'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
      [garageId, roundId, date, 'delivery', income, `${days} days before round ${roundNumber}`],
    );
    db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [income, garageId]);
  }
  return { days, income, km };
}

export interface DriverHome {
  driverId: number;
  name: string;
  /** Where the driver lives now, and the kind of road around it. */
  residence: string;
  region: string;
  roadType: RoadType;
  /** Their rating on that kind of road, and the local-area factor on delivery pay. */
  affinity: number;
  areaFactor: number;
  /** Where they are moving to when the next season starts, or null. */
  movingTo: string | null;
}

export interface DailyLifeView {
  drivers: DriverHome[];
  /** Whether a move can be booked now (only in the off-season, after a season ends). */
  canMove: boolean;
  cost: number;
  /** The days before the next round, and what delivery work should earn in them. */
  nextGap: { round: number; days: number; income: number } | null;
}

const placeName = (name: unknown, region: unknown): string => `${String(name)}, ${String(region)}`;

/** The homes of a garage's entered drivers and what daily life is doing for them. */
export function dailyLifeView(db: Database, garageId: number): DailyLifeView {
  const season = all(db, 'SELECT id, year, status FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) return { drivers: [], canMove: false, cost: relocationCost(), nextGap: null };
  const drivers = all(
    db,
    `SELECT d.id, d.name, p.stable_id AS place, p.name AS place_name, p.region,
            mp.name AS move_name, mp.region AS move_region
       FROM entry e JOIN driver d ON d.id = e.driver_id JOIN place p ON p.id = d.residence_place_id
       LEFT JOIN driver_move dm ON dm.driver_id = d.id LEFT JOIN place mp ON mp.id = dm.place_id
      WHERE e.garage_id = ? AND e.season_id = ? AND e.series = 'main' ORDER BY e.race_number`,
    [garageId, season.id as number],
  ).map((r) => {
    const roadType = roadTypeOfPlace({ id: r.place as string });
    return {
      driverId: r.id as number,
      name: r.name as string,
      residence: placeName(r.place_name, r.region),
      region: r.region as string,
      roadType,
      affinity: Number(
        all(db, 'SELECT rating FROM driver_road_affinity WHERE driver_id = ? AND road_type = ?', [
          r.id as number,
          roadType,
        ])[0]?.rating ?? 0,
      ),
      areaFactor: areaFactor(r.region as string),
      movingTo: r.move_name ? placeName(r.move_name, r.move_region) : null,
    };
  });
  const next = all(
    db,
    "SELECT number FROM round WHERE season_id = ? AND status = 'scheduled' ORDER BY number LIMIT 1",
    [season.id as number],
  )[0];
  let nextGap: DailyLifeView['nextGap'] = null;
  if (next && season.status !== 'complete') {
    const round = next.number as number;
    const days = gapDaysBefore(db, season.id as number, round);
    nextGap = {
      round,
      days,
      income: drivers.reduce((sum, d) => sum + deliveryIncome(days, d.region), 0),
    };
  }
  return { drivers, canMove: season.status === 'complete', cost: relocationCost(), nextGap };
}

/**
 * Books a move of a driver's home. It can only be done in the off-season, for a driver the garage
 * had entered last season; it costs $5,000 from the garage and takes effect when the next season
 * starts. Booking another place replaces the first (the fee is not paid twice).
 */
export function moveDriver(
  db: Database,
  garageId: number,
  driverId: number,
  placeStableId: string,
): void {
  const season = all(db, 'SELECT id, status FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season || season.status !== 'complete')
    throw new Error('A driver can only move in the off-season, after the season ends.');
  if (
    !all(
      db,
      "SELECT 1 AS n FROM entry WHERE garage_id = ? AND driver_id = ? AND season_id = ? AND series = 'main'",
      [garageId, driverId, season.id as number],
    )[0]
  )
    throw new Error('The garage did not enter this driver last season.');
  const place = all(db, 'SELECT id FROM place WHERE stable_id = ?', [placeStableId])[0];
  if (!place) throw new Error(`There is no place "${placeStableId}".`);
  const home = all(db, 'SELECT residence_place_id FROM driver WHERE id = ?', [driverId])[0]!;
  if (home.residence_place_id === place.id) throw new Error('The driver already lives there.');
  const pending = all(db, 'SELECT place_id FROM driver_move WHERE driver_id = ?', [driverId])[0];
  const fee = pending ? 0 : relocationCost();
  const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
  if (cash < fee) throw new Error('The garage cannot afford the move.');
  const date = readCareer(db)!.gameDate;
  db.exec('BEGIN');
  try {
    db.run(
      `INSERT INTO driver_move (driver_id, place_id, paid_on) VALUES (?, ?, ?)
       ON CONFLICT (driver_id) DO UPDATE SET place_id = excluded.place_id`,
      [driverId, place.id as number, date],
    );
    if (fee > 0) {
      db.run(
        "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'relocation', ?, ?)",
        [garageId, date, -fee, `Move, driver ${driverId}`],
      );
      db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [fee, garageId]);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Moves every driver with a booked move to their new home. Called when a season starts. Returns how many moved. */
export function applyMoves(db: Database): number {
  const moves = all(db, 'SELECT driver_id, place_id FROM driver_move');
  for (const m of moves)
    db.run('UPDATE driver SET residence_place_id = ? WHERE id = ?', [
      m.place_id as number,
      m.driver_id as number,
    ]);
  db.run('DELETE FROM driver_move');
  return moves.length;
}

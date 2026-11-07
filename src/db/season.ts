// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  driverNationStandings,
  driverStandings,
  garageNationStandings,
  garageStandings,
  manufacturerStandings,
  type RoundResult,
  type Standing,
} from '../sim/standings';
import { fanBalance, seasonBalance } from '../sim/worldgen/data';
import { recordValuations, reviewBoard } from './equity';
import { closeLedgerYear } from './ledger';
import { garageBonuses } from './bonuses';
import { awardSeason, type AwardWon } from './awards';
import { all } from './entries';
import { refreshPlayerPrestige } from './prestige';
import { splitPrize } from './prizes';

/** Every main-series result of a season, with the groups each one scores for. */
export function loadRoundResults(db: Database, seasonId: number): RoundResult[] {
  return all(
    db,
    `SELECT ro.number AS round, e.driver_id, e.garage_id, m.manufacturer_id,
            d.flag AS driver_flag, g.flag AS garage_flag,
            COALESCE(r.final_pos, r.prelim_pos) AS position, r.points, r.prelim_time_ms
       FROM result r
       JOIN round ro ON ro.id = r.round_id
       JOIN entry e ON e.id = r.entry_id
       JOIN driver d ON d.id = e.driver_id
       JOIN garage g ON g.id = e.garage_id
       JOIN car c ON c.id = e.car_id
       JOIN car_model m ON m.id = c.car_model_id
      WHERE ro.season_id = ? AND e.series = 'main'`,
    [seasonId],
  ).map((r) => ({
    round: r.round as number,
    driverId: r.driver_id as number,
    garageId: r.garage_id as number,
    manufacturerId: r.manufacturer_id as number,
    driverFlag: r.driver_flag as string,
    garageFlag: r.garage_flag as string,
    position: r.position as number | null,
    points: r.points as number,
    prelimTimeMs: r.prelim_time_ms as number | null,
  }));
}

export interface StandingsTables {
  drivers: Standing[];
  garages: Standing[];
  manufacturers: Standing[];
  driverNations: Standing[];
  garageNations: Standing[];
}

/** The five championship tables for a season so far. */
export function computeStandings(db: Database, seasonId: number): StandingsTables {
  const rows = loadRoundResults(db, seasonId);
  return {
    drivers: driverStandings(rows),
    garages: garageStandings(rows),
    manufacturers: manufacturerStandings(rows),
    driverNations: driverNationStandings(rows),
    garageNations: garageNationStandings(rows),
  };
}

export interface SeasonEnd {
  year: number;
  championDriverId: number;
  /** The garage that won the Garage Championship. */
  championGarageId: number;
  /** The garage of the drivers' champion, which is paid the champion's prize. */
  championDriverGarageId: number;
  championPoints: number;
  prizePaid: number;
  bonusesPaid: number;
  /** The season's awards, given out as it ends. */
  awards: AwardWon[];
}

/**
 * Closes a season once all six rounds are done: pays the champion's prize and the pole and
 * overtake bonuses that built up through the year, puts the champion's shield decals on the driver
 * and the car, records the champions and saves the final tables. Gold borders, trophies and race
 * prizes are not here: they are given out at the end of each race.
 */
export function endSeason(db: Database): SeasonEnd {
  const season = all(db, 'SELECT id, year, status FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  if (season.status === 'complete') throw new Error('This season has already ended.');
  const seasonId = season.id as number;
  const year = season.year as number;
  const rounds = all(db, 'SELECT number, status FROM round WHERE season_id = ? ORDER BY number', [
    seasonId,
  ]);
  const open = rounds.find((r) => r.status !== 'complete');
  if (rounds.length === 0 || open) {
    throw new Error(`Round ${open ? String(open.number) : '1'} is not complete yet.`);
  }

  const tables = computeStandings(db, seasonId);
  const champion = tables.drivers[0];
  if (!champion) throw new Error('No results have been recorded this season.');
  const championDriverId = champion.id as number;
  const garageRow = all(
    db,
    'SELECT garage_id FROM entry WHERE season_id = ? AND driver_id = ? AND series = ? LIMIT 1',
    [seasonId, championDriverId, 'main'],
  )[0];
  const championDriverGarageId = garageRow!.garage_id as number;
  const championGarageId = tables.garages[0]!.id as number;
  const date = `${year}-11-11`;
  const lastRound = rounds.length;

  db.exec('BEGIN');
  try {
    const pay = (garageId: number, category: string, amount: number, note: string) => {
      db.run(
        'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
        [garageId, date, category, amount, note],
      );
      db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [amount, garageId]);
    };
    const prize = seasonBalance.championPrize;
    // The champion's prize and the bonuses are the driver's earnings, split with the garage by contract.
    const championSplit = splitPrize(db, championDriverGarageId, championDriverId, year, prize);
    pay(
      championDriverGarageId,
      'championship_prize',
      championSplit.garage,
      `${year} Drivers' Championship`,
    );

    // The Garage Championship has its own prize, which belongs to the winning garage in full.
    pay(
      championGarageId,
      'championship_prize',
      seasonBalance.garageChampionPrize,
      `${year} Garage Championship`,
    );

    let bonusesPaid = 0;
    for (const b of all(
      db,
      `SELECT sb.garage_id, e.driver_id, SUM(sb.amount) AS total FROM season_bonus sb
         JOIN entry e ON e.id = sb.entry_id
        WHERE sb.season_id = ? AND sb.paid = 0 GROUP BY sb.garage_id, e.driver_id`,
      [seasonId],
    )) {
      const split = splitPrize(
        db,
        b.garage_id as number,
        b.driver_id as number,
        year,
        b.total as number,
      );
      pay(b.garage_id as number, 'bonuses', split.garage, `${year} pole and overtake bonuses`);
      bonusesPaid += b.total as number;
    }
    db.run('UPDATE season_bonus SET paid = 1 WHERE season_id = ? AND paid = 0', [seasonId]);

    // Garages earn merchandise income from their fans.
    for (const g of all(
      db,
      `SELECT g.id, g.fans FROM garage g WHERE g.kind = 'racing' AND g.fans > 0
          AND EXISTS (SELECT 1 FROM entry e WHERE e.garage_id = g.id AND e.season_id = ?) ORDER BY g.id`,
      [seasonId],
    )) {
      pay(
        g.id as number,
        'merchandise',
        Math.round(
          (g.fans as number) *
            fanBalance.merchandisePerFan *
            (1 + garageBonuses(db, g.id as number).merchandise),
        ),
        `${year} merchandise`,
      );
    }

    // The champion's shield decal goes on the driver and on the car they drove that season.
    const championCar = all(
      db,
      "SELECT car_id FROM entry WHERE season_id = ? AND driver_id = ? AND series = 'main' LIMIT 1",
      [seasonId, championDriverId],
    )[0]!.car_id as number;
    for (const [ownerType, ownerId] of [
      ['driver', championDriverId],
      ['car', championCar],
    ] as const) {
      db.run(
        "INSERT INTO trophy (owner_type, owner_id, kind, series, season_id, earned_on) VALUES (?, ?, 'title', 'main', ?, ?)",
        [ownerType, ownerId, seasonId, date],
      );
    }

    const snapshot = db.prepare(
      'INSERT INTO standing_snapshot (season_id, table_kind, subject, after_round, points, wins, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const kinds: [string, Standing[]][] = [
      ['driver', tables.drivers],
      ['garage', tables.garages],
      ['manufacturer', tables.manufacturers],
      ['driver_nation', tables.driverNations],
      ['garage_nation', tables.garageNations],
    ];
    for (const [kind, list] of kinds) {
      for (const s of list)
        snapshot.run([seasonId, kind, String(s.id), lastRound, s.points, s.wins, s.rank]);
    }
    snapshot.free();

    db.run(
      "UPDATE season SET status = 'complete', champion_driver_id = ?, champion_driver_garage_id = ?, champion_garage_id = ? WHERE id = ?",
      [championDriverId, championDriverGarageId, championGarageId, seasonId],
    );
    const awards = awardSeason(db, seasonId, year, tables);
    refreshPlayerPrestige(db);
    // The financial year closes with the season: keep every garage's summary for good.
    closeLedgerYear(db, year);
    recordValuations(db, date);
    // The board reviews the player's season against its target.
    const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
    if (player)
      reviewBoard(
        db,
        player.id as number,
        year,
        tables.garages.find((g) => g.id === (player.id as number))?.rank ?? null,
      );
    db.exec('COMMIT');
    return {
      year,
      championDriverId,
      championGarageId,
      championDriverGarageId,
      championPoints: champion.points,
      prizePaid: prize,
      bonusesPaid,
      awards,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

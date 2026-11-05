// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { ageOn } from '../sim/junior';
import { trainingLevel } from '../sim/progression';
import { seasonBalance } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all } from './entries';

/** The number of training levels, from 0 (none) up. */
export const TRAINING_LEVELS = seasonBalance.training.levels.length;

export interface TrainedDriver {
  driverId: number;
  name: string;
  age: number;
  training: number;
}

/** The drivers a garage has entered this season, with their training level. */
export function trainedDrivers(db: Database, garageId: number): TrainedDriver[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return all(
    db,
    `SELECT DISTINCT d.id, d.name, d.birth_date, d.training FROM entry e JOIN driver d ON d.id = e.driver_id
      WHERE e.garage_id = ? AND e.series = 'main' AND e.season_id = (SELECT MAX(id) FROM season)
      ORDER BY d.id`,
    [garageId],
  ).map((d) => ({
    driverId: d.id as number,
    name: d.name as string,
    age: ageOn(d.birth_date as string, career.gameDate),
    training: d.training as number,
  }));
}

/** Sets the training a garage gives one of its entered drivers. It is paid for at the season end. */
export function setTraining(db: Database, garageId: number, driverId: number, level: number): void {
  if (!Number.isInteger(level) || level < 0 || level >= TRAINING_LEVELS)
    throw new Error(`Training is a whole level from 0 to ${TRAINING_LEVELS - 1}.`);
  if (!trainedDrivers(db, garageId).some((d) => d.driverId === driverId))
    throw new Error('The garage has not entered this driver this season.');
  db.run('UPDATE driver SET training = ? WHERE id = ?', [level, driverId]);
}

/**
 * Closes the season's training. Computer garages first pick a level from their prestige and cash,
 * then every garage pays for the training it gave its drivers; a garage that cannot pay gives
 * none. Drivers who raced for a garage that closed, or for none, are not trained. Returns the
 * level each driver actually had, and the total spent.
 */
export function settleTraining(
  db: Database,
  lastSeasonId: number,
  year: number,
  closedGarages: ReadonlySet<number>,
): { levels: Map<number, number>; spent: number } {
  const levels = new Map<number, number>();
  const cfg = seasonBalance.training;
  let spent = 0;
  for (const e of all(
    db,
    `SELECT e.garage_id, e.driver_id, d.training, g.is_player, g.prestige
       FROM entry e JOIN driver d ON d.id = e.driver_id JOIN garage g ON g.id = e.garage_id
      WHERE e.season_id = ? AND e.series = 'main' ORDER BY e.id`,
    [lastSeasonId],
  )) {
    const garageId = e.garage_id as number;
    const driverId = e.driver_id as number;
    let level = e.training as number;
    if (closedGarages.has(garageId)) level = 0;
    else {
      const cash = () =>
        Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [garageId])[0]!.cash);
      if (e.is_player === 0) {
        level = Math.min(
          TRAINING_LEVELS - 1,
          Math.floor((e.prestige as number) / cfg.aiPrestigePerLevel),
        );
        while (level > 0 && cash() < trainingLevel(level).cost * cfg.aiCashMultiple) level -= 1;
      }
      const cost = trainingLevel(level).cost;
      if (cost > 0 && cash() < cost) level = 0;
      else if (cost > 0) {
        db.run(
          "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, 'training', ?, ?)",
          [garageId, `${year - 1}-12-31`, -cost, `Training, driver ${driverId}`],
        );
        db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [cost, garageId]);
        spent += cost;
      }
    }
    db.run('UPDATE driver SET training = ? WHERE id = ?', [level, driverId]);
    levels.set(driverId, level);
  }
  return { levels, spent };
}

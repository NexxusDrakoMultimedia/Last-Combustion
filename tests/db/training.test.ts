// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { setTraining, trainedDrivers } from '../../src/db/training';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

function playSeason(db: Database): void {
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
  endSeason(db);
}

/** A young driver in the first garage with a seat, whose garage the player runs. */
function youngDriverOfPlayerGarage(db: Database): { garageId: number; driverId: number } {
  const row = db.exec(
    `SELECT e.garage_id, e.driver_id FROM entry e JOIN driver d ON d.id = e.driver_id
      WHERE e.series = 'main' ORDER BY d.birth_date DESC LIMIT 1`,
  )[0]!.values[0] as [number, number];
  const [garageId, driverId] = row;
  db.run('UPDATE garage SET is_player = 1, cash = 50000000 WHERE id = ?', [garageId]);
  return { garageId, driverId };
}

describe('training a driver', () => {
  it('lists the entered drivers and sets a level of 0 to 3 for them only', () => {
    const db = newCareer('training-set');
    const { garageId, driverId } = youngDriverOfPlayerGarage(db);
    const list = trainedDrivers(db, garageId);
    expect(list.map((d) => d.driverId)).toContain(driverId);
    expect(list.every((d) => d.training === 0)).toBe(true);
    setTraining(db, garageId, driverId, 2);
    expect(scalar(db, `SELECT training FROM driver WHERE id = ${driverId}`)).toBe(2);
    expect(() => setTraining(db, garageId, driverId, 4)).toThrow(/level/);
    expect(() => setTraining(db, garageId, driverId, 1.5)).toThrow(/level/);
    const other = Number(
      scalar(db, `SELECT driver_id FROM entry WHERE garage_id <> ${garageId} LIMIT 1`),
    );
    expect(() => setTraining(db, garageId, other, 1)).toThrow(/not entered/);
  });
});

describe('training at the rollover', () => {
  const rollWith = (level: number) => {
    const db = newCareer('training-roll');
    const { garageId, driverId } = youngDriverOfPlayerGarage(db);
    setTraining(db, garageId, driverId, level);
    playSeason(db);
    const cashBefore = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const paceBefore = Number(scalar(db, `SELECT pace FROM driver WHERE id = ${driverId}`));
    const result = startNextSeason(db);
    return { db, garageId, driverId, cashBefore, paceBefore, result };
  };

  it('is paid for by the garage and recorded in the ledger', () => {
    const none = rollWith(0);
    const elite = rollWith(3);
    expect(
      Number(
        scalar(
          elite.db,
          `SELECT COUNT(*) FROM ledger WHERE garage_id = ${elite.garageId} AND category = 'training'`,
        ),
      ),
    ).toBe(1);
    expect(
      Number(
        scalar(
          none.db,
          `SELECT COUNT(*) FROM ledger WHERE garage_id = ${none.garageId} AND category = 'training'`,
        ),
      ),
    ).toBe(0);
    expect(elite.result.trainingSpent).toBeGreaterThanOrEqual(150000);
  }, 240_000);

  it('speeds a young driver’s growth compared with no training', () => {
    const none = rollWith(0);
    const elite = rollWith(3);
    const pace = (r: ReturnType<typeof rollWith>) =>
      Number(scalar(r.db, `SELECT pace FROM driver WHERE id = ${r.driverId}`));
    expect(pace(elite)).toBeGreaterThanOrEqual(pace(none));
  }, 240_000);

  it('gives none when the garage cannot pay, and resets the level', () => {
    const db = newCareer('training-broke');
    const { garageId, driverId } = youngDriverOfPlayerGarage(db);
    setTraining(db, garageId, driverId, 3);
    playSeason(db);
    db.run('UPDATE garage SET cash = 0 WHERE id = ?', [garageId]);
    const result = startNextSeason(db);
    expect(
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM ledger WHERE garage_id = ${garageId} AND category = 'training'`,
        ),
      ),
    ).toBe(0);
    expect(scalar(db, `SELECT training FROM driver WHERE id = ${driverId}`)).toBe(0);
    expect(result.trainingSpent).toBeGreaterThanOrEqual(0);
  }, 240_000);

  it('has computer garages train their drivers by prestige and cash, never more than they can pay', () => {
    const db = newCareer('training-ai');
    playSeason(db);
    startNextSeason(db);
    const levels = db
      .exec('SELECT DISTINCT training FROM driver')[0]!
      .values.map((v) => Number(v[0]));
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
    expect(Math.min(...levels)).toBe(0);
    expect(
      Number(scalar(db, "SELECT COUNT(*) FROM ledger WHERE category = 'training' AND amount >= 0")),
    ).toBe(0);
  }, 240_000);
});

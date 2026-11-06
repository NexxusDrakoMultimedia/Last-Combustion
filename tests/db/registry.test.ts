// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import {
  badgesFor,
  carProfile,
  decalsOf,
  driverProfile,
  garageProfile,
  registryIndex,
  roundProfile,
} from '../../src/db/registry';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

function playSeason(db: Database): void {
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
}

describe('the registry over two seasons', () => {
  let db: Database;
  let championId: number;
  let championCarId: number;
  let championGarageId: number;
  beforeAll(() => {
    db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'ledger-db',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('ledger-db'));
    playSeason(db);
    const end = endSeason(db);
    championId = end.championDriverId;
    championGarageId = end.championGarageId;
    championCarId = Number(
      db.exec(
        `SELECT car_id FROM entry WHERE driver_id = ${championId} AND series = 'main' AND season_id = 1`,
      )[0]!.values[0]![0],
    );
    startNextSeason(db);
    playSeason(db);
  }, 240_000);

  it('puts a black box on last season’s champion and a gold border on everyone who reached a final', () => {
    const in2031 = badgesFor(db, 2031);
    const in2032 = badgesFor(db, 2032);
    expect([...in2031.values()].some((b) => b.blackBox)).toBe(false);
    expect(in2032.get(championId)!.blackBox).toBe(true);
    expect([...in2032.values()].filter((b) => b.blackBox)).toHaveLength(1);
    expect(in2032.get(championId)!.gold).toBe(true);
    const finalists = Number(
      db.exec(
        "SELECT COUNT(DISTINCT e.driver_id) FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos IS NOT NULL AND e.series = 'main'",
      )[0]!.values[0]![0],
    );
    expect([...in2032.values()].filter((b) => b.gold).length).toBeGreaterThanOrEqual(finalists);
    expect([...in2032.values()].some((b) => b.silver)).toBe(false);
  });

  it('gives a driver a profile with their record, seasons, number, garage, car and shield', () => {
    const p = driverProfile(db, championId);
    expect(p.career.championships).toBe(1);
    expect(p.career.points).toBeGreaterThan(0);
    expect(p.seasons.map((s) => s.year)).toEqual([2031, 2032]);
    expect(p.seasons[0]!.rank).toBe(1);
    expect(p.seasons[0]!.garage.id).toBe(championGarageId);
    expect(p.seasons[0]!.car.id).toBe(championCarId);
    expect(p.seasons[0]!.car.plate).not.toBe('');
    expect(p.seasons[0]!.badge.blackBox).toBe(false);
    expect(p.seasons[1]!.badge.blackBox).toBe(true);
    expect(p.badge.gold).toBe(true);
    expect(p.decals.filter((d) => d.kind === 'shield')).toHaveLength(1);
    expect(p.decals.filter((d) => d.kind === 'trophy')).toHaveLength(p.career.wins);
    expect(p.contracts.length).toBeGreaterThan(0);
    expect(() => driverProfile(db, 999_999)).toThrow(/no driver/);
  });

  it('gives a car a profile with its owners, parts, drivers and decals', () => {
    const p = carProfile(db, championCarId);
    expect(p.plate).not.toBe('');
    expect(p.plateState).toMatch(/^[A-Z]{2,3}$/);
    expect(p.model).not.toBe('');
    expect(p.seasons[0]!.driver.id).toBe(championId);
    expect(p.seasons[0]!.number).toBeGreaterThan(0);
    expect(p.decals.filter((d) => d.kind === 'shield')).toHaveLength(1);
    expect(p.decals).toEqual(decalsOf(db, 'car', championCarId));
    expect(p.garage).not.toBeNull();
    expect(() => carProfile(db, 999_999)).toThrow(/no car/);
  });

  it('gives a garage a profile with its entries, cars, seasons and titles', () => {
    const p = garageProfile(db, championGarageId);
    expect(p.championships).toEqual([2031]);
    expect(p.seasons[0]!.rank).toBe(1);
    expect(p.entries.length).toBeGreaterThan(0);
    expect(p.entries[0]!.car.plate).not.toBe('');
    expect(p.cars.length).toBeGreaterThan(0);
    expect(p.drivers.some((d) => d.id === championId)).toBe(true);
    expect(p.cash).toBeNull();
    expect(() => garageProfile(db, 999_999)).toThrow(/no garage/);
  });

  it('shows a player garage’s cash but hides everyone else’s', () => {
    const id = Number(
      db.exec("SELECT id FROM garage WHERE kind = 'racing' LIMIT 1")[0]!.values[0]![0],
    );
    db.run('UPDATE garage SET is_player = 1 WHERE id = ?', [id]);
    expect(garageProfile(db, id).cash).not.toBeNull();
    db.run('UPDATE garage SET is_player = 0 WHERE id = ?', [id]);
  });

  it('gives a round a prelim profile and a race profile with the conditions and every car', () => {
    const prelim = roundProfile(db, 'prelim', 2031, 1);
    const race = roundProfile(db, 'race', 2031, 1);
    expect(prelim.course).toBe(race.course);
    expect(prelim.days.length).toBeGreaterThan(2);
    expect(prelim.rows.length).toBeGreaterThan(300);
    expect(race.rows.length).toBeGreaterThan(10);
    expect(race.winner).not.toBeNull();
    expect(race.rows[0]!.driverId).toBe(race.winner!.id);
    expect(prelim.pole).not.toBeNull();
    expect(race.rows.every((r) => r.carId > 0 && r.garageId > 0)).toBe(true);
    expect(roundProfile(db, 'race', 2032, 1).rows[0]!.badge).toBeDefined();
  });

  it('indexes everything to browse and search', () => {
    const index = registryIndex(db);
    expect(index.drivers.length).toBeGreaterThan(313);
    expect(index.cars.length).toBeGreaterThan(300);
    expect(index.garages.length).toBeGreaterThan(50);
    expect(index.rounds).toHaveLength(12);
    expect(index.rounds[0]).toMatchObject({ year: 2032, round: 1 });
    expect(index.drivers.find((d) => d.id === championId)!.badge.gold).toBe(true);
  });
});

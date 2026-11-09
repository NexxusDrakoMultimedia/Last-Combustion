// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import {
  buildFacility,
  facilityViews,
  garageFacilities,
  roundFacilityCost,
} from '../../src/db/facilities';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { supplyRates } from '../../src/db/supply';
import { persistWorld } from '../../src/db/world';
import { levelCost, runningCost } from '../../src/sim/facilities';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Facility Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(cash = 10_000_000): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'facilities',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('facilities'));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  db.run('UPDATE garage SET cash = ? WHERE id = ?', [cash, garageId]);
  return { db, garageId };
}

const cash = (db: Database, garageId: number) =>
  Number(db.exec(`SELECT cash FROM garage WHERE id = ${garageId}`)[0]!.values[0]![0]);

describe('building facilities', () => {
  it('charges the garage, writes the ledger and raises the level', () => {
    const { db, garageId } = fresh();
    const before = cash(db, garageId);
    const paid = buildFacility(db, garageId, 'solar_array');
    expect(paid).toBe(levelCost('solar_array', 1));
    expect(cash(db, garageId)).toBe(before - paid);
    expect(garageFacilities(db, garageId)).toEqual({ solar_array: 1 });
    expect(
      db.exec("SELECT amount FROM ledger WHERE category = 'facilities'")[0]!.values[0]![0],
    ).toBe(-paid);
    expect(buildFacility(db, garageId, 'solar_array')).toBe(levelCost('solar_array', 2));
    expect(garageFacilities(db, garageId).solar_array).toBe(2);
  });

  it('stops at level 5, and when the garage cannot afford it', () => {
    const { db, garageId } = fresh();
    for (let i = 0; i < 5; i++) buildFacility(db, garageId, 'water_tanks');
    expect(() => buildFacility(db, garageId, 'water_tanks')).toThrow(/top level/);
    db.run('UPDATE garage SET cash = 100 WHERE id = ?', [garageId]);
    expect(() => buildFacility(db, garageId, 'parts_store')).toThrow(/afford/);
    expect(garageFacilities(db, garageId).parts_store).toBeUndefined();
  });

  it('makes the simulator wait for the data room', () => {
    const { db, garageId } = fresh();
    expect(() => buildFacility(db, garageId, 'driver_simulator')).toThrow(/needs/);
    buildFacility(db, garageId, 'data_room');
    expect(() => buildFacility(db, garageId, 'driver_simulator')).not.toThrow();
    const view = facilityViews(db, garageId).find((f) => f.kind === 'driver_simulator')!;
    expect(view.level).toBe(1);
    expect(view.needsMet).toBe(true);
  });

  it('costs a running amount each round that grows with the level', () => {
    const { db, garageId } = fresh();
    expect(roundFacilityCost(db, garageId)).toBe(0);
    buildFacility(db, garageId, 'workshop_bays');
    buildFacility(db, garageId, 'workshop_bays');
    buildFacility(db, garageId, 'data_room');
    expect(roundFacilityCost(db, garageId)).toBe(
      runningCost('workshop_bays', 2) + runningCost('data_room', 1),
    );
  });
});

describe('what facilities do', () => {
  it('cut the electricity, water and logistics bills they are meant to', () => {
    const { db, garageId } = fresh();
    const before = supplyRates(db, garageId);
    buildFacility(db, garageId, 'solar_array');
    buildFacility(db, garageId, 'water_tanks');
    buildFacility(db, garageId, 'transporter_fleet');
    const after = supplyRates(db, garageId);
    expect(after.electricity).toBeLessThan(before.electricity);
    expect(after.water).toBeLessThan(before.water);
    expect(after.logistics).toBeLessThan(before.logistics);
    expect(after.race_fuel).toBe(before.race_fuel);
  });
});

describe('paying for a round with facilities', () => {
  it('takes their running cost out of the round’s bills', () => {
    const { db, garageId } = fresh();
    buildFacility(db, garageId, 'workshop_bays');
    buildFacility(db, garageId, 'parts_store');
    playPrelims(db, 1);
    playFinal(db, 1);
    settleRound(db, 1);
    const paid = Number(
      db.exec(
        `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'facilities' AND round_id IS NOT NULL`,
      )[0]!.values[0]![0],
    );
    expect(paid).toBe(runningCost('workshop_bays', 1) + runningCost('parts_store', 1));
  });
});

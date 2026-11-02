// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { ownedCars, setEntryCar } from '../../src/db/garage';
import { buyUsedCar, openListings, refreshUsedMarket } from '../../src/db/market';
import { foundPlayerGarage, playerView, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Garage Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'garage',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('garage'));
  const garageId = foundPlayerGarage(db, setup);
  refreshUsedMarket(db);
  return { db, garageId };
}

describe('the player garage cars', () => {
  it('lists the cars owned, and a bought car sits in the garage until it is put in an entry', () => {
    const { db, garageId } = fresh();
    expect(ownedCars(db, garageId)).toHaveLength(1);
    const cheap = openListings(db).find((l) => l.price <= 250_000)!;
    buyUsedCar(db, garageId, cheap.id);
    const cars = ownedCars(db, garageId);
    expect(cars).toHaveLength(2);
    const bought = cars.find((c) => c.inEntry === null)!;
    const number = playerView(db)!.entries[0]!.raceNumber;
    setEntryCar(db, garageId, number, bought.carId);
    expect(ownedCars(db, garageId).find((c) => c.carId === bought.carId)!.inEntry).toBe(number);
    expect(ownedCars(db, garageId).filter((c) => c.inEntry === null)).toHaveLength(1);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('refuses a car from another garage, a car already racing, and changes after the season starts', () => {
    const { db, garageId } = fresh();
    const number = playerView(db)!.entries[0]!.raceNumber;
    const other = Number(
      db.exec('SELECT id FROM car WHERE garage_id <> ' + String(garageId) + ' LIMIT 1')[0]!
        .values[0]![0],
    );
    expect(() => setEntryCar(db, garageId, number, other)).toThrow(/not in this garage/);
    const cheap = openListings(db).find((l) => l.price <= 250_000)!;
    buyUsedCar(db, garageId, cheap.id);
    const bought = ownedCars(db, garageId).find((c) => c.inEntry === null)!;
    playPrelims(db, 1);
    expect(() => setEntryCar(db, garageId, number, bought.carId)).toThrow(/season has started/);
  });
});

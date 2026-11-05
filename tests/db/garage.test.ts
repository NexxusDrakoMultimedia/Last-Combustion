// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { freeAgents } from '../../src/db/freeagents';
import { ownedCars, setEntryCar, setEntryDriver } from '../../src/db/garage';
import { openDriverNegotiation, offerDriverContract } from '../../src/db/negotiation';
import { createStarterOffers } from '../../src/db/starter';
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

describe('signing and seating a driver', () => {
  it('lists free agents, signs one through negotiation and seats them before the season', () => {
    const { db, garageId } = fresh();
    createStarterOffers(db);
    const agents = freeAgents(db, garageId);
    expect(agents.length).toBeGreaterThanOrEqual(5);
    expect(agents.every((a) => !a.signed)).toBe(true);
    expect(agents.map((a) => a.rating)).toEqual(
      [...agents.map((a) => a.rating)].sort((x, y) => y - x),
    );
    const target = agents[0]!;
    const number = playerView(db)!.entries[0]!.raceNumber;
    expect(() => setEntryDriver(db, garageId, number, target.driverId)).toThrow(
      /not under contract/,
    );

    db.run('UPDATE garage SET cash = 50000000 WHERE id = ?', [garageId]);
    const n = openDriverNegotiation(db, garageId, target.driverId);
    const outcome = offerDriverContract(db, n.id, { salary: target.fairValue * 3, years: 2 });
    expect(outcome.kind).toBe('accepted');
    expect(freeAgents(db, garageId).find((a) => a.driverId === target.driverId)!.signed).toBe(true);

    setEntryDriver(db, garageId, number, target.driverId);
    expect(playerView(db)!.entries[0]!.driver).toBe(target.name);
    expect(freeAgents(db, garageId).some((a) => a.driverId === target.driverId)).toBe(false);
    expect(() => setEntryDriver(db, garageId, number, 1)).toThrow();
  });

  it('refuses a driver racing elsewhere and a change after the season has started', () => {
    const { db, garageId } = fresh();
    const number = playerView(db)!.entries[0]!.raceNumber;
    const racing = Number(
      db.exec(`SELECT driver_id FROM entry WHERE garage_id <> ${garageId} LIMIT 1`)[0]!
        .values[0]![0],
    );
    db.run(
      'INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, 2031, 2032, 1, ?, 0)',
      [racing, garageId, 'lead'],
    );
    expect(() => setEntryDriver(db, garageId, number, racing)).toThrow(/already racing/);
    playPrelims(db, 1);
    expect(() => setEntryDriver(db, garageId, number, racing)).toThrow();
  });
});

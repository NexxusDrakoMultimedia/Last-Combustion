// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { freeAgents } from '../../src/db/freeagents';
import {
  addEntry,
  garageEntries,
  ownedCars,
  removeEntry,
  setEntryCar,
  setEntryDriver,
} from '../../src/db/garage';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { openDriverNegotiation, offerDriverContract } from '../../src/db/negotiation';
import { createStarterOffers } from '../../src/db/starter';
import { buyUsedCar, openListings, refreshUsedMarket } from '../../src/db/market';
import { foundPlayerGarage, playerView, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';
import { seasonBalance } from '../../src/sim/worldgen/data';

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

describe('a second entry', () => {
  /** A garage with a spare car and a signed spare driver. */
  function withSpares() {
    const { db, garageId } = fresh();
    createStarterOffers(db);
    db.run('UPDATE garage SET cash = 50000000 WHERE id = ?', [garageId]);
    const cheap = openListings(db).find((l) => l.price <= 250_000)!;
    buyUsedCar(db, garageId, cheap.id);
    const carId = ownedCars(db, garageId).find((c) => c.inEntry === null)!.carId;
    const target = freeAgents(db, garageId)[0]!;
    const n = openDriverNegotiation(db, garageId, target.driverId);
    expect(offerDriverContract(db, n.id, { salary: target.fairValue * 3, years: 2 }).kind).toBe(
      'accepted',
    );
    return { db, garageId, carId, driverId: target.driverId };
  }

  it('adds an entry with the lowest free number from 41, never #313, and takes it away again', () => {
    const { db, garageId, carId, driverId } = withSpares();
    expect(garageEntries(db, garageId)).toHaveLength(1);
    const entry = addEntry(db, garageId, carId, driverId);
    expect(entry.raceNumber).toBeGreaterThanOrEqual(41);
    expect(entry.raceNumber).not.toBe(313);
    const taken = new Set(
      db
        .exec(`SELECT race_number FROM entry WHERE garage_id <> ${garageId}`)[0]!
        .values.map((v) => v[0]),
    );
    expect(taken.has(entry.raceNumber)).toBe(false);
    for (let n = 41; n < entry.raceNumber; n++) expect(taken.has(n) || n === 313).toBe(true);
    expect(garageEntries(db, garageId)).toHaveLength(2);
    expect(ownedCars(db, garageId).every((c) => c.inEntry !== null)).toBe(true);
    removeEntry(db, garageId, entry.raceNumber);
    expect(garageEntries(db, garageId)).toHaveLength(1);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('refuses a car or driver that is not free, an unsigned driver and a last-entry withdrawal', () => {
    const { db, garageId, carId, driverId } = withSpares();
    const first = garageEntries(db, garageId)[0]!;
    expect(() => addEntry(db, garageId, first.carId, driverId)).toThrow(/already racing/);
    expect(() => addEntry(db, garageId, carId, first.driverId)).toThrow(/already racing/);
    const stranger = Number(
      db.exec(`SELECT id FROM driver WHERE id NOT IN (SELECT driver_id FROM entry) LIMIT 1`)[0]!
        .values[0]![0],
    );
    expect(() => addEntry(db, garageId, carId, stranger)).toThrow(/not under contract/);
    const foreignCar = Number(
      db.exec(`SELECT car_id FROM entry WHERE garage_id <> ${garageId} LIMIT 1`)[0]!.values[0]![0],
    );
    expect(() => addEntry(db, garageId, foreignCar, driverId)).toThrow(/not in this garage/);
    expect(() => removeEntry(db, garageId, first.raceNumber)).toThrow(/at least one/);
    expect(() => removeEntry(db, garageId, 999)).toThrow(/no such entry/);
  });

  it('is limited by the most entries a garage may have', () => {
    const { db, garageId, carId, driverId } = withSpares();
    const cap = seasonBalance.garages.maxEntriesPerGarage;
    expect(cap).toBe(8);
    seasonBalance.garages.maxEntriesPerGarage = 1;
    try {
      expect(() => addEntry(db, garageId, carId, driverId)).toThrow(/at most 1 entries/);
    } finally {
      seasonBalance.garages.maxEntriesPerGarage = cap;
    }
  });

  it('is frozen once the season starts', () => {
    const { db, garageId, carId, driverId } = withSpares();
    const entry = addEntry(db, garageId, carId, driverId);
    playPrelims(db, 1);
    expect(() => removeEntry(db, garageId, entry.raceNumber)).toThrow(/started/);
    expect(() => addEntry(db, garageId, carId, driverId)).toThrow();
  });

  it('races both cars, charges fees for both and scores them separately', () => {
    const { db, garageId, carId, driverId } = withSpares();
    addEntry(db, garageId, carId, driverId);
    playPrelims(db, 1);
    playFinal(db, 1);
    const cashBefore = Number(
      db.exec(`SELECT cash FROM garage WHERE id = ${garageId}`)[0]!.values[0]![0],
    );
    settleRound(db, 1);
    const fees = Number(
      db.exec(
        `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'entry_fee'`,
      )[0]!.values[0]![0],
    );
    expect(fees).toBe(2 * 2200);
    expect(
      Number(db.exec(`SELECT cash FROM garage WHERE id = ${garageId}`)[0]!.values[0]![0]),
    ).toBeLessThan(cashBefore);
    expect(
      Number(
        db.exec(
          `SELECT COUNT(DISTINCT r.entry_id) FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.garage_id = ${garageId}`,
        )[0]!.values[0]![0],
      ),
    ).toBe(2);
  });
});

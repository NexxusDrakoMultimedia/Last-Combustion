// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { addEntry, garageEntries, removeEntry } from '../../src/db/garage';
import { buyUsedCar, openListings, refreshUsedMarket } from '../../src/db/market';
import { freeAgents } from '../../src/db/freeagents';
import { offerDriverContract, openDriverNegotiation } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { prestigeOf, refreshPlayerPrestige } from '../../src/db/prestige';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Prestige Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

describe('prestige', () => {
  it('starts at 1 and rises 4 for each entry after the first, 2 for each gold-bordered driver and 5 for each title', () => {
    expect(prestigeOf(1, 0, 0)).toBe(1);
    expect(prestigeOf(2, 0, 0)).toBe(5);
    expect(prestigeOf(4, 0, 0)).toBe(13);
    expect(prestigeOf(1, 1, 0)).toBe(3);
    expect(prestigeOf(1, 0, 2)).toBe(11);
    expect(prestigeOf(0, 0, 0)).toBe(1);
    expect(prestigeOf(60, 60, 60)).toBe(100);
  });

  it('follows the player garage’s entries as they are added and withdrawn', () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'prestige',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('prestige'));
    const garageId = foundPlayerGarage(db, setup);
    createStarterOffers(db);
    refreshUsedMarket(db);
    db.run('UPDATE garage SET cash = 90000000 WHERE id = ?', [garageId]);
    expect(refreshPlayerPrestige(db)).toBe(1);
    buyUsedCar(db, garageId, openListings(db).find((l) => l.price <= 250_000)!.id);
    const carId = Number(
      scalar(
        db,
        `SELECT id FROM car WHERE garage_id = ${garageId} AND id NOT IN (SELECT car_id FROM entry)`,
      ),
    );
    const agent = freeAgents(db, garageId)[0]!;
    const n = openDriverNegotiation(db, garageId, agent.driverId);
    offerDriverContract(db, n.id, { salary: agent.fairValue * 3, years: 2 });
    const entry = addEntry(db, garageId, carId, agent.driverId);
    expect(scalar(db, `SELECT prestige FROM garage WHERE id = ${garageId}`)).toBe(5);
    removeEntry(db, garageId, entry.raceNumber);
    expect(scalar(db, `SELECT prestige FROM garage WHERE id = ${garageId}`)).toBe(1);
    expect(garageEntries(db, garageId)).toHaveLength(1);
  });

  it('leaves computer garages alone, and does nothing without a player garage', () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'prestige-2',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('prestige-2'));
    const before = db.exec('SELECT id, prestige FROM garage ORDER BY id')[0]!.values.join('|');
    expect(refreshPlayerPrestige(db)).toBeUndefined();
    expect(db.exec('SELECT id, prestige FROM garage ORDER BY id')[0]!.values.join('|')).toBe(
      before,
    );
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { foundPlayerGarage, playerView, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { chooseStarter, createStarterOffers, starterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];
const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'feminine',
  birthDate: '1995-06-01',
  garageName: 'Starter Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed = 'starter'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  foundPlayerGarage(db, setup);
  createStarterOffers(db);
  return db;
}

describe('the starter choice', () => {
  it('offers three different cheap cars and five prospects, the same for a seed', () => {
    const a = starterOffers(fresh())!;
    const b = starterOffers(fresh())!;
    expect(a.cars).toHaveLength(3);
    expect(new Set(a.cars.map((c) => c.modelName)).size).toBe(3);
    expect(a.drivers).toHaveLength(5);
    expect(a.drivers.every((d) => d.age >= 18 && d.age <= 24)).toBe(true);
    expect(a.drivers.map((d) => d.name)).toEqual(b.drivers.map((d) => d.name));
    expect(a.cars.map((c) => c.modelName)).toEqual(b.cars.map((c) => c.modelName));
  });

  it('offers brand-new Starter-class cars and prospects below the field average', () => {
    let pace = 0;
    let count = 0;
    for (const seed of ['starter', 'a', 'b', 'c']) {
      const db = fresh(seed);
      const offers = starterOffers(db)!;
      for (const c of offers.cars) {
        expect(c.modelYear).toBe(2031);
        expect(c.roadKm).toBe(0);
        expect(c.wear).toBe(0);
        expect(
          scalar(
            db,
            `SELECT m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ${c.carId}`,
          ),
        ).toBe('starter');
      }
      for (const d of offers.drivers) {
        pace += d.pace;
        count += 1;
      }
    }
    // The field's mean pace is 45; the prospects are rookies drawn lower.
    expect(pace / count).toBeLessThan(40);
  });

  it('puts the chosen car and driver in the entry and sends the rest to market and free agency', () => {
    const db = fresh();
    const offers = starterOffers(db)!;
    const view0 = playerView(db)!;
    const oldDriverName = view0.entries[0]!.driver;
    const listingsBefore = Number(
      scalar(db, "SELECT COUNT(*) FROM market_listing WHERE status = 'open'"),
    );
    chooseStarter(db, offers.cars[1]!.carId, offers.drivers[2]!.driverId);
    const view = playerView(db)!;
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]!.driver).toBe(offers.drivers[2]!.name);
    expect(view.entries[0]!.driver).not.toBe(oldDriverName);
    expect(view.entries[0]!.car).toBe(offers.cars[1]!.modelName);
    expect(starterOffers(db)).toBeUndefined();
    // The old car and the two unchosen cars are now for sale.
    expect(Number(scalar(db, "SELECT COUNT(*) FROM market_listing WHERE status = 'open'"))).toBe(
      listingsBefore + 3,
    );
    expect(
      scalar(db, `SELECT COUNT(*) FROM contract WHERE driver_id = ${offers.drivers[2]!.driverId}`),
    ).toBe(1);
    expect(scalar(db, 'SELECT COUNT(*) FROM entry')).toBe(313);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    expect(() => chooseStarter(db, offers.cars[0]!.carId, offers.drivers[0]!.driverId)).toThrow(
      /already/,
    );
  });

  it('refuses a car or a driver that was not offered', () => {
    const db = fresh();
    const offers = starterOffers(db)!;
    expect(() => chooseStarter(db, 1, offers.drivers[0]!.driverId)).toThrow(/not on offer/);
    expect(() => chooseStarter(db, offers.cars[0]!.carId, 1)).toThrow(/not on offer/);
  });
});

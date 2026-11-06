// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { garageFinance, settleRound } from '../../src/db/finance';
import { playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import {
  crashRepairCost,
  gearRenewCost,
  garageGear,
  gearConditions,
  partConditions,
  partServiceCost,
  renewGear,
  wearGear,
  restoreChassis,
  restorationQuote,
  serviceParts,
  wearParts,
} from '../../src/db/repairs';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { fitPart } from '../../src/db/upgrades';
import { persistWorld } from '../../src/db/world';
import { chassisWear, wearFromKm } from '../../src/sim/wear';
import { generateWorld } from '../../src/sim/worldgen';
import type { Tier } from '../../src/sim/worldgen/types';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'repairs-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  return db;
}

const entered = (db: Database) =>
  db.exec('SELECT car_id, garage_id FROM entry ORDER BY id LIMIT 1')[0]!.values[0] as [
    number,
    number,
  ];

describe('part wear', () => {
  it('starts at zero and grows with racing kilometres, twice as fast as the chassis', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    fitPart(db, garage, carId, 'engine-sport');
    expect(partConditions(db, carId)).toEqual([
      { category: 'engine', name: 'Sport engine build', wear: 0 },
    ]);
    const tier = String(
      scalar(
        db,
        `SELECT m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ${carId}`,
      ),
    );
    wearParts(db, carId, 100, 'race', tier as never);
    const wear = partConditions(db, carId)[0]!.wear;
    expect(wear).toBeGreaterThan(0);
    wearParts(db, carId, 1_000_000, 'race', tier as never);
    expect(partConditions(db, carId)[0]!.wear).toBe(100);
  });

  it('is added by a round: the prelims and the final wear the parts of the cars that ran', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    fitPart(db, garage, carId, 'engine-sport');
    playPrelims(db, 1);
    const afterPrelims = partConditions(db, carId)[0]!.wear;
    expect(afterPrelims).toBeGreaterThan(0);
    const qualified = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.car_id = ${carId} AND r.prelim_pos <= 15`,
      ),
    );
    playFinal(db, 1);
    if (qualified > 0) expect(partConditions(db, carId)[0]!.wear).toBeGreaterThan(afterPrelims);
  });
});

describe('servicing parts', () => {
  it('resets part wear and charges a quarter of the part price in proportion to the wear', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    const fit = fitPart(db, garage, carId, 'engine-sport');
    db.run('UPDATE car_part SET wear = 40 WHERE car_id = ?', [carId]);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`));
    const cost = serviceParts(db, garage, carId);
    expect(cost).toBe(Math.round(0.25 * fit.price * 0.4));
    expect(partConditions(db, carId)[0]!.wear).toBe(0);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`))).toBe(cash - cost);
    expect(garageFinance(db, garage).byCategory.servicing).toBe(-cost);
  });

  it('costs nothing for a fresh car, and refuses when the garage cannot pay or does not own the car', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    expect(serviceParts(db, garage, carId)).toBe(0);
    fitPart(db, garage, carId, 'engine-race');
    db.run('UPDATE car_part SET wear = 100 WHERE car_id = ?', [carId]);
    db.run('UPDATE garage SET cash = 1 WHERE id = ?', [garage]);
    expect(() => serviceParts(db, garage, carId)).toThrow(/afford/);
    expect(partConditions(db, carId)[0]!.wear).toBe(100);
    expect(() => serviceParts(db, garage + 1, carId)).toThrow(/does not own/);
    expect(() => serviceParts(db, garage, 99999)).toThrow(/no car/);
  });
});

describe('fully restoring the chassis', () => {
  /** Gives a car a lot of road kilometres and the wear that goes with them. */
  function wornCar(db: Database, carId: number, roadKm: number): number {
    const tier = String(
      scalar(
        db,
        `SELECT m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ${carId}`,
      ),
    ) as Tier;
    const wear = wearFromKm(roadKm, 0, tier);
    db.run(
      'UPDATE car SET road_km = ?, race_km = 0, wear = ?, wear_offset = 0, restorations = 0 WHERE id = ?',
      [roadKm, wear, carId],
    );
    return wear;
  }
  const priceNew = (db: Database, carId: number) =>
    Number(
      scalar(
        db,
        `SELECT m.price_new FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ${carId}`,
      ),
    );

  it('costs as much as a new car and takes most of the wear away, but not all', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    const wear = wornCar(db, carId, 150_000);
    expect(wear).toBeGreaterThan(30);
    const done = restoreChassis(db, garage, carId);
    expect(done.cost).toBe(priceNew(db, carId));
    expect(done.wearBefore).toBeCloseTo(wear, 1);
    // 5 points of floor, and a tenth of the wear above it.
    const expected = 5 + 0.1 * (wear - 5);
    expect(Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`))).toBeCloseTo(expected, 1);
    expect(Number(scalar(db, `SELECT restorations FROM car WHERE id = ${carId}`))).toBe(1);
    expect(garageFinance(db, garage).byCategory.restoration).toBe(-done.cost);
  });

  it('keeps the car’s history: its kilometres, owners and decals stay', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    wornCar(db, carId, 120_000);
    db.run(
      "INSERT INTO trophy (owner_type, owner_id, kind, series, season_id, earned_on) VALUES ('car', ?, 'title', 'main', 1, '2031-11-11')",
      [carId],
    );
    const owners = scalar(db, `SELECT COUNT(*) FROM car_ownership WHERE car_id = ${carId}`);
    restoreChassis(db, garage, carId);
    expect(scalar(db, `SELECT road_km FROM car WHERE id = ${carId}`)).toBe(120_000);
    expect(
      scalar(db, `SELECT COUNT(*) FROM trophy WHERE owner_type = 'car' AND owner_id = ${carId}`),
    ).toBe(1);
    expect(scalar(db, `SELECT COUNT(*) FROM car_ownership WHERE car_id = ${carId}`)).toBe(owners);
  });

  it('costs a quarter more each time and leaves a higher minimum wear each time', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    const base = priceNew(db, carId);
    wornCar(db, carId, 400_000);
    const costs: number[] = [];
    const floors: number[] = [];
    for (let n = 1; n <= 4; n++) {
      // Run the car right down again between restorations.
      db.run('UPDATE car SET road_km = road_km + 400000 WHERE id = ?', [carId]);
      db.run('UPDATE car SET wear = 95 WHERE id = ?', [carId]);
      const quote = restorationQuote(db, carId);
      costs.push(restoreChassis(db, garage, carId).cost);
      expect(quote.cost).toBe(costs[n - 1]);
      floors.push(Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`)));
    }
    expect(costs).toEqual([1, 1.25, 1.5, 1.75].map((m) => Math.round(base * m)));
    for (let n = 1; n < floors.length; n++) expect(floors[n]!).toBeGreaterThan(floors[n - 1]!);
    expect(floors[3]!).toBeGreaterThanOrEqual(20);
  });

  it('can never wear less than the floor, however little the car has done', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    wornCar(db, carId, 150_000);
    restoreChassis(db, garage, carId);
    // A car with hardly any kilometres but a restoration behind it still has the floor.
    db.run('UPDATE car SET road_km = 0, race_km = 0, wear_offset = 0 WHERE id = ?', [carId]);
    playPrelims(db, 1);
    expect(Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`))).toBeGreaterThanOrEqual(
      5,
    );
    expect(chassisWear(0, 0, 'mid', 0, 3)).toBe(15);
    expect(chassisWear(0, 0, 'mid', 0, 99)).toBe(60);
  });

  it('is not undone by the next round: wear carries on from where the restoration left it', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    const worn = wornCar(db, carId, 150_000);
    restoreChassis(db, garage, carId);
    const restored = Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`));
    playPrelims(db, 1);
    const after = Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`));
    // Racing adds wear to the restored chassis; it does not bring the old wear back.
    expect(after).toBeGreaterThan(restored);
    expect(after).toBeLessThan(worn / 2);
  });

  it('is refused for a chassis with too little wear to gain, or when the garage cannot pay', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    db.run('UPDATE car SET wear = 3 WHERE id = ?', [carId]);
    expect(restorationQuote(db, carId).worthwhile).toBe(false);
    expect(() => restoreChassis(db, garage, carId)).toThrow(/not worn enough/);
    wornCar(db, carId, 150_000);
    db.run('UPDATE garage SET cash = 10 WHERE id = ?', [garage]);
    expect(() => restoreChassis(db, garage, carId)).toThrow(/cannot afford/);
  });
});

describe('crash repairs', () => {
  it('charges 3% of the new price for each crash when the round is settled', () => {
    const db = newCareer();
    playPrelims(db, 1);
    const row = db.exec(
      `SELECT e.garage_id, m.price_new, r.id FROM result r JOIN entry e ON e.id = r.entry_id
        JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id ORDER BY r.id LIMIT 1`,
    )[0]!.values[0] as [number, number, number];
    db.run("UPDATE result SET dnf_reason = 'crash' WHERE id = ?", [row[2]]);
    const crashes = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.garage_id = ${row[0]} AND r.dnf_reason = 'crash'`,
      ),
    );
    expect(crashes).toBeGreaterThanOrEqual(1);
    const total = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    const result = settleRound(db, 1);
    expect(garageFinance(db, row[0]).byCategory.repairs).toBeLessThanOrEqual(
      -crashRepairCost(row[1]),
    );
    expect(total - Number(scalar(db, 'SELECT SUM(cash) FROM garage'))).toBe(result.total);
  });

  it('survives a save and load with part wear and the chassis offset', async () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    fitPart(db, garage, carId, 'engine-sport');
    db.run('UPDATE car_part SET wear = 33 WHERE car_id = ?', [carId]);
    db.run('UPDATE car SET road_km = 150000, wear = 60 WHERE id = ?', [carId]);
    restoreChassis(db, garage, carId);
    const offset = scalar(db, `SELECT wear_offset FROM car WHERE id = ${carId}`);
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'repairs'));
    expect(partConditions(loaded, carId)[0]!.wear).toBe(33);
    expect(scalar(loaded, `SELECT wear_offset FROM car WHERE id = ${carId}`)).toBe(offset);
    expect(scalar(loaded, `SELECT restorations FROM car WHERE id = ${carId}`)).toBe(1);
  });
});

describe('gear wear', () => {
  const driverOf = (db: Database) =>
    db.exec('SELECT driver_id, garage_id FROM entry ORDER BY id LIMIT 1')[0]!.values[0] as [
      number,
      number,
    ];

  it('starts new, grows with racing kilometres and is slower for better tiers', () => {
    const db = newCareer('gear-wear');
    const [driverId] = driverOf(db);
    const before = gearConditions(db, driverId);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((g) => g.wear === 0)).toBe(true);
    wearGear(db, driverId, 1000);
    const after = gearConditions(db, driverId);
    for (const g of after) expect(g.wear).toBeGreaterThan(0);
    const rate = (tier: string) => after.find((g) => g.tier === tier)?.wear;
    if (rate('basic') !== undefined && rate('club') !== undefined)
      expect(rate('basic')!).toBeGreaterThan(rate('club')!);
    wearGear(db, driverId, 1_000_000);
    expect(gearConditions(db, driverId).every((g) => g.wear === 100)).toBe(true);
  });

  it('wears the gear of every driver who races a round', () => {
    const db = newCareer('gear-race');
    playPrelims(db, 1);
    expect(Number(scalar(db, 'SELECT COUNT(*) FROM driver_gear WHERE wear > 0'))).toBeGreaterThan(
      100,
    );
    const afterPrelims = Number(scalar(db, 'SELECT SUM(wear) FROM driver_gear'));
    playFinal(db, 1);
    expect(Number(scalar(db, 'SELECT SUM(wear) FROM driver_gear'))).toBeGreaterThan(afterPrelims);
  }, 120_000);

  it('is refurbished by the garage that employs the driver, for half the price in proportion to wear', () => {
    const db = newCareer('gear-renew');
    const [driverId, garageId] = driverOf(db);
    wearGear(db, driverId, 2000);
    const worn = gearConditions(db, driverId).find((g) => g.renewCost !== null && g.wear > 0)!;
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const cost = renewGear(db, garageId, driverId, worn.itemId);
    expect(cost).toBe(worn.renewCost);
    expect(cost).toBeGreaterThan(0);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`))).toBe(cash - cost);
    expect(gearConditions(db, driverId).find((g) => g.itemId === worn.itemId)!.wear).toBe(0);
    expect(
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM ledger WHERE garage_id = ${garageId} AND category = 'gear'`,
        ),
      ),
    ).toBe(1);
  });

  it('cannot be bought for a driver the garage does not employ, or for earned items', () => {
    const db = newCareer('gear-renew-2');
    const [driverId, garageId] = driverOf(db);
    const other = Number(scalar(db, `SELECT id FROM garage WHERE id <> ${garageId} LIMIT 1`));
    const item = gearConditions(db, driverId)[0]!;
    expect(() => renewGear(db, other, driverId, item.itemId)).toThrow(/does not employ/);
    expect(() => renewGear(db, garageId, driverId, 'trinket-border-coin')).toThrow(
      /cannot be refurbished/,
    );
    expect(garageGear(db, garageId).length).toBeGreaterThan(0);
  });
});

describe('part wear changes performance and the service bill', () => {
  it('shows in the service cost and drops to nothing once serviced', () => {
    const db = newCareer('part-service');
    const [carId, garage] = entered(db);
    fitPart(db, garage, carId, 'engine-sport');
    expect(partServiceCost(db, garage, carId)).toBe(0);
    wearParts(db, carId, 5000, 'race', 'mid');
    expect(partServiceCost(db, garage, carId)).toBeGreaterThan(0);
    serviceParts(db, garage, carId);
    expect(partServiceCost(db, garage, carId)).toBe(0);
  });

  it('makes a worn engine part give less power in the race entry', async () => {
    const { loadEntries } = await import('../../src/db/entries');
    const db = newCareer('part-power');
    const [carId, garage] = entered(db);
    fitPart(db, garage, carId, 'engine-sport');
    const seasonId = Number(scalar(db, 'SELECT id FROM season'));
    const psOf = () => loadEntries(db, seasonId).find((e) => e.carId === carId)!.car.ps;
    const fresh = psOf();
    db.run('UPDATE car_part SET wear = 100 WHERE car_id = ?', [carId]);
    expect(psOf()).toBeLessThan(fresh);
  });
});

describe('refurbishing gear with a Sporting Director', () => {
  it('costs a fifth less at full skill, and the same with none', () => {
    expect(gearRenewCost(10_000, 50)).toBe(2500);
    expect(gearRenewCost(10_000, 50, 0.2)).toBe(2000);
    expect(gearRenewCost(10_000, 0, 0.2)).toBe(0);
  });
});

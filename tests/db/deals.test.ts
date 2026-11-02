// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { activeDiscount, offerDeal, openDealNegotiation } from '../../src/db/deals';
import { buyNewCar, modelsOnSale } from '../../src/db/market';
import { relationshipScore } from '../../src/db/negotiation';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { fitPart } from '../../src/db/upgrades';
import { persistWorld } from '../../src/db/world';
import { partPrice, part } from '../../src/sim/upgrades';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'deals-db'): Database {
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

describe('negotiating a supplier discount', () => {
  it('starts with three counters and a fair discount, and rejects an unknown supplier', () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const n = openDealNegotiation(db, 'supplier', garage, 'stahlwerk-dynamik');
    expect(n.patience).toBe(3);
    expect(n.fairValue).toBeGreaterThanOrEqual(0.05);
    expect(n.fairValue).toBeLessThanOrEqual(0.15);
    expect(() => openDealNegotiation(db, 'supplier', garage, 'nope')).toThrow(/Unknown supplier/);
    expect(() => openDealNegotiation(db, 'supplier', garage, 'stahlwerk-dynamik')).toThrow(
      /already/,
    );
  });

  it('accepts a small ask, and the discount takes money off parts from that supplier only', () => {
    const db = newCareer();
    const [carId, garage] = entered(db);
    const tier = String(
      scalar(
        db,
        `SELECT m.tier FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ${carId}`,
      ),
    );
    const n = openDealNegotiation(db, 'supplier', garage, 'stahlwerk-dynamik');
    const result = offerDeal(db, n.id, { discount: 0.03, years: 2 });
    expect(result.kind).toBe('accepted');
    const supplierId = Number(
      scalar(db, "SELECT id FROM part_supplier WHERE stable_id = 'stahlwerk-dynamik'"),
    );
    expect(activeDiscount(db, 'supplier', garage, supplierId, 2031)).toBe(0.03);
    expect(activeDiscount(db, 'supplier', garage, supplierId, 2033)).toBe(0);
    // A suspension part (Stahlwerk Dynamik) is cheaper; an engine part (Outback Racing Parts) is not.
    const cheap = fitPart(db, garage, carId, 'suspension-sport');
    const normal = fitPart(db, garage, carId, 'engine-sport');
    expect(cheap.price).toBe(Math.round(partPrice(part('suspension-sport'), tier as never) * 0.97));
    expect(normal.price).toBe(partPrice(part('engine-sport'), tier as never));
    expect(
      relationshipScore(db, { type: 'garage', id: garage }, { type: 'supplier', id: supplierId }),
    ).toBe(5);
  });

  it('counters a greedy ask with a smaller discount and accepts the counter', () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const n = openDealNegotiation(db, 'supplier', garage, 'kobato-works');
    const walkAway = Number(scalar(db, `SELECT walk_away FROM negotiation WHERE id = ${n.id}`));
    const ask = Math.round(walkAway * 1.1 * 10000) / 10000;
    const first = offerDeal(db, n.id, { discount: ask, years: 1 });
    expect(first.kind).toBe('countered');
    if (first.kind !== 'countered') return;
    expect(first.counter.discount).toBeLessThan(ask);
    expect(offerDeal(db, n.id, first.counter).kind).toBe('accepted');
  });

  it('walks away from an absurd ask and will not negotiate again that year', () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const n = openDealNegotiation(db, 'supplier', garage, 'gridline');
    expect(offerDeal(db, n.id, { discount: 0.95, years: 1 }).kind).toBe('walked');
    expect(() => openDealNegotiation(db, 'supplier', garage, 'gridline')).toThrow(/walked away/);
  });
});

describe('negotiating a manufacturer discount', () => {
  it('gives a discount on new cars from that manufacturer, unless a price is given', () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const model = modelsOnSale(db).find((m) => m.priceNew < 200_000)!;
    const maker = String(
      scalar(
        db,
        `SELECT f.stable_id FROM car_model m JOIN manufacturer f ON f.id = m.manufacturer_id WHERE m.id = ${model.id}`,
      ),
    );
    const n = openDealNegotiation(db, 'manufacturer', garage, maker);
    expect(offerDeal(db, n.id, { discount: 0.03, years: 1 }).kind).toBe('accepted');
    const withDeal = buyNewCar(db, garage, model.id);
    expect(withDeal.price).toBe(Math.round(model.priceNew * 0.97));
    expect(buyNewCar(db, garage, model.id, 0).price).toBe(model.priceNew);
    expect(buyNewCar(db, garage, model.id, 0.2).price).toBe(Math.round(model.priceNew * 0.8));
  });
});

describe('terms and saves', () => {
  it('rejects silly terms and an unknown negotiation', () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const n = openDealNegotiation(db, 'supplier', garage, 'pista-corsa');
    expect(() => offerDeal(db, n.id, { discount: 0.05, years: 0 })).toThrow(/1 to 3/);
    expect(() => offerDeal(db, n.id, { discount: 0.05, years: 4 })).toThrow(/1 to 3/);
    expect(() => offerDeal(db, n.id, { discount: 1.5, years: 1 })).toThrow(/1 to 3/);
    expect(() => offerDeal(db, n.id, { discount: -0.1, years: 1 })).toThrow(/1 to 3/);
    expect(() => offerDeal(db, 999, { discount: 0.05, years: 1 })).toThrow(/no negotiation/);
  });

  it('survives a save and load, and does not mix up the two kinds of deal', async () => {
    const db = newCareer();
    const [, garage] = entered(db);
    const n = openDealNegotiation(db, 'supplier', garage, 'pista-corsa');
    offerDeal(db, n.id, { discount: 0.03, years: 1 });
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'deals'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM supplier_deal')).toBe(1);
    expect(scalar(loaded, 'SELECT COUNT(*) FROM manufacturer_deal')).toBe(0);
    expect(scalar(loaded, "SELECT COUNT(*) FROM negotiation WHERE kind = 'supplier_deal'")).toBe(1);
  });
});

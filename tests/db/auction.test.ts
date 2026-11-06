// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import {
  auctionCycle,
  closeAuction,
  consignCar,
  currentAuction,
  ensureAuction,
  openAuction,
  openLots,
  placeBid,
} from '../../src/db/auction';
import { registerCar } from '../../src/db/plates';
import { createCareer } from '../../src/db/career';
import { garageFinance } from '../../src/db/finance';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'auction-db'): Database {
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

function spareCar(db: Database): { carId: number; garageId: number } {
  const row = db.exec(
    `INSERT INTO car (car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm)
     SELECT car_model_id, 'LC-SPARE-1', flag, 0, garage_id, 2029, 30000, 0, 12, kerb_kg_current, tyre_width_mm FROM car WHERE id = 1;
     SELECT id, garage_id FROM car WHERE chassis_no = 'LC-SPARE-1'`,
  );
  const [carId, garageId] = row[0]!.values[0] as [number, number];
  return { carId, garageId };
}

describe('opening an auction', () => {
  it('lists eight lots with reserves, closing a week later, the same ones for the same seed', () => {
    const a = newCareer('same');
    const b = newCareer('same');
    const first = openAuction(a);
    openAuction(b);
    expect(first.lots).toBe(8);
    expect(first.closesOn > first.opensOn).toBe(true);
    const key = (db: Database) =>
      JSON.stringify(openLots(db, 1).map((l) => [l.modelName, l.reserve]));
    expect(key(a)).toBe(key(b));
    expect(openLots(a, 1)).toHaveLength(8);
    for (const lot of openLots(a, 1)) {
      expect(lot.reserve).toBeGreaterThan(0);
      expect(lot.openingPrice).toBeLessThanOrEqual(lot.reserve);
    }
    const other = newCareer('other');
    openAuction(other);
    expect(key(other)).not.toBe(key(a));
  });

  it('closes a festival auction on the day', () => {
    const db = newCareer();
    const festival = openAuction(db, 'festival', 3);
    expect(festival.closesOn).toBe(festival.opensOn);
    expect(festival.lots).toBe(3);
  });
});

describe('bidding', () => {
  it('rejects a bid under the opening price, on a lot the garage sells, or beyond its cash', () => {
    const db = newCareer();
    openAuction(db);
    const lot = openLots(db, 1)[0]!;
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 1');
    expect(() => placeBid(db, 1, lot.id, lot.openingPrice - 1)).toThrow(/opening price/);
    db.run('UPDATE garage SET cash = 100 WHERE id = 1');
    expect(() => placeBid(db, 1, lot.id, lot.openingPrice)).toThrow(/afford/);
    expect(() => placeBid(db, 1, 9999, 1000)).toThrow(/not open/);
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 1');
    placeBid(db, 1, lot.id, lot.reserve * 2);
    expect(() => placeBid(db, 1, lot.id, lot.reserve * 2)).toThrow(/minimum increment/);
    placeBid(db, 1, lot.id, lot.reserve * 3);
    expect(openLots(db, 1)[0]!.highestBid).toBe(lot.reserve * 3);
  });
});

describe('closing an auction', () => {
  it('sells a lot to a garage that bids well over the reserve, and moves the car and the money', () => {
    const db = newCareer();
    openAuction(db);
    const lot = openLots(db, 1)[0]!;
    db.run('UPDATE garage SET cash = 100000000 WHERE id = 1');
    placeBid(db, 1, lot.id, lot.reserve * 4);
    const result = closeAuction(db, 1);
    expect(result.sold).toBeGreaterThan(0);
    expect(scalar(db, `SELECT status FROM auction_lot WHERE id = ${lot.id}`)).toBe('sold');
    const price = Number(scalar(db, `SELECT final_price FROM auction_lot WHERE id = ${lot.id}`));
    expect(price).toBeGreaterThanOrEqual(lot.reserve);
    expect(scalar(db, `SELECT garage_id FROM car WHERE id = ${lot.carId}`)).toBe(
      scalar(db, `SELECT buyer_garage_id FROM auction_lot WHERE id = ${lot.id}`),
    );
    expect(
      scalar(db, `SELECT route FROM car_ownership WHERE car_id = ${lot.carId} AND to_date IS NULL`),
    ).toBe('auction');
    expect(scalar(db, 'SELECT status FROM auction WHERE id = 1')).toBe('closed');
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('keeps the books: buyers pay price plus 10%, sellers get price less 5%, the house keeps the rest', () => {
    const db = newCareer();
    openAuction(db);
    const total = Number(scalar(db, 'SELECT SUM(cash) FROM garage'));
    const result = closeAuction(db, 1);
    expect(result.sold + result.unsold).toBe(8);
    expect(total - Number(scalar(db, 'SELECT SUM(cash) FROM garage'))).toBe(result.fees);
    if (result.sold > 0) expect(result.fees).toBeCloseTo(result.turnover * 0.15, -1);
  });

  it('lets a garage consign its own car, and pays it the price less the seller fee', () => {
    const db = newCareer();
    const auction = openAuction(db);
    const { carId, garageId } = spareCar(db);
    const lotId = consignCar(db, garageId, carId, auction.id, 1000);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    db.run('UPDATE garage SET cash = 100000000 WHERE id = ?', [garageId + 1]);
    placeBid(db, garageId + 1, lotId, 5_000_000);
    closeAuction(db, auction.id);
    expect(scalar(db, `SELECT status FROM auction_lot WHERE id = ${lotId}`)).toBe('sold');
    const price = Number(scalar(db, `SELECT final_price FROM auction_lot WHERE id = ${lotId}`));
    expect(garageFinance(db, garageId).byCategory.car_sale).toBe(Math.round(price * 0.95));
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`))).toBe(
      cash + Math.round(price * 0.95),
    );
  });

  it('lets a garage consign a second car, and refuses the same car twice', () => {
    const db = newCareer();
    const auction = openAuction(db);
    const { carId, garageId } = spareCar(db);
    const other = db.exec(
      `SELECT id FROM car WHERE garage_id = ${garageId} AND id != ${carId} AND id NOT IN (SELECT car_id FROM entry) LIMIT 1`,
    )[0]?.values[0]?.[0];
    consignCar(db, garageId, carId, auction.id, 1000);
    expect(() => consignCar(db, garageId, carId, auction.id, 1000)).toThrow(/already a lot/);
    if (other !== undefined) {
      consignCar(db, garageId, Number(other), auction.id, 2000);
      expect(
        scalar(db, `SELECT COUNT(*) FROM auction_lot WHERE seller_garage_id = ${garageId}`),
      ).toBe(2);
    }
  });

  it('refuses to consign a car with an entry or not owned, and cannot close twice', () => {
    const db = newCareer();
    const auction = openAuction(db);
    const entered = db.exec('SELECT car_id, garage_id FROM entry LIMIT 1')[0]!.values[0] as [
      number,
      number,
    ];
    expect(() => consignCar(db, entered[1], entered[0], auction.id, 1000)).toThrow(
      /entry this season/,
    );
    expect(() => consignCar(db, entered[1] + 1, entered[0], auction.id, 1000)).toThrow(
      /does not own/,
    );
    closeAuction(db, auction.id);
    expect(() => closeAuction(db, auction.id)).toThrow(/already closed/);
    expect(() => closeAuction(db, 99)).toThrow(/no auction/);
  });

  it('is repeatable for the same seed, and survives a save and load', async () => {
    const a = newCareer('repeat');
    const b = newCareer('repeat');
    openAuction(a);
    openAuction(b);
    expect(JSON.stringify(closeAuction(a, 1))).toBe(JSON.stringify(closeAuction(b, 1)));
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(a, 'auction'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM auction_lot')).toBe(8);
  });
});

describe('the auction as a garage sees it', () => {
  it('shows each lot with its plate, the garage’s own bid and whether it consigned the lot', () => {
    const db = newCareer('auction-view');
    const { carId, garageId } = spareCar(db);
    registerCar(db, carId);
    db.run('UPDATE garage SET cash = 5000000 WHERE id = ?', [garageId]);
    const auction = openAuction(db);
    expect(currentAuction(db, garageId)?.id).toBe(auction.id);
    const mine = consignCar(db, garageId, carId, auction.id, 20_000);
    const lot = openLots(db, auction.id).find((l) => l.id !== mine)!;
    placeBid(db, garageId, lot.id, lot.openingPrice + 1000);
    const view = currentAuction(db, garageId)!;
    expect(view.lotViews).toHaveLength(9);
    const own = view.lotViews.find((l) => l.id === mine)!;
    expect(own.mine).toBe(true);
    expect(own.myBid).toBeNull();
    expect(own.sellerGarageId).toBe(garageId);
    expect(own.plate).toMatch(/\S/);
    const bid = view.lotViews.find((l) => l.id === lot.id)!;
    expect(bid.myBid).toBe(lot.openingPrice + 1000);
    expect(bid.mine).toBe(false);
    expect(bid.sellerGarageId).toBeNull();
    // Another garage sees none of this garage's bids.
    const other = Number(
      scalar(db, `SELECT id FROM garage WHERE id <> ${garageId} AND kind = 'racing' LIMIT 1`),
    );
    expect(currentAuction(db, other)!.lotViews.every((l) => l.myBid === null)).toBe(true);
  });

  it('has no view when no auction is open, and opens one once with ensureAuction', () => {
    const db = newCareer('auction-ensure');
    expect(currentAuction(db, 1)).toBeUndefined();
    expect(ensureAuction(db)).toBeDefined();
    expect(ensureAuction(db)).toBeUndefined();
    expect(scalar(db, "SELECT COUNT(*) FROM auction WHERE status = 'open'")).toBe(1);
  });
});

describe('the auction house between rounds', () => {
  it('closes the open auction and opens a new one with different cars', () => {
    const db = newCareer('auction-cycle');
    ensureAuction(db);
    const first = openLots(db, 1)
      .map((l) => l.modelName + l.reserve)
      .join('|');
    const closing = auctionCycle(db, null)!;
    expect(closing.auctionId).toBe(1);
    expect(closing.result.sold + closing.result.unsold).toBe(8);
    expect(scalar(db, 'SELECT status FROM auction WHERE id = 1')).toBe('closed');
    expect(scalar(db, "SELECT COUNT(*) FROM auction WHERE status = 'open'")).toBe(1);
    const second = openLots(db, 2)
      .map((l) => l.modelName + l.reserve)
      .join('|');
    expect(second).not.toBe(first);
    // The first cycle with nothing open just opens one.
    const fresh = newCareer('auction-cycle-2');
    expect(auctionCycle(fresh, null)).toBeUndefined();
    expect(scalar(fresh, "SELECT COUNT(*) FROM auction WHERE status = 'open'")).toBe(1);
  });

  it('tells the garage what it won, sold, left unsold and was outbid on', () => {
    const db = newCareer('auction-outcomes');
    const { carId, garageId } = spareCar(db);
    registerCar(db, carId);
    db.run('UPDATE garage SET cash = 90000000 WHERE id = ?', [garageId]);
    ensureAuction(db);
    const lots = openLots(db, 1);
    // A sky-high bid wins; a bid at the opening price on another lot is beaten by the field or the reserve.
    placeBid(db, garageId, lots[0]!.id, lots[0]!.reserve * 5);
    placeBid(db, garageId, lots[1]!.id, lots[1]!.openingPrice);
    consignCar(db, garageId, carId, 1, 10_000_000_000);
    const closing = auctionCycle(db, garageId)!;
    const outcomes = closing.lots.map((l) => l.outcome);
    expect(outcomes).toContain('won');
    expect(outcomes).toContain('unsold');
    const won = closing.lots.find((l) => l.outcome === 'won')!;
    expect(won.price).toBeGreaterThan(0);
    expect(won.price).toBeLessThanOrEqual(lots[0]!.reserve * 5);
    for (const l of closing.lots) expect(['won', 'sold', 'unsold', 'lost']).toContain(l.outcome);
    expect(closing.lots.some((l) => l.outcome === 'lost') || outcomes.length >= 2).toBe(true);
  });

  it('is the same for the same seed', () => {
    const run = () => {
      const db = newCareer('auction-same');
      ensureAuction(db);
      auctionCycle(db, null);
      return JSON.stringify([
        openLots(db, 2).map((l) => [l.modelName, l.reserve]),
        scalar(db, 'SELECT SUM(final_price) FROM auction_lot'),
      ]);
    };
    expect(run()).toBe(run());
  });
});

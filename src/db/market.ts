// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { equalizerMm } from '../sim/equalizer';
import type { Layout } from '../sim/worldgen/types';
import type { Database } from 'sql.js';
import { carValue, dealerBuybackPrice, listingPrice, newCarPrice } from '../sim/economy';
import { createRng } from '../sim/rng';
import { wearFromKm } from '../sim/wear';
import { balance, economyBalance } from '../sim/worldgen/data';
import type { Tier } from '../sim/worldgen/types';
import { readCareer } from './career';
import { activeDiscount } from './deals';
import { all } from './entries';
import { registerCar } from './plates';

export interface Purchase {
  carId: number;
  chassisNo: string;
  plate: string;
  modelName: string;
  price: number;
}

const yearOf = (db: Database): number => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return Number(career.gameDate.slice(0, 4));
};

/** Whether a model is on sale new in a given year. One-off cars (tier `unique`) never are. */
export function isOnSale(
  model: { tier: string; introduced_year: number; retired_year: number | null },
  year: number,
): boolean {
  if (model.tier === 'unique') return false;
  return (
    model.introduced_year <= year && (model.retired_year === null || model.retired_year > year)
  );
}

/** The models a dealer can sell new now, cheapest first. */
export function modelsOnSale(
  db: Database,
): { id: number; name: string; tier: string; priceNew: number }[] {
  const year = yearOf(db);
  return all(
    db,
    'SELECT id, name, tier, price_new, introduced_year, retired_year FROM car_model ORDER BY price_new, id',
  )
    .filter((m) => isOnSale(m as never, year))
    .map((m) => ({
      id: m.id as number,
      name: m.name as string,
      tier: m.tier as string,
      priceNew: m.price_new as number,
    }));
}

export interface DealerOffer {
  modelId: number;
  name: string;
  maker: string;
  tier: string;
  /** The list price. */
  listPrice: number;
  /** What this garage pays after any manufacturer deal. */
  price: number;
}

/** The new cars a dealer sells now, with the price this garage pays after its manufacturer deals, cheapest first. */
export function dealerOffers(db: Database, garageId: number): DealerOffer[] {
  const year = yearOf(db);
  return all(
    db,
    `SELECT m.id, m.name, m.tier, m.price_new, m.manufacturer_id, m.introduced_year, m.retired_year, f.name AS maker
       FROM car_model m JOIN manufacturer f ON f.id = m.manufacturer_id ORDER BY m.price_new, m.id`,
  )
    .filter((m) => isOnSale(m as never, year))
    .map((m) => ({
      modelId: m.id as number,
      name: m.name as string,
      maker: m.maker as string,
      tier: m.tier as string,
      listPrice: m.price_new as number,
      price: newCarPrice(
        m.price_new as number,
        activeDiscount(db, 'manufacturer', garageId, m.manufacturer_id as number, year),
      ),
    }));
}

/** What a dealer would pay for a car now (a share of its value). */
export function dealerQuote(db: Database, carId: number): number {
  return dealerBuybackPrice(valueOfCar(db, carId));
}

/**
 * Buys a new car from a dealer: a new chassis with no kilometres, owned by the garage,
 * paid for from its cash. `discount` (0 to 1) is what negotiation won off the list price.
 */
export function buyNewCar(
  db: Database,
  garageId: number,
  modelId: number,
  discount?: number,
): Purchase {
  const year = yearOf(db);
  const date = readCareer(db)!.gameDate;
  const garage = all(db, 'SELECT id, cash FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const model = all(
    db,
    `SELECT m.id, m.name, m.tier, m.manufacturer_id, m.base_kerb_kg, m.max_tyre_mm, m.layout, m.price_new, m.introduced_year, m.retired_year,
            f.home_country
       FROM car_model m JOIN manufacturer f ON f.id = m.manufacturer_id WHERE m.id = ?`,
    [modelId],
  )[0];
  if (!model) throw new Error(`There is no car model ${modelId}.`);
  if (!isOnSale(model as never, year))
    throw new Error(`${model.name as string} is not on sale new.`);
  // An explicit discount (even 0) wins; otherwise the garage's deal with the manufacturer applies.
  const price = newCarPrice(
    model.price_new as number,
    discount ?? activeDiscount(db, 'manufacturer', garageId, model.manufacturer_id as number, year),
  );
  if ((garage.cash as number) < price) throw new Error('The garage cannot afford this car.');

  db.exec('BEGIN');
  try {
    const next = Number(all(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS n FROM car')[0]!.n);
    const prefix = String(model.name).split(' ')[0]!.slice(0, 3).toUpperCase();
    const chassisNo = `LC-${prefix}-${String(next).padStart(5, '0')}`;
    db.run(
      `INSERT INTO car (id, car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm)
       VALUES (?, ?, ?, ?, 0, ?, ?, 0, 0, 0, ?, ?)`,
      [
        next,
        modelId,
        chassisNo,
        model.home_country as string,
        garageId,
        year,
        model.base_kerb_kg as number,
        equalizerMm(model.base_kerb_kg as number, model.layout as Layout),
      ],
    );
    const plate = registerCar(db, next);
    db.run(
      "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, ?, 'new')",
      [next, garageId, date, price],
    );
    db.run(
      'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
      [garageId, date, 'car_purchase', -price, `${model.name as string} ${plate}`],
    );
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, garageId]);
    db.exec('COMMIT');
    return { carId: next, chassisNo, plate, modelName: model.name as string, price };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The current value of a chassis: base x wear factor x provenance factor. */
export function valueOfCar(db: Database, carId: number): number {
  const year = yearOf(db);
  const car = all(
    db,
    `SELECT c.model_year, c.wear, c.fans, m.price_new
       FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ?`,
    [carId],
  )[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  const wins = Number(
    all(
      db,
      `SELECT COUNT(*) AS n FROM result r JOIN entry e ON e.id = r.entry_id
        WHERE e.car_id = ? AND r.final_pos = 1`,
      [carId],
    )[0]!.n,
  );
  return carValue({
    priceNew: car.price_new as number,
    modelYear: car.model_year as number,
    currentYear: year,
    wear: car.wear as number,
    wins,
    championships: 0,
    fans: car.fans as number,
  });
}

const MARKET_NAME = 'Used car market';

const dateOf = (db: Database): string => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return career.gameDate;
};

/** The hidden garage that owns cars while they are for sale, created the first time it is needed. */
export function ensureMarketGarage(db: Database): number {
  const found = all(db, "SELECT id FROM garage WHERE kind = 'market' LIMIT 1")[0];
  if (found) return found.id as number;
  const place = all(db, 'SELECT id FROM place ORDER BY id LIMIT 1')[0];
  if (!place) throw new Error('There are no places to base the market on.');
  const next = Number(all(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS n FROM garage')[0]!.n);
  db.run(
    `INSERT INTO garage (id, name, flag, base_place_id, home_state, primary_colour, secondary_colour,
                         prestige, cash, founded_year, is_player, ai_profile, fans, kind)
     VALUES (?, ?, 'AU', ?, 'NSW', '#888888', '#444444', 1, 0, ?, 0, 'cautious', 0, 'market')`,
    [next, MARKET_NAME, place.id as number, yearOf(db)],
  );
  return next;
}

export interface Listing {
  id: number;
  carId: number;
  plate: string;
  plateState: string;
  modelName: string;
  tier: string;
  modelYear: number;
  roadKm: number;
  wear: number;
  price: number;
}

/** The cars for sale, cheapest first. */
export function openListings(db: Database): Listing[] {
  return all(
    db,
    `SELECT l.id, l.car_id, l.price, c.plate, c.plate_state, c.model_year, c.road_km, c.wear, m.name, m.tier
       FROM market_listing l
       JOIN car c ON c.id = l.car_id
       JOIN car_model m ON m.id = c.car_model_id
      WHERE l.status = 'open' ORDER BY l.price, l.id`,
  ).map((r) => ({
    id: r.id as number,
    carId: r.car_id as number,
    plate: r.plate as string,
    plateState: r.plate_state as string,
    modelName: r.name as string,
    tier: r.tier as string,
    modelYear: r.model_year as number,
    roadKm: r.road_km as number,
    wear: r.wear as number,
    price: r.price as number,
  }));
}

export function transferCar(
  db: Database,
  carId: number,
  toGarageId: number,
  date: string,
  price: number,
): void {
  db.run('UPDATE car_ownership SET to_date = ? WHERE car_id = ? AND to_date IS NULL', [
    date,
    carId,
  ]);
  db.run('UPDATE car SET garage_id = ? WHERE id = ?', [toGarageId, carId]);
  db.run(
    "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, ?, 'used')",
    [carId, toGarageId, date, price],
  );
}

function ledgerAndCash(
  db: Database,
  garageId: number,
  date: string,
  category: string,
  amount: number,
  note: string,
): void {
  db.run(
    'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
    [garageId, date, category, amount, note],
  );
  db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [amount, garageId]);
}

export interface Sale {
  price: number;
  listingId: number;
}

/**
 * Sells a car to a dealer for a share of its value. The dealer lists it on the used market at
 * a higher price. A car that has an entry this season cannot be sold.
 */
export function sellToDealer(db: Database, garageId: number, carId: number): Sale {
  const date = dateOf(db);
  const car = all(db, 'SELECT id, garage_id FROM car WHERE id = ?', [carId])[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  const garage = all(db, 'SELECT kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const entered = all(
    db,
    'SELECT 1 AS n FROM entry WHERE car_id = ? AND season_id = (SELECT MAX(id) FROM season) LIMIT 1',
    [carId],
  );
  if (entered.length > 0) throw new Error('This car has an entry this season and cannot be sold.');

  const value = valueOfCar(db, carId);
  const price = dealerBuybackPrice(value);
  const market = ensureMarketGarage(db);
  db.exec('BEGIN');
  try {
    transferCar(db, carId, market, date, price);
    db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [price, market]);
    ledgerAndCash(db, garageId, date, 'car_sale', price, `Car ${carId}`);
    db.run(
      "INSERT INTO market_listing (car_id, price, listed_date, status) VALUES (?, ?, ?, 'open')",
      [carId, listingPrice(value), date],
    );
    const listingId = Number(all(db, 'SELECT MAX(id) AS n FROM market_listing')[0]!.n);
    db.exec('COMMIT');
    return { price, listingId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Buys a used car from the market at its listed price. */
export function buyUsedCar(db: Database, garageId: number, listingId: number): Purchase {
  const date = dateOf(db);
  const listing = all(
    db,
    "SELECT id, car_id, price FROM market_listing WHERE id = ? AND status = 'open'",
    [listingId],
  )[0];
  if (!listing) throw new Error(`Listing ${listingId} is not open.`);
  const garage = all(db, 'SELECT cash, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const price = listing.price as number;
  if ((garage.cash as number) < price) throw new Error('The garage cannot afford this car.');
  const carId = listing.car_id as number;
  const market = ensureMarketGarage(db);
  const info = all(
    db,
    'SELECT c.chassis_no, c.plate, m.name FROM car c JOIN car_model m ON m.id = c.car_model_id WHERE c.id = ?',
    [carId],
  )[0]!;

  db.exec('BEGIN');
  try {
    transferCar(db, carId, garageId, date, price);
    db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [price, market]);
    ledgerAndCash(
      db,
      garageId,
      date,
      'car_purchase',
      -price,
      `${info.name as string} ${info.plate as string}`,
    );
    db.run("UPDATE market_listing SET status = 'sold', sold_date = ? WHERE id = ?", [
      date,
      listingId,
    ]);
    db.exec('COMMIT');
    return {
      carId,
      chassisNo: info.chassis_no as string,
      plate: info.plate as string,
      modelName: info.name as string,
      price,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Makes one ordinary used car (from the stream) owned by a garage, and returns its id and value. */
export function createUsedCar(
  db: Database,
  rng: ReturnType<ReturnType<typeof createRng>['stream']>,
  ownerGarageId: number,
  date: string,
  only?: { tier: Tier; excludeModelIds: readonly number[] },
): { carId: number; value: number } {
  const year = Number(date.slice(0, 4));
  const models = all(
    db,
    `SELECT m.id, m.name, m.tier, m.base_kerb_kg, m.max_tyre_mm, m.layout, m.price_new, f.home_country
       FROM car_model m JOIN manufacturer f ON f.id = m.manufacturer_id
      WHERE m.tier <> 'unique' ORDER BY m.id`,
  );
  const weights = economyBalance.market.tierWeights as Record<string, number>;
  const cars = worldCars();
  const pool = only
    ? models.filter((m) => m.tier === only.tier && !only.excludeModelIds.includes(m.id as number))
    : models;
  const model = rng.weighted(
    pool,
    pool.map((m) => (only ? 1 : (weights[m.tier as string] ?? 0))),
  );
  const tier = model.tier as keyof typeof cars.maxAgeYears;
  const age = rng.int(1, cars.maxAgeYears[tier]);
  const roadKm =
    Math.round(
      (age * rng.float(cars.roadKmPerYear[0]!, cars.roadKmPerYear[1]!) * cars.usageFactor[tier] +
        rng.int(50, 500)) /
        10,
    ) * 10;
  const wear = wearFromKm(roadKm, 0, model.tier as Tier);
  const id = Number(all(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS n FROM car')[0]!.n);
  const prefix = String(model.name).split(' ')[0]!.slice(0, 3).toUpperCase();
  const chassisNo = `LC-${prefix}-${String(id).padStart(5, '0')}`;
  db.run(
    `INSERT INTO car (id, car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      model.id as number,
      chassisNo,
      model.home_country as string,
      ownerGarageId,
      year - age,
      roadKm,
      wear,
      model.base_kerb_kg as number,
      equalizerMm(model.base_kerb_kg as number, model.layout as Layout),
    ],
  );
  registerCar(db, id);
  db.run(
    "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, 0, 'used')",
    [id, ownerGarageId, date],
  );
  return { carId: id, value: valueOfCar(db, id) };
}

/**
 * Tops the used market up to its usual number of listings with ordinary used cars from private
 * sellers. The cars come from the career's seed and the date, so the same day gives the same cars.
 */
export function refreshUsedMarket(db: Database): number {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const date = career.gameDate;
  const want = economyBalance.market.listings;
  const have = Number(
    all(db, "SELECT COUNT(*) AS n FROM market_listing WHERE status = 'open'")[0]!.n,
  );
  if (have >= want) return 0;

  const rng = createRng(career.masterSeed).stream(`market:${date}`);
  const market = ensureMarketGarage(db);
  let added = 0;
  db.exec('BEGIN');
  try {
    for (let i = have; i < want; i++) {
      const { carId, value } = createUsedCar(db, rng, market, date);
      db.run(
        "INSERT INTO market_listing (car_id, price, listed_date, status) VALUES (?, ?, ?, 'open')",
        [carId, listingPrice(value), date],
      );
      added += 1;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return added;
}

/** Car-age and usage settings shared with world generation, so market cars look like the rest. */
function worldCars() {
  return balance.cars;
}

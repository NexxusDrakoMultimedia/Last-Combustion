// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  aiMaxBid,
  buyerPays,
  minIncrement,
  openingPrice,
  resolveLot,
  sellerReceives,
  type Bidder,
} from '../sim/auction';
import { createRng } from '../sim/rng';
import { economyBalance } from '../sim/worldgen/data';
import { garageBonuses } from './bonuses';
import { readCareer } from './career';
import { all } from './entries';
import { createUsedCar, ensureMarketGarage, valueOfCar } from './market';

const cfg = () => economyBalance.auction;

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface AuctionSummary {
  id: number;
  kind: 'weekly' | 'festival';
  opensOn: string;
  closesOn: string;
  lots: number;
}

/**
 * Opens an auction with ordinary used cars from private sellers as lots. A weekly auction
 * closes a week after it opens, a festival auction on the day. The cars and reserves come from
 * the career's seed and the date.
 */
export function openAuction(
  db: Database,
  kind: 'weekly' | 'festival' = 'weekly',
  lots: number = cfg().weeklyLots,
): AuctionSummary {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const opensOn = career.gameDate;
  const closesOn = kind === 'weekly' ? addDays(opensOn, cfg().weekDays) : opensOn;
  // The date alone is not enough to tell auctions apart (the game date moves only a few times a
  // season), so the number of auctions held so far is part of the stream's name.
  const held = Number(all(db, 'SELECT COUNT(*) AS n FROM auction')[0]!.n);
  const rng = createRng(career.masterSeed).stream(`auction:${kind}:${opensOn}:${held}`);
  const market = ensureMarketGarage(db);
  db.exec('BEGIN');
  try {
    db.run('INSERT INTO auction (kind, opens_on, closes_on) VALUES (?, ?, ?)', [
      kind,
      opensOn,
      closesOn,
    ]);
    const id = Number(all(db, 'SELECT MAX(id) AS n FROM auction')[0]!.n);
    for (let i = 0; i < lots; i++) {
      const { carId, value } = createUsedCar(db, rng, market, opensOn);
      const [lo, hi] = cfg().reserveShare as [number, number];
      db.run(
        'INSERT INTO auction_lot (auction_id, car_id, seller_garage_id, reserve) VALUES (?, ?, ?, ?)',
        [id, carId, market, Math.round(value * rng.float(lo, hi))],
      );
    }
    db.exec('COMMIT');
    return { id, kind, opensOn, closesOn, lots };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export interface Lot {
  id: number;
  carId: number;
  roadKm: number;
  wear: number;
  /** The garage that put the car up, or null for a private seller. */
  sellerGarageId: number | null;
  plate: string;
  plateState: string;
  modelName: string;
  modelYear: number;
  reserve: number;
  openingPrice: number;
  /** The player's highest maximum bid so far, if any. */
  highestBid: number | null;
}

/** The lots of an auction that is still open. */
export function openLots(db: Database, auctionId: number): Lot[] {
  const market = ensureMarketGarage(db);
  return all(
    db,
    `SELECT l.id, l.car_id, l.reserve, l.seller_garage_id, c.plate, c.plate_state, c.model_year, c.road_km, c.wear, m.name,
            (SELECT MAX(amount) FROM auction_bid b WHERE b.lot_id = l.id) AS top
       FROM auction_lot l
       JOIN auction a ON a.id = l.auction_id AND a.status = 'open'
       JOIN car c ON c.id = l.car_id
       JOIN car_model m ON m.id = c.car_model_id
      WHERE l.auction_id = ? ORDER BY l.id`,
    [auctionId],
  ).map((r) => ({
    id: r.id as number,
    carId: r.car_id as number,
    roadKm: r.road_km as number,
    wear: Math.round((r.wear as number) * 10) / 10,
    sellerGarageId: r.seller_garage_id === market ? null : (r.seller_garage_id as number),
    plate: r.plate as string,
    plateState: r.plate_state as string,
    modelName: r.name as string,
    modelYear: r.model_year as number,
    reserve: r.reserve as number,
    openingPrice: openingPrice(r.reserve as number),
    highestBid: r.top === null ? null : (r.top as number),
  }));
}

/** Consigns a car of a racing garage as a lot. A car with an entry this season cannot be sold. */
export function consignCar(
  db: Database,
  garageId: number,
  carId: number,
  auctionId: number,
  reserve: number,
): number {
  const car = all(db, 'SELECT garage_id FROM car WHERE id = ?', [carId])[0];
  if (!car) throw new Error(`There is no car ${carId}.`);
  if (car.garage_id !== garageId) throw new Error('The garage does not own this car.');
  const garage = all(db, 'SELECT kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const auction = all(db, "SELECT id FROM auction WHERE id = ? AND status = 'open'", [
    auctionId,
  ])[0];
  if (!auction) throw new Error(`Auction ${auctionId} is not open.`);
  if (
    all(
      db,
      'SELECT 1 AS n FROM entry WHERE car_id = ? AND season_id = (SELECT MAX(id) FROM season) LIMIT 1',
      [carId],
    ).length > 0
  ) {
    throw new Error('This car has an entry this season and cannot be sold.');
  }
  if (reserve < 0) throw new Error('The reserve cannot be negative.');
  if (
    all(db, 'SELECT 1 AS n FROM auction_lot WHERE auction_id = ? AND car_id = ?', [
      auctionId,
      carId,
    ]).length > 0
  ) {
    throw new Error('This car is already a lot in this auction.');
  }
  db.run(
    'INSERT INTO auction_lot (auction_id, car_id, seller_garage_id, reserve) VALUES (?, ?, ?, ?)',
    [auctionId, carId, garageId, Math.round(reserve)],
  );
  return Number(all(db, 'SELECT MAX(id) AS n FROM auction_lot')[0]!.n);
}

/**
 * Places a bid. The amount is the most the garage will pay for the car (a proxy bid, so the
 * auction raises the garage's bid for it, one increment at a time, only as far as needed).
 */
export function placeBid(db: Database, garageId: number, lotId: number, amount: number): void {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const lot = all(
    db,
    `SELECT l.id, l.reserve, l.seller_garage_id, a.status
       FROM auction_lot l JOIN auction a ON a.id = l.auction_id WHERE l.id = ?`,
    [lotId],
  )[0];
  if (!lot || lot.status !== 'open') throw new Error(`Lot ${lotId} is not open.`);
  const garage = all(db, 'SELECT cash, kind FROM garage WHERE id = ?', [garageId])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  if (lot.seller_garage_id === garageId) throw new Error('A garage cannot bid on its own lot.');
  if (amount < openingPrice(lot.reserve as number)) {
    throw new Error(
      `The bid is under the opening price of ${openingPrice(lot.reserve as number)}.`,
    );
  }
  const mine = all(
    db,
    'SELECT MAX(amount) AS top FROM auction_bid WHERE lot_id = ? AND bidder_garage_id = ?',
    [lotId, garageId],
  )[0]!.top as number | null;
  if (mine !== null && amount < mine + minIncrement(mine)) {
    throw new Error('A new bid must beat your last bid by the minimum increment.');
  }
  if ((garage.cash as number) < buyerPays(amount, garageBonuses(db, garageId).auctionPremium)) {
    throw new Error('The garage cannot afford this bid with the buyer premium.');
  }
  db.run(
    'INSERT INTO auction_bid (lot_id, bidder_garage_id, amount, placed_on) VALUES (?, ?, ?, ?)',
    [lotId, garageId, Math.round(amount), career.gameDate],
  );
}

export interface AuctionResult {
  sold: number;
  unsold: number;
  /** The total hammer price of the lots that sold. */
  turnover: number;
  /** The fees kept by the auction house (buyer premium and seller fee). */
  fees: number;
}

/**
 * Closes an auction: every lot goes to its best bidder if the reserve is met. Computer garages
 * bid too: each takes an interest in a lot at random and will pay 0.8 to 1.2 times its value.
 */
export function closeAuction(db: Database, auctionId: number): AuctionResult {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const auction = all(
    db,
    'SELECT id, kind, opens_on, closes_on, status FROM auction WHERE id = ?',
    [auctionId],
  )[0];
  if (!auction) throw new Error(`There is no auction ${auctionId}.`);
  if (auction.status !== 'open') throw new Error(`Auction ${auctionId} is already closed.`);
  const date = career.gameDate;
  const lots = all(
    db,
    'SELECT id, car_id, seller_garage_id, reserve FROM auction_lot WHERE auction_id = ? ORDER BY id',
    [auctionId],
  );
  const rng = createRng(career.masterSeed).stream(`auction:close:${auctionId}`);
  const aiGarages = all(
    db,
    "SELECT id, cash FROM garage WHERE kind = 'racing' AND is_player = 0 AND closed_year IS NULL ORDER BY id",
  );
  const market = ensureMarketGarage(db);
  const [lowFactor, highFactor] = cfg().aiFactor as [number, number];
  const result: AuctionResult = { sold: 0, unsold: 0, turnover: 0, fees: 0 };

  db.exec('BEGIN');
  try {
    for (const lot of lots) {
      const carId = lot.car_id as number;
      const seller = lot.seller_garage_id as number;
      const value = valueOfCar(db, carId);
      const bidders: Bidder[] = all(
        db,
        'SELECT bidder_garage_id AS garage_id, MAX(amount) AS top, MIN(id) AS first FROM auction_bid WHERE lot_id = ? GROUP BY bidder_garage_id ORDER BY first',
        [lot.id as number],
      ).map((b) => ({ garageId: b.garage_id as number, max: b.top as number }));
      for (const ai of aiGarages) {
        // Draw for every garage so the stream does not depend on who can afford what.
        const interested = rng.chance(cfg().aiInterest);
        const factor = rng.float(lowFactor, highFactor);
        if (interested && ai.id !== seller && !bidders.some((b) => b.garageId === ai.id)) {
          bidders.push({ garageId: ai.id as number, max: aiMaxBid(value, factor) });
        }
      }
      // Only bidders who can still pay the price plus the premium count.
      const cash = new Map(
        all(db, "SELECT id, cash FROM garage WHERE kind = 'racing' AND closed_year IS NULL").map(
          (g) => [g.id as number, g.cash as number],
        ),
      );
      const premiumCut = new Map<number, number>();
      const cutOf = (garageId: number): number => {
        if (!premiumCut.has(garageId))
          premiumCut.set(garageId, garageBonuses(db, garageId).auctionPremium);
        return premiumCut.get(garageId)!;
      };
      const able = bidders.filter(
        (b) => (cash.get(b.garageId) ?? 0) >= buyerPays(b.max, cutOf(b.garageId)),
      );
      const outcome = resolveLot(able, lot.reserve as number);
      if (!outcome.winner) {
        db.run("UPDATE auction_lot SET status = 'unsold' WHERE id = ?", [lot.id as number]);
        result.unsold += 1;
        continue;
      }
      const buyer = outcome.winner.garageId;
      const price = outcome.price;
      const pays = buyerPays(price, garageBonuses(db, buyer).auctionPremium);
      const gets = sellerReceives(
        price,
        seller === market ? 0 : garageBonuses(db, seller).auctionFee,
      );
      db.run('UPDATE car_ownership SET to_date = ? WHERE car_id = ? AND to_date IS NULL', [
        date,
        carId,
      ]);
      db.run('UPDATE car SET garage_id = ? WHERE id = ?', [buyer, carId]);
      db.run(
        "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, ?, 'auction')",
        [carId, buyer, date, price],
      );
      db.run(
        'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
        [buyer, date, 'car_purchase', -pays, `Auction lot ${lot.id as number}`],
      );
      db.run('UPDATE garage SET cash = cash - ? WHERE id = ?', [pays, buyer]);
      if (seller === market) {
        db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [gets, market]);
      } else {
        db.run(
          'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
          [seller, date, 'car_sale', gets, `Auction lot ${lot.id as number}`],
        );
        db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [gets, seller]);
      }
      db.run(
        "UPDATE auction_lot SET status = 'sold', final_price = ?, buyer_garage_id = ? WHERE id = ?",
        [price, buyer, lot.id as number],
      );
      result.sold += 1;
      result.turnover += price;
      result.fees += pays - gets;
    }
    db.run("UPDATE auction SET status = 'closed' WHERE id = ?", [auctionId]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return result;
}

export interface AuctionLotView extends Lot {
  /** This garage's own highest maximum bid on the lot, if it has bid. */
  myBid: number | null;
  /** The garage consigned this lot itself. */
  mine: boolean;
}

export interface AuctionView extends AuctionSummary {
  lotViews: AuctionLotView[];
}

/** The open auction, if there is one, with each lot as one garage sees it. */
export function currentAuction(db: Database, garageId: number): AuctionView | undefined {
  const auction = all(
    db,
    "SELECT id, kind, opens_on, closes_on FROM auction WHERE status = 'open' ORDER BY id DESC LIMIT 1",
  )[0];
  if (!auction) return undefined;
  const id = auction.id as number;
  const mine = new Map(
    all(
      db,
      `SELECT b.lot_id, MAX(b.amount) AS top FROM auction_bid b JOIN auction_lot l ON l.id = b.lot_id
        WHERE l.auction_id = ? AND b.bidder_garage_id = ? GROUP BY b.lot_id`,
      [id, garageId],
    ).map((r) => [r.lot_id as number, r.top as number]),
  );
  const lots = openLots(db, id).map((l) => ({
    ...l,
    myBid: mine.get(l.id) ?? null,
    mine: l.sellerGarageId === garageId,
    // The shared field is the best bid anyone has made, which the garage never sees: only its own.
    highestBid: mine.get(l.id) ?? null,
  }));
  return {
    id,
    kind: auction.kind as 'weekly' | 'festival',
    opensOn: auction.opens_on as string,
    closesOn: auction.closes_on as string,
    lots: lots.length,
    lotViews: lots,
  };
}

/** Opens a weekly auction if none is open. Returns it, or undefined if one was already open. */
export function ensureAuction(db: Database): AuctionSummary | undefined {
  if (all(db, "SELECT 1 AS n FROM auction WHERE status = 'open' LIMIT 1")[0]) return undefined;
  return openAuction(db, 'weekly');
}

export interface PlayerLotResult {
  plate: string;
  modelName: string;
  /** `won`: the garage bought it; `sold`: it consigned it and it sold; `unsold`: its own lot found no buyer; `lost`: it bid and did not win. */
  outcome: 'won' | 'sold' | 'unsold' | 'lost';
  price: number | null;
}

export interface AuctionClosing {
  auctionId: number;
  result: AuctionResult;
  /** What happened to the lots the garage bought, sold or bid on. */
  lots: PlayerLotResult[];
}

/** What a closed auction meant for one garage: its wins, its sales and the lots it bid on and lost. */
export function playerLots(db: Database, auctionId: number, garageId: number): PlayerLotResult[] {
  const out: PlayerLotResult[] = [];
  for (const r of all(
    db,
    `SELECT l.id, l.status, l.final_price, l.seller_garage_id, l.buyer_garage_id, c.plate, m.name,
            EXISTS (SELECT 1 FROM auction_bid b WHERE b.lot_id = l.id AND b.bidder_garage_id = ?) AS bid
       FROM auction_lot l JOIN car c ON c.id = l.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE l.auction_id = ? ORDER BY l.id`,
    [garageId, auctionId],
  )) {
    const base = {
      plate: r.plate as string,
      modelName: r.name as string,
      price: (r.final_price as number | null) ?? null,
    };
    if (r.buyer_garage_id === garageId) out.push({ ...base, outcome: 'won' });
    else if (r.seller_garage_id === garageId)
      out.push({ ...base, outcome: r.status === 'sold' ? 'sold' : 'unsold' });
    else if (r.bid === 1) out.push({ ...base, outcome: 'lost' });
  }
  return out;
}

/**
 * Runs the auction house between rounds: the open auction closes (computer garages bid, and the
 * lots go to the best bidder over the reserve), then a new weekly auction opens. Returns what the
 * closing meant for the garage, or undefined if there was nothing to close.
 */
export function auctionCycle(db: Database, garageId: number | null): AuctionClosing | undefined {
  const open = all(db, "SELECT id FROM auction WHERE status = 'open' ORDER BY id")[0];
  let closing: AuctionClosing | undefined;
  if (open) {
    const auctionId = open.id as number;
    const result = closeAuction(db, auctionId);
    closing = {
      auctionId,
      result,
      lots: garageId === null ? [] : playerLots(db, auctionId, garageId),
    };
  }
  openAuction(db, 'weekly');
  return closing;
}

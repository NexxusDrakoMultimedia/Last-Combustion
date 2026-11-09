// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { distanceKm, roundCosts } from '../sim/economy';
import {
  leverageFrom,
  patienceFor,
  relationshipChange,
  respond,
  walkAwayValue,
} from '../sim/negotiation';
import { createRng } from '../sim/rng';
import {
  BASE_RATES,
  SUPPLY_CATEGORIES,
  canDealWith,
  contractRate,
  fairSupplyDiscount,
  marketRate,
  supplierById,
  supplierStrength,
  type Supplier,
  type SupplyCategory,
  type SupplyRates,
} from '../sim/supply';
import { economyBalance, supplyData } from '../sim/worldgen/data';
import { OUTAGE_CATEGORIES, outageChance, type OutageCategory } from '../sim/outages';
import { garageBonuses } from './bonuses';
import { supplierOffers } from './companies';
import { readCareer } from './career';
import { all } from './entries';
import { garageFacilityBonuses } from './facilities';
import { garageOutages, supplyReliability } from './outages';
import { nextRoundNumber } from './prelims';
import { adjustRelationship, relationshipScore, type Negotiation } from './negotiation';

const careerOf = (db: Database) => {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  return career;
};

const yearOf = (db: Database): number => Number(careerOf(db).gameDate.slice(0, 4));

/** The market rate of a category in a year (drawn from the career seed, so it never changes). */
export function categoryMarket(
  db: Database,
  category: SupplyCategory,
  year: number = yearOf(db),
): { rate: number; shock: boolean } {
  const career = careerOf(db);
  return marketRate(
    createRng(career.masterSeed).stream(`market:${category}:${year}`),
    category,
    year - career.startYear,
  );
}

export interface SupplyContract {
  id: number;
  category: SupplyCategory;
  supplierId: number;
  supplierName: string;
  startYear: number;
  endYear: number;
  discount: number;
  /** The price multiplier the contract locked in. */
  rate: number;
}

/** The contracts a garage has in force in a year. */
export function activeContracts(
  db: Database,
  garageId: number,
  year: number = yearOf(db),
): SupplyContract[] {
  return all(
    db,
    `SELECT id, category, supplier_id, start_year, end_year, discount, rate FROM supply_contract
      WHERE garage_id = ? AND start_year <= ? AND end_year >= ? ORDER BY category`,
    [garageId, year, year],
  ).map((r) => ({
    id: r.id as number,
    category: r.category as SupplyCategory,
    supplierId: r.supplier_id as number,
    supplierName: supplierById(r.supplier_id as number)?.name ?? '',
    startYear: r.start_year as number,
    endYear: r.end_year as number,
    discount: r.discount as number,
    rate: r.rate as number,
  }));
}

/**
 * What a garage pays for each category against the base prices in a year: the contract's locked
 * rate if it has one, otherwise the market rate, less the Operations Director's saving.
 */
export function supplyRates(
  db: Database,
  garageId: number,
  year: number = yearOf(db),
): SupplyRates {
  const saving = 1 - garageBonuses(db, garageId).utilities;
  // Solar panels, water tanks and a transporter fleet cut their own bills.
  const own = garageFacilityBonuses(db, garageId);
  const facilitySaving: Partial<Record<SupplyCategory, number>> = {
    electricity: own.electricity,
    water: own.water,
    logistics: own.logistics,
  };
  const contracts = activeContracts(db, garageId, year);
  const rates = { ...BASE_RATES };
  for (const category of SUPPLY_CATEGORIES) {
    const contract = contracts.find((c) => c.category === category);
    const base = contract ? contract.rate : categoryMarket(db, category, year).rate;
    rates[category] =
      Math.round(base * saving * (1 - (facilitySaving[category] ?? 0)) * 10000) / 10000;
  }
  return rates;
}

export interface SupplierOption {
  id: number;
  name: string;
  tier: Supplier['tier'];
  priceIndex: number;
  reliability: number;
  minPrestige: number;
  /** Whether the garage's prestige and home region let it deal with this supplier. */
  eligible: boolean;
}

export interface CategoryView {
  category: SupplyCategory;
  /** The market rate this year (1 is the base price) and whether a shock is driving it. */
  market: number;
  shock: boolean;
  /** What the garage pays now per unit of base price, and what the next round would cost. */
  rate: number;
  nextRound: number;
  contract: SupplyContract | undefined;
  suppliers: SupplierOption[];
  /** The chance that this supply fails in a round, and whether it is down in the next round. Null for a category whose failure is not played out. */
  outage: { chance: number; next: boolean } | null;
}

export interface SupplyView {
  categories: CategoryView[];
  /** The Operations Director's saving, as a share. */
  saving: number;
}

/** The next round's cost of each category for a garage with this many entries. */
function forecast(
  db: Database,
  garageId: number,
  rates: SupplyRates,
  entries: number,
): Record<SupplyCategory, number> {
  const next = all(
    db,
    `SELECT c.stable_id AS course FROM round r JOIN course c ON c.id = r.course_id
      WHERE r.season_id = (SELECT MAX(id) FROM season) AND r.status = 'scheduled'
      ORDER BY r.number LIMIT 1`,
  )[0];
  const venue = next
    ? (economyBalance.venues as Record<string, { lat: number; lon: number }>)[next.course as string]
    : undefined;
  const base = all(
    db,
    'SELECT p.latitude AS lat, p.longitude AS lon FROM garage g JOIN place p ON p.id = g.base_place_id WHERE g.id = ?',
    [garageId],
  )[0];
  const km =
    venue && base ? distanceKm({ lat: base.lat as number, lon: base.lon as number }, venue) : 0;
  const costs = (r: SupplyRates) =>
    roundCosts({ entries, top31: 0, upkeep: [], distanceKm: km, rates: r });
  const out = {} as Record<SupplyCategory, number>;
  // The cost of a category is what the round costs with that category at its rate and the others at zero.
  const zero = { electricity: 0, water: 0, race_fuel: 0, travel_fuel: 0, logistics: 0 };
  for (const category of SUPPLY_CATEGORIES) {
    const only = { ...zero, [category]: rates[category] } as SupplyRates;
    const c = costs(only);
    out[category] = c.electricity + c.water + c.raceFuel + c.travel;
  }
  return out;
}

/** Each category with its market, the garage's price, its contract and the suppliers it could deal with. */
export function supplyView(db: Database, garageId: number): SupplyView {
  const year = yearOf(db);
  const garage = all(db, 'SELECT prestige, home_state FROM garage WHERE id = ?', [garageId])[0];
  if (!garage) throw new Error(`There is no garage ${garageId}.`);
  const rates = supplyRates(db, garageId, year);
  const contracts = activeContracts(db, garageId, year);
  const entries = Number(
    all(
      db,
      "SELECT COUNT(*) AS n FROM entry WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season)",
      [garageId],
    )[0]!.n,
  );
  const costs = forecast(db, garageId, rates, Math.max(1, entries));
  const coming = nextRoundNumber(db);
  const down = coming === null ? [] : garageOutages(db, garageId, coming, year);
  return {
    saving: garageBonuses(db, garageId).utilities,
    categories: SUPPLY_CATEGORIES.map((category) => {
      const market = categoryMarket(db, category, year);
      return {
        category,
        market: market.rate,
        shock: market.shock,
        rate: rates[category],
        nextRound: costs[category],
        contract: contracts.find((c) => c.category === category),
        outage: (OUTAGE_CATEGORIES as readonly string[]).includes(category)
          ? {
              chance: outageChance(
                supplyReliability(db, garageId, category as OutageCategory, year),
              ),
              next: down.includes(category as OutageCategory),
            }
          : null,
        // Three offered at random (weighted by tier, prestige and relationship), sorted by tier then name.
        suppliers: supplierOffers(
          db,
          garageId,
          category,
          garage.prestige as number,
          (s) => canDealWith(s, garage.prestige as number, garage.home_state as string),
          contracts.find((c) => c.category === category)?.supplierId,
        ).map((s) => ({
          id: s.id,
          name: s.name,
          tier: s.tier,
          priceIndex: s.priceIndex,
          reliability: s.reliability,
          minPrestige: supplyData.tiers[s.tier].minPrestige,
          eligible: canDealWith(s, garage.prestige as number, garage.home_state as string),
        })),
      };
    }),
  };
}

/**
 * Starts a negotiation with a supplier for a discount on its price. The garage must be able to
 * deal with it (its prestige and home region) and have no contract in the category now.
 */
export function openSupplyNegotiation(
  db: Database,
  garageId: number,
  supplierId: number,
): Negotiation {
  const year = yearOf(db);
  const garage = all(db, 'SELECT prestige, home_state, kind FROM garage WHERE id = ?', [
    garageId,
  ])[0];
  if (!garage || garage.kind !== 'racing')
    throw new Error(`There is no racing garage ${garageId}.`);
  const supplier = supplierById(supplierId);
  if (!supplier) throw new Error(`There is no supplier ${supplierId}.`);
  if (!canDealWith(supplier, garage.prestige as number, garage.home_state as string))
    throw new Error('The garage cannot deal with this supplier yet.');
  if (activeContracts(db, garageId, year).some((c) => c.category === supplier.category))
    throw new Error('The garage already has a contract in this category.');
  if (
    all(
      db,
      `SELECT 1 AS n FROM negotiation WHERE kind = 'supply_contract' AND window = ? AND status = 'walked'
        AND party_a_id = ? AND party_b_id = ? LIMIT 1`,
      [String(year), garageId, supplierId],
    ).length > 0
  )
    throw new Error('This supplier has walked away and will not negotiate again this year.');
  // A negotiation left open starts over.
  for (const stale of all(
    db,
    `SELECT id FROM negotiation WHERE kind = 'supply_contract' AND status = 'open' AND party_a_id = ? AND party_b_id = ?`,
    [garageId, supplierId],
  )) {
    db.run('DELETE FROM offer WHERE negotiation_id = ?', [stale.id as number]);
    db.run('DELETE FROM negotiation WHERE id = ?', [stale.id as number]);
  }
  const fair = fairSupplyDiscount(garage.prestige as number);
  const relationship = relationshipScore(
    db,
    { type: 'garage', id: garageId },
    { type: 'utility', id: supplierId },
  );
  const bonuses = garageBonuses(db, garageId);
  const walkAway = walkAwayValue(fair, 'pays', {
    leverage:
      leverageFrom(supplierStrength(supplier), garage.prestige as number) - bonuses.leverage,
    relationship,
    rivalInterest: 0,
  });
  const patience = patienceFor(relationship) + (bonuses.extraPatience ? 1 : 0);
  db.run(
    `INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
     VALUES ('supply_contract', ?, 'garage', ?, 'utility', ?, ?, ?, ?)`,
    [String(year), garageId, supplierId, patience, fair, walkAway],
  );
  const id = Number(all(db, 'SELECT MAX(id) AS n FROM negotiation')[0]!.n);
  return { id, patience, fairValue: fair };
}

export interface SupplyTerms {
  /** The discount asked for, as a fraction (0.1 is 10%). */
  discount: number;
  years: number;
}

export type SupplyOutcome =
  | { kind: 'accepted'; contractId: number; rate: number }
  | { kind: 'countered'; counter: SupplyTerms; patienceLeft: number }
  | { kind: 'walked' };

/** Asks for a discount. The supplier accepts (up to its walk-away discount), counters lower, or walks away. */
export function offerSupplyContract(
  db: Database,
  negotiationId: number,
  terms: SupplyTerms,
): SupplyOutcome {
  const year = yearOf(db);
  const n = all(db, "SELECT * FROM negotiation WHERE id = ? AND kind = 'supply_contract'", [
    negotiationId,
  ])[0];
  if (!n) throw new Error(`There is no negotiation ${negotiationId}.`);
  if (n.status !== 'open')
    throw new Error(`Negotiation ${negotiationId} is already ${n.status as string}.`);
  if (
    !(terms.discount >= 0 && terms.discount <= 1) ||
    !Number.isInteger(terms.years) ||
    terms.years < 1 ||
    terms.years > supplyData.maxYears
  )
    throw new Error(
      `A supply contract is for 1 to ${supplyData.maxYears} whole years at a discount between 0 and 1.`,
    );
  const garageId = n.party_a_id as number;
  const supplierId = n.party_b_id as number;
  const supplier = supplierById(supplierId)!;
  const response = respond(
    terms.discount,
    n.walk_away as number,
    'pays',
    n.patience_left as number,
    n.counters as number,
  );
  const round =
    Number(
      all(db, 'SELECT COUNT(*) AS c FROM offer WHERE negotiation_id = ?', [negotiationId])[0]!.c,
    ) + 1;
  const record = (outcome: 'accepted' | 'countered' | 'walked') =>
    db.run(
      "INSERT INTO offer (negotiation_id, round_no, from_side, terms, value, outcome) VALUES (?, ?, 'a', ?, ?, ?)",
      [negotiationId, round, JSON.stringify(terms), terms.discount, outcome],
    );

  db.exec('BEGIN');
  try {
    if (response.kind === 'walk') {
      record('walked');
      db.run("UPDATE negotiation SET status = 'walked', patience_left = 0 WHERE id = ?", [
        negotiationId,
      ]);
      db.exec('COMMIT');
      return { kind: 'walked' };
    }
    if (response.kind === 'counter') {
      record('countered');
      db.run('UPDATE negotiation SET patience_left = ?, counters = counters + 1 WHERE id = ?', [
        response.patienceLeft,
        negotiationId,
      ]);
      db.exec('COMMIT');
      return {
        kind: 'countered',
        counter: { discount: Math.round(response.value * 10000) / 10000, years: terms.years },
        patienceLeft: response.patienceLeft,
      };
    }
    record('accepted');
    const rate = contractRate(
      supplier,
      categoryMarket(db, supplier.category, year).rate,
      terms.discount,
    );
    db.run(
      `INSERT INTO supply_contract (garage_id, category, supplier_id, start_year, end_year, discount, rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [garageId, supplier.category, supplierId, year, year + terms.years - 1, terms.discount, rate],
    );
    const contractId = Number(all(db, 'SELECT MAX(id) AS n FROM supply_contract')[0]!.n);
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [negotiationId]);
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'utility', id: supplierId },
      relationshipChange().keptDeal,
    );
    db.exec('COMMIT');
    return { kind: 'accepted', contractId, rate };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

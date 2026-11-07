// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import {
  activeContracts,
  categoryMarket,
  offerSupplyContract,
  openSupplyNegotiation,
  supplyRates,
  supplyView,
} from '../../src/db/supply';
import { persistWorld } from '../../src/db/world';
import { SUPPLIERS, SUPPLY_CATEGORIES } from '../../src/sim/supply';
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
  garageName: 'Supply Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed = 'supply'): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  db.run("UPDATE garage SET cash = 100000000, home_state = 'SA', prestige = 1 WHERE id = ?", [
    garageId,
  ]);
  return { db, garageId };
}

const electricityLocal = SUPPLIERS.find((s) => s.category === 'electricity' && s.tier === 'local')!;
const electricityGlobal = SUPPLIERS.find(
  (s) => s.category === 'electricity' && s.tier === 'global',
)!;

describe('the spot market', () => {
  it('charges the base price in the first season and the market after, the same for a seed', () => {
    const { db, garageId } = fresh();
    for (const category of SUPPLY_CATEGORIES)
      expect(supplyRates(db, garageId, 2031)[category]).toBe(1);
    expect(supplyRates(db, garageId, 2035)).toEqual(supplyRates(db, garageId, 2035));
    expect(categoryMarket(db, 'race_fuel', 2035)).toEqual(categoryMarket(db, 'race_fuel', 2035));
    const other = fresh('supply-other');
    expect(
      SUPPLY_CATEGORIES.some(
        (c) => categoryMarket(db, c, 2036).rate !== categoryMarket(other.db, c, 2036).rate,
      ),
    ).toBe(true);
  });

  it('is cut by an Operations Director', () => {
    const { db, garageId } = fresh('supply-ops');
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on) VALUES (?, 'operations_director', 'Test Person', 1980, 100, 'employed', 100000, 2031, 2033, '2031-02-01')",
      [garageId],
    );
    expect(supplyRates(db, garageId, 2031).electricity).toBeCloseTo(0.85, 4);
    expect(supplyView(db, garageId).saving).toBeCloseTo(0.15, 4);
  });
});

describe('negotiating a supply contract', () => {
  it('needs the prestige (any state will do), and one contract a category', () => {
    const { db, garageId } = fresh('supply-gates');
    expect(() => openSupplyNegotiation(db, garageId, electricityGlobal.id)).toThrow(/cannot deal/);
    // Suppliers serve all of Australia, so the base state makes no difference.
    db.run("UPDATE garage SET home_state = 'WA' WHERE id = ?", [garageId]);
    const n = openSupplyNegotiation(db, garageId, electricityLocal.id);
    expect(n.fairValue).toBeCloseTo(0.041, 3);
    const result = offerSupplyContract(db, n.id, { discount: 0.01, years: 2 });
    expect(result.kind).toBe('accepted');
    expect(() => openSupplyNegotiation(db, garageId, electricityLocal.id)).toThrow(/already has/);
  });

  it('locks the price for the length of the deal, whatever the market does', () => {
    const { db, garageId } = fresh('supply-lock');
    const n = openSupplyNegotiation(db, garageId, electricityLocal.id);
    const result = offerSupplyContract(db, n.id, { discount: 0, years: 2 });
    if (result.kind !== 'accepted') throw new Error('expected a deal');
    expect(result.rate).toBeCloseTo(electricityLocal.priceIndex, 3);
    const [contract] = activeContracts(db, garageId, 2031);
    expect(contract).toMatchObject({ category: 'electricity', startYear: 2031, endYear: 2032 });
    expect(supplyRates(db, garageId, 2031).electricity).toBeCloseTo(electricityLocal.priceIndex, 3);
    expect(supplyRates(db, garageId, 2032).electricity).toBeCloseTo(electricityLocal.priceIndex, 3);
    // After it ends the garage is back on the spot market.
    expect(supplyRates(db, garageId, 2033).electricity).toBe(
      categoryMarket(db, 'electricity', 2033).rate,
    );
  });

  it('counters or walks away from a greedy ask, and will not deal again that year', () => {
    const { db, garageId } = fresh('supply-greedy');
    const n = openSupplyNegotiation(db, garageId, electricityLocal.id);
    const first = offerSupplyContract(db, n.id, { discount: 0.9, years: 1 });
    expect(['countered', 'walked']).toContain(first.kind);
    let last = first;
    for (let i = 0; i < 6 && last.kind === 'countered'; i++)
      last = offerSupplyContract(db, n.id, { discount: 0.9, years: 1 });
    expect(last.kind).toBe('walked');
    expect(() => openSupplyNegotiation(db, garageId, electricityLocal.id)).toThrow(/walked away/);
    expect(scalar(db, 'SELECT COUNT(*) FROM supply_contract')).toBe(0);
  });

  it('refuses nonsense terms', () => {
    const { db, garageId } = fresh('supply-terms');
    const n = openSupplyNegotiation(db, garageId, electricityLocal.id);
    expect(() => offerSupplyContract(db, n.id, { discount: 0.05, years: 4 })).toThrow(/1 to 3/);
    expect(() => offerSupplyContract(db, n.id, { discount: 1.5, years: 1 })).toThrow(/1 to 3/);
  });
});

describe('paying for a round', () => {
  it('charges electricity, water and race fuel, and a contract changes the bill', () => {
    const open = fresh('supply-bill');
    const signed = fresh('supply-bill');
    const n = openSupplyNegotiation(signed.db, signed.garageId, electricityLocal.id);
    expect(offerSupplyContract(signed.db, n.id, { discount: 0.01, years: 1 }).kind).toBe(
      'accepted',
    );
    for (const { db } of [open, signed]) {
      playPrelims(db, 1);
      playFinal(db, 1);
      settleRound(db, 1);
    }
    const paid = (f: { db: Database; garageId: number }, category: string) =>
      Number(
        scalar(
          f.db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${f.garageId} AND category = '${category}'`,
        ),
      );
    expect(paid(open, 'electricity')).toBeGreaterThan(0);
    expect(paid(open, 'water')).toBeGreaterThan(0);
    expect(paid(open, 'race_fuel')).toBeGreaterThan(0);
    expect(paid(signed, 'electricity')).toBe(
      Math.round(paid(open, 'electricity') * electricityLocal.priceIndex * 0.99),
    );
    expect(paid(signed, 'water')).toBe(paid(open, 'water'));
  });

  it('shows the next round’s cost in the view', () => {
    const { db, garageId } = fresh('supply-view');
    const view = supplyView(db, garageId);
    expect(view.categories.map((c) => c.category)).toEqual(SUPPLY_CATEGORIES);
    for (const c of view.categories) {
      expect(c.nextRound).toBeGreaterThan(0);
      expect(c.contract).toBeUndefined();
      expect(c.suppliers).toHaveLength(4);
    }
    const electricity = view.categories.find((c) => c.category === 'electricity')!;
    expect(electricity.suppliers.find((s) => s.id === electricityGlobal.id)!.eligible).toBe(false);
    expect(electricity.suppliers.find((s) => s.id === electricityLocal.id)!.eligible).toBe(true);
  });
});

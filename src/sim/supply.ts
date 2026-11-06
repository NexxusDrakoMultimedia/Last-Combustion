// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { supplyData } from './worldgen/data';

export type SupplyCategory = keyof typeof supplyData.categories;
export const SUPPLY_CATEGORIES = Object.keys(supplyData.categories) as SupplyCategory[];
export type SupplierTier = keyof typeof supplyData.tiers;

/** An operating supplier: a fictional company that sells one category to garages. */
export interface Supplier {
  id: number;
  name: string;
  category: SupplyCategory;
  tier: SupplierTier;
  /** Its price against the market rate (1 is the market). */
  priceIndex: number;
  /** 0 to 1; low reliability will mean outages (not built yet). */
  reliability: number;
  /** The home regions it serves, or null for everywhere. */
  states: string[] | null;
}

export const SUPPLIERS: Supplier[] = supplyData.suppliers as Supplier[];

export const supplierById = (id: number): Supplier | undefined =>
  SUPPLIERS.find((s) => s.id === id);

/**
 * The market rate of a category in a year, as a multiplier on its base price (1 is the base): the
 * category's trend over the years since the career began, a swing drawn from the stream, and now
 * and then a shock (a heatwave, a drought, a fuel crisis, a haulage strike).
 */
export function marketRate(
  rng: RandomStream,
  category: SupplyCategory,
  yearsIn: number,
): { rate: number; shock: boolean } {
  const c = supplyData.categories[category];
  const swing = rng.float(-c.volatility, c.volatility);
  const shock = yearsIn > 0 && rng.chance(c.shockChance);
  const [lo, hi] = c.shock as [number, number];
  const bump = shock ? rng.float(lo, hi) : 0;
  const rate = 1 + c.trend * Math.max(0, yearsIn) + (yearsIn > 0 ? swing : 0) + bump;
  return { rate: Math.round(Math.min(2, Math.max(0.7, rate)) * 1000) / 1000, shock };
}

/** Whether a garage of this prestige and home region can deal with a supplier. */
export function canDealWith(supplier: Supplier, prestige: number, homeState: string): boolean {
  return (
    prestige >= supplyData.tiers[supplier.tier].minPrestige &&
    (supplier.states === null || supplier.states.includes(homeState))
  );
}

/** The fair discount for a garage of this prestige: 4% + 0.1% a point, capped at 15%. */
export function fairSupplyDiscount(prestige: number): number {
  const d = supplyData.discount;
  return Math.min(d.cap, d.base + d.perPrestige * prestige);
}

/** How much weight a supplier carries against a garage (0-100), from its tier. */
export function supplierStrength(supplier: Supplier): number {
  return supplyData.tiers[supplier.tier].strength;
}

/** The price multiplier a contract locks in: the supplier's index times the market that year, less the agreed discount. */
export function contractRate(supplier: Supplier, market: number, discount: number): number {
  return Math.round(supplier.priceIndex * market * (1 - discount) * 10000) / 10000;
}

/** The price multipliers (against the base prices) a garage pays this round, one per category. */
export type SupplyRates = Record<SupplyCategory, number>;

export const BASE_RATES: SupplyRates = {
  electricity: 1,
  water: 1,
  race_fuel: 1,
  travel_fuel: 1,
  logistics: 1,
};

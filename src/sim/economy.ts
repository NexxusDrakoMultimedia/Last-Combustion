// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { economyBalance } from './worldgen/data';
import type { Tier } from './worldgen/types';

const cfg = () => economyBalance as typeof economyBalance & { tierUpkeep: Record<Tier, number> };

/** What a chassis is known for: its left-quarter-panel decals and its fans. */
export interface Provenance {
  wins: number;
  championships: number;
  fans: number;
}

/** The share of the new price a used car of this age is worth before wear and history. */
export function usedShareOfNew(ageYears: number): number {
  const { start, perYear, floor } = cfg().usedShareOfNew;
  return Math.min(start, Math.max(floor, start - perYear * Math.max(0, ageYears)));
}

/** Multiplier for a good record, capped (see the GDD, "Auction house and car trading"). */
export function provenanceFactor(p: Provenance): number {
  const { perWin, perChampionship, perFan, cap } = cfg().provenance;
  return Math.min(cap, 1 + perWin * p.wins + perChampionship * p.championships + perFan * p.fans);
}

/** Multiplier for wear: a worn-out car is worth far less. */
export function wearFactor(wear: number): number {
  return Math.max(0, 1 - cfg().wearValuePerPoint * wear);
}

export interface ValueInput extends Provenance {
  priceNew: number;
  modelYear: number;
  currentYear: number;
  wear: number;
}

/** The value of a used chassis: base x wear factor x provenance factor, rounded to the dollar. */
export function carValue(input: ValueInput): number {
  const base = input.priceNew * usedShareOfNew(input.currentYear - input.modelYear);
  return Math.round(base * wearFactor(input.wear) * provenanceFactor(input));
}

/** What a dealer asks for a new car, after a discount (0 to 1) won in negotiation. */
export function newCarPrice(priceNew: number, discount = 0): number {
  return Math.round(priceNew * (1 - Math.min(1, Math.max(0, discount))));
}

/** The multiplier on servicing and parts for a tier ("Supercar upkeep"). */
export function upkeepFactor(tier: Tier): number {
  return cfg().tierUpkeep[tier];
}

/** Great-circle distance in kilometres. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface RoundCostInput {
  /** Number of entries the garage has at the round. */
  entries: number;
  /** How many of those finished the prelims in the top 31 (they get free tyres). */
  top31: number;
  /** The garage's cars' upkeep factors, one per entry. */
  upkeep: number[];
  /** Distance from the garage's base to the venue, in kilometres. */
  distanceKm: number;
}

export interface RoundCosts {
  entryFees: number;
  tyres: number;
  servicing: number;
  travel: number;
  total: number;
}

/** What a garage pays for a round (see the GDD, "Cost baseline"). */
export function roundCosts(input: RoundCostInput): RoundCosts {
  const c = cfg().costs;
  const entryFees = c.entryFee * input.entries;
  const paying = Math.max(0, input.entries - input.top31);
  const tyres = paying * (c.raceTyres + c.practiceTyres);
  const practiceOnly = input.top31 * c.practiceTyres;
  const servicing = Math.round(input.upkeep.reduce((sum, u) => sum + c.servicing * u, 0));
  const travel = Math.round(
    c.travelBase +
      c.travelPerKm * input.distanceKm +
      c.travelPerExtraEntry * Math.max(0, input.entries - 1),
  );
  const total = entryFees + tyres + practiceOnly + servicing + travel;
  return { entryFees, tyres: tyres + practiceOnly, servicing, travel, total };
}

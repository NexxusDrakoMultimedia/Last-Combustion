// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { economyBalance } from './worldgen/data';

const cfg = () => economyBalance.auction;

/** The smallest raise on a price: 2%, and at least $500. */
export function minIncrement(price: number): number {
  return Math.max(cfg().minIncrementFloor, Math.round(price * cfg().minIncrementPct));
}

/** The price a lot opens at: half the reserve, and at least $500. */
export function openingPrice(reserve: number): number {
  return Math.max(cfg().openingFloor, Math.round(reserve * cfg().openingShareOfReserve));
}

/** What the buyer pays on top of the hammer price. */
export function buyerPays(price: number): number {
  return Math.round(price * (1 + cfg().buyerPremium));
}

/** What the seller receives after the seller's fee. */
export function sellerReceives(price: number): number {
  return Math.round(price * (1 - cfg().sellerFee));
}

/** A bidder's highest price (a proxy bid: the auction raises their bid for them up to it). */
export interface Bidder {
  garageId: number;
  max: number;
}

export interface LotOutcome {
  /** The winner, or undefined when the lot did not reach its reserve. */
  winner?: Bidder;
  price: number;
}

/**
 * The result of a lot with proxy bidding. The highest maximum wins (the earliest bid wins a tie)
 * and pays one increment over the second highest maximum, but never less than the reserve and
 * never more than their own maximum. A lot whose best maximum is under the reserve is unsold.
 */
export function resolveLot(bidders: readonly Bidder[], reserve: number): LotOutcome {
  const ranked = bidders
    .map((b, order) => ({ b, order }))
    .sort((x, y) => y.b.max - x.b.max || x.order - y.order)
    .map((x) => x.b);
  const top = ranked[0];
  if (!top || top.max < reserve) return { price: 0 };
  const second = ranked[1];
  const raised = second ? second.max + minIncrement(second.max) : openingPrice(reserve);
  const price = Math.min(top.max, Math.max(reserve, raised, openingPrice(reserve)));
  return { winner: top, price };
}

/** How much an AI garage will pay: the car's value times a personal factor of 0.8 to 1.2. */
export function aiMaxBid(value: number, factor: number): number {
  return Math.round(value * factor);
}

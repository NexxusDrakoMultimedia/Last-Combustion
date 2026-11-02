// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { dealBalance } from './worldgen/data';

/** The two discount deals a garage can negotiate (see the GDD, "Negotiations"). */
export type DealKind = 'supplier' | 'manufacturer';

/**
 * The fair discount for a garage with this prestige: a supplier gives 5% + 0.1% x prestige on
 * its parts, a manufacturer 3% + 0.12% x prestige on new cars, both capped at 15%.
 */
export function fairDiscount(kind: DealKind, prestige: number): number {
  const c = dealBalance;
  const raw =
    kind === 'supplier'
      ? c.supplierBase + c.supplierPerPrestige * prestige
      : c.manufacturerBase + c.manufacturerPerPrestige * prestige;
  return Math.min(c.cap, raw);
}

/** How much weight a supplier or manufacturer carries against a garage (0-100). */
export function partyStrength(kind: DealKind): number {
  return kind === 'supplier' ? dealBalance.supplierStrength : dealBalance.manufacturerStrength;
}

/** The price after a discount from a deal (0 for no deal), rounded to the dollar. */
export function discounted(price: number, discount: number): number {
  return Math.round(price * (1 - Math.min(1, Math.max(0, discount))));
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { CarRatings } from '../prelim/ratings';
import { finalBalance } from '../worldgen/data';
import { clamp } from '../worldgen/rating';

const cfg = finalBalance.tyre;

/** How much a car spins its wheels (0-1): powerful cars with poor traction do it most. */
export const wheelspinFactor = (r: CarRatings): number =>
  clamp(0.7 * r.power + 0.3 * (1 - r.traction), 0, 1);

/** How much a car slides (0-1): cars with little grip slide most. */
export const slideFactor = (r: CarRatings): number => clamp(0.8 * (1 - r.grip), 0, 1);

/** The tyre-wear multiplier for a car and driver (see the GDD, "Formulas"). */
export function wearMultiplier(
  aggression: number,
  wheelspin: number,
  slide: number,
  tyreManagement: number,
): number {
  return 1 + 0.4 * aggression + 0.3 * wheelspin + 0.2 * slide - 0.5 * (tyreManagement / 100);
}

/**
 * The base tyre loss per sector, set so that a reference driver and car (balanced pace,
 * average tyre management) have about 8% of the set left at the flag.
 */
export function baseTyreLoss(totalSectors: number): number {
  const ref = cfg.reference;
  const multiplier = wearMultiplier(ref.aggression, ref.wheelspin, ref.slide, ref.tyreManagement);
  return (100 - cfg.endTargetPct) / (totalSectors * multiplier);
}

/** The extra time lost (as a fraction of sector time) when the tyres are nearly gone. */
export function gripTimeFactor(tyrePct: number): number {
  return 1 + cfg.gripLossPerPoint * Math.max(0, cfg.gripLossFromPct - tyrePct);
}

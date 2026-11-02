// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { seasonBalance } from './worldgen/data';

/** Whether a driver of this age retires at the end of the season (always at the forced age). */
export function retires(rng: RandomStream, age: number): boolean {
  if (age >= seasonBalance.forcedRetirementAge) return true;
  if (age < seasonBalance.retirementStartAge) return false;
  const chance = Math.min(
    1,
    seasonBalance.retirementChancePerYear * (age - seasonBalance.retirementStartAge + 1),
  );
  return rng.chance(chance);
}

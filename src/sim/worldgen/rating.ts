// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { balance } from './data';
import { ROAD_TYPES, type Driver } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** A driver's overall rating (20-85 for most drivers), used for salaries and rankings. */
export function overallRating(
  d: Pick<
    Driver,
    | 'pace'
    | 'consistency'
    | 'racecraft'
    | 'tyreManagement'
    | 'composure'
    | 'wetSkill'
    | 'affinities'
  >,
): number {
  const affinity =
    ROAD_TYPES.reduce((sum, type) => sum + d.affinities[type], 0) / ROAD_TYPES.length;
  return (
    d.pace * 0.35 +
    d.consistency * 0.15 +
    d.racecraft * 0.15 +
    d.tyreManagement * 0.1 +
    d.composure * 0.1 +
    d.wetSkill * 0.05 +
    affinity * 0.1
  );
}

/** Fame (0-100) is derived from fan count (see the GDD, "Fans"). */
export function fameFromFans(fans: number): number {
  return clamp(12.5 * Math.log10(Math.max(fans, 1) / 10), 0, 100);
}

/** Fair yearly salary for a driver (see the GDD, "Negotiations"). */
export function fairSalary(rating: number, gold: boolean): number {
  const base = balance.contracts.salaryScale * Math.max(0, rating - 20) ** 2;
  return base * (gold ? balance.contracts.goldMultiplier : 1);
}

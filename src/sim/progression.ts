// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { seasonBalance } from './worldgen/data';

export const DEVELOPING_STATS = [
  'pace',
  'consistency',
  'racecraft',
  'tyreManagement',
  'composure',
  'wetSkill',
] as const;
export type DevelopingStat = (typeof DEVELOPING_STATS)[number];
export type DriverStats = Record<DevelopingStat, number>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A driver's stats after a year. Until the growth age they close part of the gap between pace and
 * potential and gain a little everywhere; from the decline age pace falls, and raw speed goes
 * before judgement (racecraft, composure and consistency fall at half the rate). Pace never
 * rises above potential. Each stat moves by a small random amount, drawn from the given stream.
 */
export function develop(
  rng: RandomStream,
  stats: DriverStats,
  potential: number,
  age: number,
): DriverStats {
  const p = seasonBalance.progression;
  const next = { ...stats };
  for (const key of DEVELOPING_STATS) {
    let delta = rng.normal(0, p.noise);
    if (age <= p.growthEndAge) {
      delta += key === 'pace' ? (potential - stats.pace) * p.paceGainShare : p.statGain;
    } else if (age >= p.declineStartAge) {
      const years = age - p.declineStartAge + 1;
      const judgement = key === 'racecraft' || key === 'composure' || key === 'consistency';
      delta -= p.declinePerYear * years * (judgement ? 0.5 : 1);
    }
    const cap = key === 'pace' ? Math.min(p.max, potential) : p.max;
    next[key] = Math.round(clamp(stats[key] + delta, p.min, Math.max(cap, stats[key])));
  }
  return next;
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng, type RandomStream } from './rng';
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

/** How one driver ages: when growth fades and decline starts, and how fast each goes. */
export interface GrowthCurve {
  /** The last age (for raw speed) at which a driver still grows at full rate. */
  growthEnd: number;
  /** The age (for raw speed) from which a driver starts to slip. */
  declineStart: number;
  /** Multiplies every gain: some drivers learn fast, some slowly. */
  growthRate: number;
  /** Multiplies every loss: some drivers fade early and hard, some gently. */
  declineRate: number;
}

/** The curve of a driver who is average in every way (what drivers had before curves varied). */
export const AVERAGE_CURVE: GrowthCurve = {
  growthEnd: seasonBalance.progression.growthEndAge,
  declineStart: seasonBalance.progression.declineStartAge,
  growthRate: 1,
  declineRate: 1,
};

/**
 * A driver's growth curve. It is drawn from the career's seed and the driver's id, so every driver
 * ages in their own way (an early bloomer, a late one, a quick learner, a gentle fader) and the
 * same career always gives the same curve, without it being stored.
 */
export function driverCurve(masterSeed: string, driverId: number): GrowthCurve {
  const range = seasonBalance.progression.curve;
  const rng = createRng(masterSeed).stream(`curve:${driverId}`);
  return {
    growthEnd: rng.int(range.growthEnd[0]!, range.growthEnd[1]!),
    declineStart: rng.int(range.declineStart[0]!, range.declineStart[1]!),
    growthRate: Math.round(rng.float(range.growthRate[0]!, range.growthRate[1]!) * 100) / 100,
    declineRate: Math.round(rng.float(range.declineRate[0]!, range.declineRate[1]!) * 100) / 100,
  };
}

/** What a training level does (see the GDD, "Driver development"). */
export function trainingLevel(level: number) {
  const levels = seasonBalance.training.levels;
  return levels[clamp(Math.round(level), 0, levels.length - 1)]!;
}

const isJudgement = (key: DevelopingStat) =>
  key === 'racecraft' || key === 'composure' || key === 'consistency';

export interface DevelopOptions {
  curve?: GrowthCurve;
  /** Training level 0 to 3: faster growth, slower decline and a higher soft cap. */
  training?: number;
  /** A Sporting Director's boost to what training does (0.25 is a quarter more growth and less decline). */
  trainingBoost?: number;
}

/**
 * A driver's stats after a year. Growth runs at full rate until the driver's growth age, fades over
 * the next few years and stops; from the driver's decline age stats slip, raw speed before
 * judgement (racecraft, composure and consistency peak two years later and fall at half the
 * rate). Potential is a soft cap: pace closes a share of the gap to it, other stats gain less the
 * further they are above it, and training lifts the cap a little. Training also speeds growth and
 * softens decline, so a trained driver keeps their peak longer. Each stat also moves by a small
 * random amount, drawn from the given stream.
 */
export function develop(
  rng: RandomStream,
  stats: DriverStats,
  potential: number,
  age: number,
  options: DevelopOptions = {},
): DriverStats {
  const p = seasonBalance.progression;
  const curve = options.curve ?? AVERAGE_CURVE;
  const base = trainingLevel(options.training ?? 0);
  const lift = 1 + (options.trainingBoost ?? 0);
  const train = {
    ...base,
    growth: base.growth * lift,
    decline: Math.min(0.95, base.decline * lift),
  };
  const next = { ...stats };
  for (const key of DEVELOPING_STATS) {
    let delta = rng.normal(0, p.noise);
    const delay = isJudgement(key) ? p.judgementPeakDelay : 0;
    const growthEnd = curve.growthEnd + delay;
    const declineStart = curve.declineStart + delay;
    // Growth fades in a straight line over the taper years after the growth age.
    const growing = clamp(1 - (age - growthEnd) / p.taperYears, 0, 1);
    const ceiling = potential + train.overshoot;
    if (growing > 0) {
      const boost = curve.growthRate * growing * (1 + train.growth);
      if (key === 'pace') {
        delta += Math.max(0, ceiling - stats.pace) * p.paceGainShare * boost;
      } else {
        const over = Math.max(0, stats[key] - ceiling);
        delta += p.statGain * boost * clamp(1 - over / p.softBand, 0, 1);
      }
    }
    if (age >= declineStart) {
      const years = age - declineStart + 1;
      delta -=
        p.declinePerYear *
        years *
        curve.declineRate *
        (isJudgement(key) ? 0.5 : 1) *
        (1 - train.decline);
    }
    const cap = key === 'pace' ? Math.min(p.max, ceiling) : p.max;
    next[key] = Math.round(clamp(stats[key] + delta, p.min, Math.max(cap, stats[key])));
  }
  return next;
}

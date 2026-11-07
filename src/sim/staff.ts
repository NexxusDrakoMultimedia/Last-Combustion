// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { personName } from './worldgen/names';
import { staffBalance } from './worldgen/data';

/** A mechanic who could be hired. */
export interface MechanicOffer {
  name: string;
  /** How good they are, 0 to 100. */
  skill: number;
  /** What they ask each week. */
  wagePerWeek: number;
}

/** A mechanic's weekly wage from their skill: $300 plus $4 a point, so $500 for a middling 50. */
export function wageFor(skill: number): number {
  return Math.round(staffBalance.wageBase + staffBalance.wagePerSkill * skill);
}

/** What a mechanic is paid for one round: a year's wages shared over the season's rounds. */
export function wagePerRound(wagePerWeek: number): number {
  return Math.round((wagePerWeek * staffBalance.weeksPerYear) / staffBalance.roundsPerSeason);
}

/** The mechanics on offer, drawn from a stream: four with different skill and the wage that goes with it. */
export function mechanicOffers(rng: RandomStream): MechanicOffer[] {
  const [lo, hi] = staffBalance.skill as [number, number];
  return Array.from({ length: staffBalance.candidates }, () => {
    const skill = rng.int(lo, hi);
    return {
      name: personName(rng, 'AU', rng.chance(0.5) ? 'male' : 'female'),
      skill,
      wagePerWeek: wageFor(skill),
    };
  });
}

/**
 * How well the crew covers the garage's entries: the mechanics' skill added up (as shares of a
 * full-skill mechanic) per entry, never more than 1 (a little more with workshop bays). One expert
 * per entry is a full crew.
 */
export function crewStrength(skills: readonly number[], entries: number, lift = 0): number {
  if (entries <= 0) return 0;
  const total = skills.reduce((sum, s) => sum + Math.max(0, Math.min(100, s)) / 100, 0);
  // Workshop bays lift the cover, and the most it can reach, by the same share.
  return Math.min(1 + lift, (total / entries) * (1 + lift));
}

/** What multiplies a car's part wear: a full crew saves a quarter of it. */
export function partWearFactor(strength: number): number {
  return 1 - staffBalance.maxPartWearSaving * strength;
}

/** What multiplies the bill for crash repairs: a full crew saves a fifth of it. */
export function repairFactor(strength: number): number {
  return 1 - staffBalance.maxRepairSaving * strength;
}

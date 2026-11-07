// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { moraleBalance } from './worldgen/data';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export interface MoraleFactors {
  /** What they are paid, against what the market pays for their skill (1 is the market). */
  pay: number;
  /** How the garage did, from 0 (last) to 1 (champion). */
  results: number;
  /** The facility levels the garage holds. */
  facilityLevels: number;
  /** For a mechanic: the mechanics the garage has for each entry (1 or more is enough); otherwise 1. */
  cover?: number;
}

/** The morale a person settles towards, from 0 to 100. */
export function moraleTarget(f: MoraleFactors): number {
  const c = moraleBalance;
  const pay = clamp((f.pay - 1) * 2 * c.pay, -c.pay, c.pay);
  const results = (clamp(f.results, 0, 1) - 0.5) * 2 * c.results;
  const facilities = Math.min(c.facilities, f.facilityLevels * c.perFacilityLevel);
  const workload = f.cover === undefined ? 0 : -(1 - clamp(f.cover, 0, 1)) * c.workload;
  return clamp(Math.round(c.start + pay + results + facilities + workload), 0, 100);
}

/** Morale after a season: it moves part of the way to its target. */
export function stepMorale(current: number, target: number): number {
  return clamp(Math.round(current + (target - current) * moraleBalance.step), 0, 100);
}

/** What morale does to a person's work: a few points better when high, worse when low. */
export const moraleFactor = (morale: number): number =>
  1 + ((clamp(morale, 0, 100) - 50) / 50) * moraleBalance.performance;

/** The chance that a mechanic with this morale leaves at the end of the year. */
export const quitChance = (morale: number): number =>
  morale >= moraleBalance.quitBelow
    ? 0
    : Math.min(1, (moraleBalance.quitBelow - morale) * moraleBalance.quitPerPoint);

export type MoraleBand = 'low' | 'poor' | 'fair' | 'good' | 'high';

/** The word for a morale. */
export function moraleBand(morale: number): MoraleBand {
  if (morale < 25) return 'low';
  if (morale < 45) return 'poor';
  if (morale < 65) return 'fair';
  if (morale < 85) return 'good';
  return 'high';
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { juniorBalance } from './worldgen/data';

/** Power in kilowatts for a power in PS (metric horsepower). */
export const psToKw = (ps: number): number => ps * juniorBalance.kwPerPs;

/** Power in PS for a power in kilowatts. */
export const kwToPs = (kw: number): number => kw / juniorBalance.kwPerPs;

/** The Junior Series power cap, in kilowatts. */
export const JUNIOR_POWER_CAP_KW: number = juniorBalance.powerCapKw;

/** Whether a car may race in the Junior Series without an intake restrictor. */
export const isJuniorLegal = (ps: number): boolean => psToKw(ps) <= JUNIOR_POWER_CAP_KW;

/** The power a car makes once a restrictor limits it to the Junior cap, in PS. */
export const restrictedPs = (ps: number): number => Math.min(ps, kwToPs(JUNIOR_POWER_CAP_KW));

/** A driver's age in whole years on a date (both as ISO dates). */
export function ageOn(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export interface JuniorCandidate {
  birthDate: string;
  /** Whether the driver has ever qualified for a main-series final. */
  qualifiedForFinal: boolean;
  /** Whether the driver has already moved up to the Super Series (after a silver border). */
  promoted: boolean;
  /** Whether the driver has ever scored a point in the Super Series (any of the top 31 in a prelim or the final). */
  scoredSuperPoints: boolean;
}

export interface JuniorEligibility {
  eligible: boolean;
  /** Why not: too old, already reached a final, or already moved up and cannot go back. */
  reasons: ('too_old' | 'reached_final' | 'scored_points' | 'promoted')[];
}

/**
 * Whether a driver may race in the Junior Series in a season. A driver must be 25 or younger on
 * the first of March of the season, must never have qualified for a main-series final or scored a
 * point in the Super Series (so a driver who raced before 2036 can drop down only if they never
 * scored), and cannot move back to Junior once they have moved up to the Super Series.
 */
export function juniorEligibility(driver: JuniorCandidate, seasonYear: number): JuniorEligibility {
  const reasons: JuniorEligibility['reasons'] = [];
  const cutoff = `${seasonYear}-${juniorBalance.ageDate}`;
  if (ageOn(driver.birthDate, cutoff) > juniorBalance.maxAge) reasons.push('too_old');
  if (driver.qualifiedForFinal) reasons.push('reached_final');
  if (driver.scoredSuperPoints) reasons.push('scored_points');
  if (driver.promoted) reasons.push('promoted');
  return { eligible: reasons.length === 0, reasons };
}

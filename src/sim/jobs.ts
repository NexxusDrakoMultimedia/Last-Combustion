// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { jobsBalance } from './worldgen/data';

/** Why someone left a garage. A retirement or a death is final; the others send them back to the market. */
export type LeaveReason =
  'fired' | 'quit' | 'dismissed' | 'contract' | 'poached' | 'retired' | 'died';

export type JobKind = 'mechanic' | 'executive';

/** The age at which someone in a job retires whatever else has happened. */
export const retireAgeFor = (kind: JobKind): number =>
  kind === 'mechanic' ? jobsBalance.mechanicRetireAge : jobsBalance.executiveRetireAge;

/**
 * Whether someone who left a garage is still on the job market: they have not retired or died or been
 * poached, they
 * are under the retirement age for their job, and they have been out of work for fewer than the two
 * full seasons the balance data allows (someone who left in 2031 is out of work for all of 2032 and
 * 2033, and is retired when 2034 begins).
 */
export function onMarket(
  kind: JobKind,
  p: { reason: string | null; leftYear: number; age: number },
  year: number,
): boolean {
  // Someone poached has a job with a rival, so they are not looking.
  if (p.reason === 'retired' || p.reason === 'died' || p.reason === 'poached') return false;
  if (p.age >= retireAgeFor(kind)) return false;
  return year - p.leftYear <= jobsBalance.unemployedSeasons;
}

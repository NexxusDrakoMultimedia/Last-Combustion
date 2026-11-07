// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { addDays } from './worldgen/calendar';
import { socialData } from './worldgen/data';

export type OccasionId = (typeof socialData.occasions)[number]['id'];
export type Manner = keyof typeof socialData.manners;
export const MANNERS = Object.keys(socialData.manners) as Manner[];
export const CONVERSATIONS = socialData.conversations;

export interface OccasionDate {
  id: OccasionId;
  /** The first day it is open. */
  date: string;
  /** How many days it stays open. */
  days: number;
}

interface OccasionRule {
  id: string;
  on?: string;
  afterFinal?: number;
  plusDays?: number;
  days: number;
}

/**
 * The season's occasions with their dates: some on a day of the year, some a few days after a
 * round's final (so they fall in the gap before the next round). `finals` gives each round's final date.
 */
export function occasionSchedule(
  year: number,
  finals: Readonly<Record<number, string>>,
): OccasionDate[] {
  const out: OccasionDate[] = [];
  for (const o of socialData.occasions as OccasionRule[]) {
    let date: string | undefined;
    if (o.on) date = `${year}-${o.on}`;
    else if (o.afterFinal !== undefined && finals[o.afterFinal])
      date = addDays(finals[o.afterFinal]!, o.plusDays ?? 0);
    if (date) out.push({ id: o.id as OccasionId, date, days: o.days });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The last day an occasion is open. */
export const occasionEnd = (o: OccasionDate): string => addDays(o.date, o.days - 1);

/** The occasion open on a date, if any. */
export function occasionOn(schedule: readonly OccasionDate[], today: string): OccasionDate | null {
  return schedule.find((o) => o.date <= today && today <= occasionEnd(o)) ?? null;
}

/** The next occasion that starts after a date. */
export function nextOccasion(
  schedule: readonly OccasionDate[],
  today: string,
): OccasionDate | null {
  return schedule.find((o) => o.date > today) ?? null;
}

export interface Outcome {
  /** Points the relationship moves. */
  delta: number;
  /** A bold approach that went wrong. */
  trouble: boolean;
  /** Someone else is introduced as well. */
  introduces: boolean;
}

/** How a conversation in some manner goes, from a stream. */
export function converseOutcome(rng: RandomStream, manner: Manner): Outcome {
  const m = socialData.manners[manner];
  if (m.goesWrong > 0 && rng.chance(m.goesWrong)) {
    const [lo, hi] = m.trouble as [number, number];
    return { delta: rng.int(lo, hi), trouble: true, introduces: false };
  }
  const [lo, hi] = m.delta as [number, number];
  return {
    delta: rng.int(lo, hi),
    trouble: false,
    introduces: m.introduces > 0 && rng.chance(m.introduces),
  };
}

/** The score a relationship with someone new starts at. */
export const startingScore = (delta: number): number =>
  Math.max(-100, Math.min(100, delta + socialData.newAcquaintance));

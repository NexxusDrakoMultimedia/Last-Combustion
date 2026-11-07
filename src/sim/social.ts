// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { socialData } from './worldgen/data';

export type OccasionId = (typeof socialData.occasions)[number]['id'];
export type Manner = keyof typeof socialData.manners;
export const MANNERS = Object.keys(socialData.manners) as Manner[];
export const CONVERSATIONS = socialData.conversations;

/** The occasion that is open when a season has completed some rounds, if any. */
export function occasionAfter(roundsComplete: number): OccasionId | null {
  return socialData.occasions.find((o) => o.afterRounds === roundsComplete)?.id ?? null;
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

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { commentators, pressData } from './worldgen/data';

export type Taste = 'results' | 'technical' | 'gossip' | 'human_interest';
export type Tone = 'warm' | 'fair' | 'cold';
export type ResultKind = 'win' | 'podium' | 'points' | 'nopoints';

export interface Journalist {
  id: number;
  name: string;
  outlet: string;
  taste: Taste;
}

const focusTaste = pressData.focusTaste as Record<string, Taste>;

/** The garage's press: the fictional journalists, and the four commentators, whose role stands for their outlet. */
export const JOURNALISTS: Journalist[] = [
  ...(pressData.journalists as Journalist[]),
  ...commentators.map((c, i): Journalist => ({
    id: 101 + i,
    name: c.name,
    outlet: c.role,
    taste: focusTaste[c.focus[0] ?? ''] ?? 'results',
  })),
];

export const journalistById = (id: number): Journalist | undefined =>
  JOURNALISTS.find((j) => j.id === id);

/** How a journalist sees the garage, from the relationship score. */
export function toneOf(score: number): Tone {
  if (score >= pressData.warm) return 'warm';
  if (score <= pressData.cold) return 'cold';
  return 'fair';
}

/** The kind of result a garage's best finish makes: a win, a podium, points or none (null if it did not race). */
export function resultKind(bestPosition: number | null, points: number): ResultKind | null {
  if (bestPosition === null) return null;
  if (bestPosition === 1) return 'win';
  if (bestPosition <= 3) return 'podium';
  return points > 0 ? 'points' : 'nopoints';
}

/** The journalist who writes about a result: any of them, the ones with a taste for it more likely. */
export function pickJournalist(rng: RandomStream, kind: ResultKind): Journalist {
  const w = pressData.weights[kind] as Partial<Record<Taste, number>>;
  return rng.weighted(
    JOURNALISTS,
    JOURNALISTS.map((j) => w[j.taste] ?? 1),
  );
}

/**
 * What a headline does to the garage's fans. A warm or cold one wins or loses a fixed number. A fair
 * one reports the result as it is, so a good day wins fans and a bad one loses them.
 */
export const fansFor = (tone: Tone, kind: ResultKind): number =>
  tone === 'fair' ? pressData.fans.fair[kind] : pressData.fans[tone];

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { JOURNALISTS, type Journalist, type Taste } from './press';
import type { RandomStream } from './rng';
import { pressData } from './worldgen/data';

/** What a piece of world news is about. */
export type NewsKind = 'winner' | 'crash' | 'rivalry' | 'story';

/** A crash in a round that might make the highlight reel. */
export interface CrashCandidate {
  entryId: number;
  scope: 'prelim' | 'final';
  /** What the crash costs to repair (3% of the car's new price). */
  repair: number;
}

const news = pressData.news;

/** A crash in a final always makes the reel; a prelim crash needs a dear enough repair bill. */
export function isHighlight(scope: 'prelim' | 'final', repair: number): boolean {
  return scope === 'final' || repair >= news.highlights.minRepair;
}

/** The round's highlights: the dearest crashes that qualify, ties by the lower entry id, up to the cap. */
export function pickHighlights(
  candidates: CrashCandidate[],
  cap = news.highlights.cap,
): CrashCandidate[] {
  return candidates
    .filter((c) => isHighlight(c.scope, c.repair))
    .sort((a, b) => b.repair - a.repair || a.entryId - b.entryId)
    .slice(0, cap);
}

/** The fans a highlight gives the driver, a share of the series audience. */
export const highlightFans = (audience: number): number =>
  Math.round(audience * news.highlights.fans);

/** The reputation points a highlight costs the driver (a negative number). */
export const highlightReputation = (): number => news.highlights.reputation;

/** How many items of a kind a round may write. */
export const newsCap = (kind: NewsKind): number => news.cap[kind];

/** The journalist who writes an item: any of them, those with a taste for the kind more likely. */
export function pickNewsJournalist(rng: RandomStream, kind: NewsKind): Journalist {
  const w = news.weights[kind] as Partial<Record<Taste, number>>;
  return rng.weighted(
    JOURNALISTS,
    JOURNALISTS.map((j) => w[j.taste] ?? 1),
  );
}

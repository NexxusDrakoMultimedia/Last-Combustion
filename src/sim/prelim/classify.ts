// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { pointsTables, simBalance } from '../worldgen/data';

export interface RunOutcome {
  entryId: number;
  day: number;
  slot: number;
  timeMs: number | null;
  dnfReason: 'crash' | null;
}

export interface Classified extends RunOutcome {
  /** 1-based position among those who set a time, or null for a run that ended. */
  position: number | null;
  /** Points scored from the prelim. Only positions below the final score from the prelims. */
  points: number;
  pole: boolean;
  /** Whether the entry starts the final. */
  qualifies: boolean;
}

/**
 * Classifies the prelims (see the GDD, "Points system"): the fastest times set the order,
 * the top finalists qualify for the final, and positions from just below the final down to
 * 31st score points. The finalists score from the final instead.
 */
export function classifyPrelims(
  outcomes: readonly RunOutcome[],
  finalSize: number,
  era: keyof typeof pointsTables = 'original',
): Classified[] {
  const table = pointsTables[era] as number[];
  const finishers = outcomes
    .filter((o): o is RunOutcome & { timeMs: number } => o.timeMs !== null)
    .sort((a, b) => a.timeMs - b.timeMs || a.day - b.day || a.slot - b.slot);
  const position = new Map(finishers.map((o, i) => [o.entryId, i + 1]));
  return outcomes
    .map((o) => {
      const pos = position.get(o.entryId) ?? null;
      return {
        ...o,
        position: pos,
        points: pos !== null && pos > finalSize ? (table[pos - 1] ?? 0) : 0,
        pole: pos === 1,
        qualifies: pos !== null && pos <= finalSize,
      };
    })
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.entryId - b.entryId);
}

export const POLE_BONUS = (): number => simBalance.pole.bonus;

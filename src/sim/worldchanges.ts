// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import flagsJson from '../../data/flags.json';
import { createRng } from './rng';

export interface WorldChange {
  id: string;
  stream: string;
  chance: number;
  /** Events that must have happened first (this one cannot come before them). */
  after?: string[];
  /** A gate that must have opened for this event to be possible at all. */
  gate?: string;
  from: string;
  to: string;
  regions: string[];
  also?: { regions: string[]; to: string }[];
  /** A flag that stops being used when this happens. */
  retires?: string;
}

interface WorldChangeData {
  windowStart: number;
  windowEnd: number;
  gates: { id: string; stream: string; chance: number }[];
  events: WorldChange[];
  unionNames: { flag: string; byDone: Record<string, string> };
}

export const worldChangeData = flagsJson.worldChanges as WorldChangeData;

/**
 * Which year each world change happens in this career (null if it never does). Each event has
 * its own named stream, so one result never depends on another's draws, and the player is never told
 * the years in advance. An event with prerequisites comes in the same year as the last of them or later.
 */
export function planWorldChanges(masterSeed: string): Map<string, number | null> {
  const rng = createRng(masterSeed);
  const { windowStart, windowEnd, gates, events } = worldChangeData;
  const open = new Map(gates.map((g) => [g.id, rng.stream(g.stream).chance(g.chance)]));
  const plan = new Map<string, number | null>();
  for (const event of events) {
    const stream = rng.stream(event.stream);
    const happens = stream.chance(event.chance);
    const year = stream.int(windowStart, windowEnd);
    const before = (event.after ?? []).map((id) => plan.get(id) ?? null);
    const possible = (!event.gate || open.get(event.gate) === true) && !before.includes(null);
    if (!happens || !possible) {
      plan.set(event.id, null);
      continue;
    }
    plan.set(event.id, Math.max(year, ...(before as number[])));
  }
  return plan;
}

/** The long name of the union flag once the given events have happened. */
export function unionLongName(done: ReadonlySet<string>): string {
  const key = [...done]
    .filter((id) => id === 'northern-ireland' || id === 'scotland')
    .sort()
    .join('+');
  return worldChangeData.unionNames.byDone[key] ?? worldChangeData.unionNames.byDone['']!;
}

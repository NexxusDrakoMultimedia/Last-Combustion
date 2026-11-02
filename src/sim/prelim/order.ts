// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';

export interface RunSlot {
  entryId: number;
  /** 1 to 7. */
  day: number;
  /** 0-based position within the day. */
  slot: number;
}

/**
 * The running order for the prelims (see the GDD, "Weekend format"). Entries with
 * championship points are spread evenly through the order across all the days; everyone else
 * is placed by random draw.
 */
export function buildRunningOrder(
  entries: readonly { entryId: number; points: number }[],
  days: number,
  rng: RandomStream,
): RunSlot[] {
  const sizes = Array.from(
    { length: days },
    (_, d) => Math.floor(entries.length / days) + (d < entries.length % days ? 1 : 0),
  );
  const pointed = rng.shuffle(entries.filter((e) => e.points > 0));
  const others = rng.shuffle(entries.filter((e) => e.points <= 0));

  // Deal the entries with points out round-robin so every day gets its share.
  const perDay: number[][] = Array.from({ length: days }, () => []);
  pointed.forEach((e, i) => perDay[i % days]?.push(e.entryId));
  const result: RunSlot[] = [];
  let next = 0;
  for (let d = 0; d < days; d++) {
    const mine = perDay[d] as number[];
    const need = (sizes[d] as number) - mine.length;
    const fill = others.slice(next, next + need).map((e) => e.entryId);
    next += need;
    const slots: (number | undefined)[] = new Array(sizes[d]).fill(undefined);
    // Evenly spaced slots for the entries with points.
    mine.forEach((id, i) => {
      slots[Math.floor(((i + 0.5) * (sizes[d] as number)) / mine.length)] = id;
    });
    let f = 0;
    for (let s = 0; s < slots.length; s++) {
      if (slots[s] === undefined) slots[s] = fill[f++];
    }
    slots.forEach((id, s) => {
      if (id !== undefined) result.push({ entryId: id, day: d + 1, slot: s });
    });
  }
  return result;
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { rivalryBalance } from './worldgen/data';

export type RivalryLevel = 'none' | 'spark' | 'rivalry' | 'feud' | 'legendary';

/** A pair of drivers, stored with the lower id first. */
export interface Pair {
  a: number;
  b: number;
}

const pairOf = (x: number, y: number): Pair => (x < y ? { a: x, b: y } : { a: y, b: x });

/** The level a heat score reaches. A Feud becomes Legendary after enough seasons of history. */
export function levelFor(heat: number, seasonsOfHistory: number): RivalryLevel {
  const l = rivalryBalance.levels;
  if (heat >= l.feud)
    return seasonsOfHistory >= rivalryBalance.legendarySeasons ? 'legendary' : 'feud';
  if (heat >= l.rivalry) return 'rivalry';
  if (heat >= l.spark) return 'spark';
  return 'none';
}

/** Heat after one round of cooling. */
export function decayHeat(heat: number): number {
  return Math.max(0, heat * (1 - rivalryBalance.decay));
}

/** What a rivalry does to the fans a driver wins in a final the rival also races. */
export function fanMultiplier(level: RivalryLevel): number {
  return rivalryBalance.fanMultipliers[level];
}

/** Adjacent finishers (in finishing order) who crossed the line within the close-finish gap. */
export function closeFinishPairs(finishers: { driverId: number; timeMs: number | null }[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 1; i < finishers.length; i++) {
    const ahead = finishers[i - 1]!;
    const behind = finishers[i]!;
    if (ahead.timeMs === null || behind.timeMs === null) continue;
    if (behind.timeMs - ahead.timeMs <= rivalryBalance.gains.closeFinishMs)
      pairs.push(pairOf(ahead.driverId, behind.driverId));
  }
  return pairs;
}

/** The title leaders as a pair, if both of them raced the final. */
export function titleFightPair(top: [number, number] | null, finalists: number[]): Pair | null {
  if (!top || !finalists.includes(top[0]) || !finalists.includes(top[1])) return null;
  return pairOf(top[0], top[1]);
}

/**
 * Whether a pair that has reached Spark may go live for a driver who already has `liveHeats`
 * live rivalries: it is added under the cap, displaces the coolest one if it is hotter, and is
 * refused otherwise.
 */
export function settleCap(
  liveHeats: number[],
  candidateHeat: number,
  cap: number,
): 'add' | 'displace' | 'refuse' {
  if (liveHeats.length < cap) return 'add';
  return candidateHeat > Math.min(...liveHeats) ? 'displace' : 'refuse';
}

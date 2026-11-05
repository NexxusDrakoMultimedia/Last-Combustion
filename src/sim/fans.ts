// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { fanBalance } from './worldgen/data';

/** What a driver did in a round that fans notice. */
export interface FanMoment {
  /** Final position (1 is the winner), or null if the driver was not in the final. */
  finalPos: number | null;
  /** Championship points the driver scored in the round. */
  points: number;
  pole: boolean;
  overtakes: number;
  /** The round was held in the driver's home state. */
  home: boolean;
}

/** The fans a driver gains from a round: shares of the series audience `S` (see the GDD, "Fans"). */
export function driverFanGain(audience: number, m: FanMoment): number {
  const g = fanBalance.gains;
  let share = 0;
  if (m.finalPos === 1) share += g.win;
  else if (m.finalPos !== null && m.finalPos <= 3) share += g.podium;
  else if (m.finalPos !== null) share += g.finalRest;
  else if (m.points > 0) share += g.pointsScorer;
  if (m.pole) share += g.pole;
  share += m.overtakes * g.overtake;
  const gain = audience * share;
  return Math.round(m.home ? gain * g.hometownMultiplier : gain);
}

/** Keeps one subject's fans under its share of the series audience. */
export function capFans(fans: number, audience: number): number {
  return Math.min(Math.round(fans), Math.round(audience * fanBalance.capShare));
}

/** How much the series audience grows when it enters a season: 25% a year at first, then 8%, plus 1% for the festival. */
export function seriesGrowth(year: number): number {
  const s = fanBalance.series;
  const early = year - s.firstYear <= s.earlyYears;
  return (early ? s.earlyGrowth : s.lateGrowth) + s.festivalGrowth;
}

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
  /** How many attention flags the driver raised in the round. */
  attention?: number;
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
  share += (m.attention ?? 0) * g.attention;
  const gain = audience * share;
  return Math.round(m.home ? gain * g.hometownMultiplier : gain);
}

/** Keeps one subject's fans under its share of the series audience. */
export function capFans(fans: number, audience: number): number {
  return Math.min(Math.round(fans), Math.round(audience * fanBalance.capShare));
}

/** What happened in a season that the audience talks about, read from its results by the database. */
export interface SeasonStory {
  /** The points gap between the top two drivers as a share of the leader's points, or null with no table. */
  titleGapShare: number | null;
  /** Rounds that were run. */
  rounds: number;
  /** Different drivers who won a final. */
  winners: number;
  /** Live rivalries weighed by level (Spark 1, Rivalry 2, Feud 3, Legendary 4). */
  rivalryPoints: number;
}

/**
 * The buzz a season leaves behind, as extra growth for the series audience: a title race that went to
 * the wire, a different winner in most rounds and live rivalries, plus half of the season before's buzz
 * (word of mouth, so a good year keeps paying off for a while). Never more than the ceiling.
 */
export function seasonBuzz(story: SeasonStory, previousBuzz = 0): number {
  const b = fanBalance.series.buzz;
  const race =
    story.titleGapShare === null
      ? 0
      : b.titleRace * (1 - Math.min(story.titleGapShare / b.closeTitleGap, 1));
  const variety =
    story.rounds > 0 ? b.winnerVariety * Math.min(story.winners / story.rounds, 1) : 0;
  const rivalry = Math.min(b.rivalryCap, story.rivalryPoints * b.rivalryPoint);
  return Math.min(b.ceiling, Math.max(0, race + variety + rivalry + b.wordOfMouth * previousBuzz));
}

/**
 * How much the series audience grows when it enters a season: 25% a year at first, then 8%, plus 1% for
 * the festival, 0.5% for each attention flag raised in the season that has just ended, and the buzz.
 */
export function seriesGrowth(year: number, attentionFlags = 0, buzz = 0): number {
  const s = fanBalance.series;
  const early = year - s.firstYear <= s.earlyYears;
  return (
    (early ? s.earlyGrowth : s.lateGrowth) +
    s.festivalGrowth +
    attentionFlags * s.attentionGrowth +
    buzz
  );
}

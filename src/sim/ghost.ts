// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { ghostBalance } from './worldgen/data';

/** Easy runs two seconds ahead of the driver; Hard recreates a driver's run from last year. */
export type GhostMode = 'easy' | 'hard';

/** What a driver did last season on this course: their points for the season and their prelim time. */
export interface LastYearRun {
  driverId: number;
  points: number;
  /** The driver's prelim time on this course last season, or null if the run ended without one. */
  timeMs: number | null;
}

/** A ghost to race against: a driver from last year and the time they set on this course. */
export interface GhostCandidate {
  driverId: number;
  points: number;
  timeMs: number;
}

/**
 * The ghosts on offer (see the GDD, "Ghost record"): last year's top drivers by points (ties by the
 * lower driver id) who set a time on this course, up to five. There are none in the first season.
 */
export function ghostCandidates(runs: LastYearRun[]): GhostCandidate[] {
  return runs
    .filter((r): r is LastYearRun & { timeMs: number } => r.timeMs !== null)
    .sort((a, b) => b.points - a.points || a.driverId - b.driverId)
    .slice(0, ghostBalance.candidates)
    .map((r) => ({ driverId: r.driverId, points: r.points, timeMs: r.timeMs }));
}

/**
 * How a run went against a ghost: beaten when the run was faster, and by how much (positive when the run
 * was faster, negative when the ghost was). A run that ended without a time does not beat it.
 */
export function settleGhost(
  ownMs: number | null,
  ghostMs: number,
): { beaten: boolean; deltaMs: number | null } {
  if (ownMs === null) return { beaten: false, deltaMs: null };
  return { beaten: ownMs < ghostMs, deltaMs: ghostMs - ownMs };
}

/** The Easy ghost's time: two seconds ahead of the run (nothing if the run has no time). */
export const easyGhostMs = (ownMs: number | null): number | null =>
  ownMs === null ? null : ownMs - ghostBalance.easyLeadMs;

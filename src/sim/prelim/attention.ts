// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Sector } from '../courses/sectors';
import { simBalance } from '../worldgen/data';
import { carRatings, sectorFit, type CarSpec } from './ratings';

/**
 * One timed run, with what the car alone should have managed. The prediction leaves out the driver
 * and the luck of the run: it is the car's power, weight and tyres on this road in the day's conditions.
 */
export interface AttentionRun {
  entryId: number;
  predictedMs: number;
  /** The run's time, or null if it ended in a crash (a crash cannot be flagged). */
  actualMs: number | null;
  /** For each sector, how much faster than predicted the run was (negative is slower). */
  sectorGainMs: number[];
}

export interface AttentionFlag {
  entryId: number;
  /** How many standard deviations above the field's average gain this run was. */
  z: number;
  /** How much faster than predicted the run was, in milliseconds. */
  gainMs: number;
  /** The sector where the run gained the most on its prediction. */
  sector: number;
}

/** The time each sector should take for this car on this road, in milliseconds, with no driver in it. */
export function predictedSectorMs(
  car: CarSpec,
  sectors: readonly Sector[],
  altitudeM: number,
  dayTemperatureBias: number,
): number[] {
  const ratings = carRatings(car, altitudeM);
  return sectors.map((sector) => {
    const fit = sectorFit(ratings, sector);
    return Math.round(
      sector.refSeconds * (1 - simBalance.kc * (fit - 0.5)) * (1 + dayTemperatureBias) * 1000,
    );
  });
}

/**
 * The runs the series' computer would flag (see the GDD, "Attention flags"): each run's gain on its
 * predicted time is compared with the rest of the field, and a run whose gain is at least the
 * threshold in standard deviations above the field's average is flagged. The comparison is made over
 * the whole run (the sector gains add up), which keeps a flag to once or twice a round; the sector where
 * the driver gained most is reported. Best first.
 */
export function attentionFlags(
  runs: readonly AttentionRun[],
  threshold: number = simBalance.attention.zThreshold,
): AttentionFlag[] {
  const timed = runs.filter((r): r is AttentionRun & { actualMs: number } => r.actualMs !== null);
  if (timed.length < 3) return [];
  const gains = timed.map((r) => r.predictedMs - r.actualMs);
  const mean = gains.reduce((a, b) => a + b, 0) / gains.length;
  const sd = Math.sqrt(gains.reduce((a, g) => a + (g - mean) ** 2, 0) / gains.length);
  if (sd === 0) return [];
  const flags: AttentionFlag[] = [];
  timed.forEach((run, i) => {
    const z = ((gains[i] as number) - mean) / sd;
    if (z < threshold) return;
    let sector = 0;
    run.sectorGainMs.forEach((g, s) => {
      if (g > (run.sectorGainMs[sector] as number)) sector = s;
    });
    flags.push({
      entryId: run.entryId,
      z: Math.round(z * 100) / 100,
      gainMs: gains[i] as number,
      sector,
    });
  });
  return flags.sort((a, b) => b.z - a.z || a.entryId - b.entryId);
}

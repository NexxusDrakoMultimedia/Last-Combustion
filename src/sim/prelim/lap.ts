// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import type { Sector } from '../courses/sectors';
import { simBalance } from '../worldgen/data';
import type { Driver, RoadType } from '../worldgen/types';
import { clamp } from '../worldgen/rating';
import { carRatings, sectorFit, type CarSpec } from './ratings';

const cfg = simBalance;

export type IncidentKind = 'mistake' | 'spin' | 'crash' | 'wildlife';

export interface LapIncident {
  kind: IncidentKind;
  /** Distance along the lap, in km. */
  km: number;
  sector: number;
  secondsLost: number;
}

export interface LapResult {
  /** Lap time in milliseconds, or null if the run ended in a crash. */
  timeMs: number | null;
  sectorMs: number[];
  incidents: LapIncident[];
  dnfReason: 'crash' | null;
}

export interface LapConditions {
  /** Shared by the whole day, as a fraction of sector time (positive is slower). */
  dayTemperatureBias: number;
}

/** The driver's rating on a sector, 0-1: pace, affinity with the road, and composure. */
export function driverSectorRating(driver: Driver, roadType: RoadType, night: boolean): number {
  const w = cfg.driverWeights;
  const affinity = driver.affinities[night ? 'night' : roadType];
  return (w.pace * driver.pace + w.affinity * affinity + w.composure * driver.composure) / 100;
}

/**
 * Simulates one prelim lap (see the GDD, "Formulas" and "Weekend format"). A single fresh
 * tyre set is used, so tyre wear does not matter here.
 */
export function simulateLap(
  driver: Driver,
  car: CarSpec,
  sectors: readonly Sector[],
  altitudeM: number,
  night: boolean,
  conditions: LapConditions,
  rng: RandomStream,
): LapResult {
  const ratings = carRatings(car, altitudeM);
  const runTemperature = clamp(rng.normal(0, cfg.temp.runSd), -cfg.temp.max, cfg.temp.max);
  const sigma = (cfg.noisePct / 100) * 100 * (1 - driver.consistency / 150);
  const sectorMs: number[] = [];
  const incidents: LapIncident[] = [];
  const wildlifeSector = rng.chance(cfg.incident.wildlifeChancePerRun)
    ? rng.int(0, sectors.length - 1)
    : -1;
  let total = 0;

  for (const sector of sectors) {
    const fit = sectorFit(ratings, sector);
    const rating = driverSectorRating(driver, sector.roadType, night);
    let seconds =
      sector.refSeconds *
      (1 - cfg.kc * (fit - 0.5)) *
      (1 - cfg.kd * (rating - 0.5)) *
      (1 + runTemperature + conditions.dayTemperatureBias) *
      (1 + rng.normal(0, sigma / 100));

    const pIncident =
      cfg.incident.pBase *
      (1 + cfg.prelimAggression) *
      (1 + car.wear / 100) *
      (1 - driver.composure / 200);
    if (rng.chance(pIncident)) {
      const roll = rng.next();
      let kind: IncidentKind;
      let lost = 0;
      if (roll < cfg.incident.mistakeShare) {
        kind = 'mistake';
        lost = rng.float(
          cfg.incident.mistakeSeconds[0] as number,
          cfg.incident.mistakeSeconds[1] as number,
        );
      } else if (roll < cfg.incident.mistakeShare + cfg.incident.spinShare) {
        kind = 'spin';
        lost = rng.float(
          cfg.incident.spinSeconds[0] as number,
          cfg.incident.spinSeconds[1] as number,
        );
      } else {
        kind = 'crash';
      }
      incidents.push({
        kind,
        km: sector.startKm + sector.lengthM / 2000,
        sector: sector.order,
        secondsLost: lost,
      });
      if (kind === 'crash') {
        return { timeMs: null, sectorMs, incidents, dnfReason: 'crash' };
      }
      seconds += lost;
    }
    if (sector.order === wildlifeSector) {
      const lost =
        rng.float(
          cfg.incident.wildlifeSeconds[0] as number,
          cfg.incident.wildlifeSeconds[1] as number,
        ) *
        (1 - driver.composure / 150);
      incidents.push({
        kind: 'wildlife',
        km: sector.startKm + sector.lengthM / 2000,
        sector: sector.order,
        secondsLost: lost,
      });
      seconds += lost;
    }
    const ms = Math.round(seconds * 1000);
    sectorMs.push(ms);
    total += ms;
  }
  return { timeMs: total, sectorMs, incidents, dnfReason: null };
}

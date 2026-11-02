// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { simBalance } from '../worldgen/data';
import type { Layout } from '../worldgen/types';
import { clamp } from '../worldgen/rating';
import type { Sector } from '../courses/sectors';

/** The four ratings of a car, each 0-1 against the range of cars in the series. */
export interface CarRatings {
  power: number;
  grip: number;
  handling: number;
  traction: number;
}

export interface CarSpec {
  ps: number;
  kerbKg: number;
  tyreWidthMm: number;
  layout: Layout;
  /** 0 is new, 100 is worn out. */
  wear: number;
  /** Rating changes from fitted parts (see `fitParts`). */
  bonus?: { grip: number; handling: number; traction: number };
}

const cfg = simBalance;
const unit = (value: number, min: number, max: number): number =>
  clamp((value - min) / (max - min), 0, 1);

/**
 * Car ratings (see the GDD, "Formulas"). Power is power-to-weight, with a loss at altitude
 * (applied per sector). Grip and handling reward a light car with wide tyres, which is the
 * Equalizer's point. Everything fades a little with chassis wear.
 */
export function carRatings(car: CarSpec, altitudeM = 0): CarRatings {
  const pw = (car.ps / car.kerbKg) * (1 - (cfg.altitudeLossPer100m * altitudeM) / 100);
  const wearFactor = 1 - cfg.wearPenaltyPerPoint * car.wear;
  const width = unit(car.tyreWidthMm, cfg.tyreMm.min, cfg.tyreMm.max);
  const gripPerKg = unit(car.tyreWidthMm / car.kerbKg, cfg.gripPerKg.min, cfg.gripPerKg.max);
  const lightness = unit(1 - (car.kerbKg - 650) / 1500, 0, 1);
  const bonus = car.bonus ?? { grip: 0, handling: 0, traction: 0 };
  return {
    power: unit(pw, cfg.powerToWeight.min, cfg.powerToWeight.max) * wearFactor,
    grip: clamp((0.25 + 0.75 * gripPerKg + bonus.grip) * wearFactor, 0, 1),
    handling: clamp((0.2 + 0.5 * lightness + 0.3 * gripPerKg + bonus.handling) * wearFactor, 0, 1),
    traction: clamp(
      (0.5 * cfg.layoutTraction[car.layout] + 0.5 * width + bonus.traction) * wearFactor,
      0,
      1,
    ),
  };
}

/** How much each rating matters on a sector (the weights add up to 1). */
export function sectorWeights(sector: Sector): CarRatings {
  const corners = Math.min(1, sector.cornerDensity / 8);
  const straight = Math.min(1, sector.straightM / 1500);
  const climb = Math.min(1, sector.elevationChangeM / 60);
  const raw = {
    power: 0.2 + 0.25 * straight + 0.1 * climb,
    grip: 0.25 + 0.2 * corners,
    handling: 0.2 + 0.15 * corners + (sector.widthM < 6.2 ? 0.05 : 0),
    traction: 0.15 + 0.1 * climb,
  };
  const total = raw.power + raw.grip + raw.handling + raw.traction;
  return {
    power: raw.power / total,
    grip: raw.grip / total,
    handling: raw.handling / total,
    traction: raw.traction / total,
  };
}

/** The car's fit to a sector, 0-1. */
export function sectorFit(ratings: CarRatings, sector: Sector): number {
  const w = sectorWeights(sector);
  return (
    w.power * ratings.power +
    w.grip * ratings.grip +
    w.handling * ratings.handling +
    w.traction * ratings.traction
  );
}

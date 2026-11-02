// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import partsJson from '../../data/parts.json';
import { upkeepFactor } from './economy';
import { equalizerMm } from './equalizer';
import type { Layout, Tier } from './worldgen/types';
import { upgradeBalance } from './worldgen/data';

export type PartCategory =
  | 'engine'
  | 'intake_exhaust'
  | 'forced_induction'
  | 'ecu'
  | 'drivetrain'
  | 'suspension'
  | 'brakes'
  | 'weight_reduction'
  | 'aero'
  | 'wheels';
export type PartGrade = 'street' | 'sport' | 'race';

export interface PartData {
  id: string;
  supplierId: string;
  category: PartCategory;
  grade: PartGrade;
  name: string;
  price: number;
  /** Extra power as a fraction of the model's power (0.09 is +9%). */
  psPct: number;
  deltaKg: number;
  deltaGrip: number;
  deltaHandling: number;
  deltaTraction: number;
  /** Extra tyre width the part allows, in millimetres (the Equalizer still caps it). */
  tyreMm: number;
  /** How much of the road-legality budget the part uses. */
  legalityCost: number;
}

export interface PartSupplier {
  id: string;
  name: string;
  homeCountry: string;
  categories: PartCategory[];
}

export const parts = partsJson.parts as PartData[];
export const partSuppliers = partsJson.suppliers as PartSupplier[];
const byId = new Map(parts.map((p) => [p.id, p]));

/** Looks a part up by its stable id. */
export function part(id: string): PartData {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown part "${id}"`);
  return found;
}

/** The Equalizer: the widest legal tyre for a kerb weight and layout (see the GDD, "Technical regulations"). */
export function maxTyreWidthMm(kerbKg: number, layout?: Layout): number {
  return equalizerMm(kerbKg, layout);
}

/** What a part costs for a car of a tier: supercars cost more to keep up. */
export function partPrice(p: PartData, tier: Tier): number {
  return Math.round(p.price * upkeepFactor(tier));
}

/** The road-legality score: the budget less what the fitted parts use. Below zero is illegal. */
export function legalityScore(fitted: readonly PartData[]): number {
  return upgradeBalance.legalityBudget - fitted.reduce((sum, p) => sum + p.legalityCost, 0);
}

export interface BaseCar {
  ps: number;
  kerbKg: number;
  tyreMm: number;
  /** The drivetrain layout, which sets the Equalizer handicap. */
  layout?: Layout;
}

/** The power and rating changes of a set of fitted parts. */
export function partEffects(fitted: readonly PartData[]): {
  psPct: number;
  bonus: { grip: number; handling: number; traction: number };
} {
  return {
    psPct: fitted.reduce((s, p) => s + p.psPct, 0),
    bonus: {
      grip: fitted.reduce((s, p) => s + p.deltaGrip, 0),
      handling: fitted.reduce((s, p) => s + p.deltaHandling, 0),
      traction: fitted.reduce((s, p) => s + p.deltaTraction, 0),
    },
  };
}

export interface FittedCar {
  ps: number;
  kerbKg: number;
  tyreWidthMm: number;
  bonus: { grip: number; handling: number; traction: number };
}

/**
 * A car's spec with its parts fitted. Weight is added up, power is a percentage of the model's,
 * and the tyre width is the model's plus what the wheels allow, never above the Equalizer.
 */
export function fitParts(base: BaseCar, fitted: readonly PartData[]): FittedCar {
  const kerbKg = base.kerbKg + fitted.reduce((s, p) => s + p.deltaKg, 0);
  const wanted = base.tyreMm + fitted.reduce((s, p) => s + p.tyreMm, 0);
  const effects = partEffects(fitted);
  return {
    ps: Math.round(base.ps * (1 + effects.psPct)),
    kerbKg,
    tyreWidthMm: Math.max(
      upgradeBalance.minTyreMm,
      Math.min(wanted, maxTyreWidthMm(kerbKg, base.layout)),
    ),
    bonus: effects.bonus,
  };
}

export interface ScrutineeringResult {
  legal: boolean;
  /** The reasons a car fails, empty when it passes. */
  failures: ('tyres' | 'legality')[];
}

/** The checks after a run: tyre width against the Equalizer, and road legality at zero or more. */
export function scrutineer(
  kerbKg: number,
  tyreWidthMm: number,
  fitted: readonly PartData[],
  layout?: Layout,
): ScrutineeringResult {
  const failures: ScrutineeringResult['failures'] = [];
  if (tyreWidthMm > maxTyreWidthMm(kerbKg, layout)) failures.push('tyres');
  if (legalityScore(fitted) < 0) failures.push('legality');
  return { legal: failures.length === 0, failures };
}

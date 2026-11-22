// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { penaltyData } from './worldgen/data';

/** The five steps of the series' penalty scale, from the lightest to the heaviest. */
export type PenaltyLevel = 'minor' | 'major' | 'severe' | 'flagrant' | 'egregious';

/**
 * The sixth penalty, above Egregious and very rare: the Palpably Unfair Act. It is not a step on the scale and has
 * no type: it disqualifies the offender from the race, and can keep them out of the next few (up to twelve).
 */
export const PALPABLY_UNFAIR = 'palpably_unfair';
export type PalpablyUnfair = typeof PALPABLY_UNFAIR;

/**
 * What a penalty is for. A penalty is named for its level and its type, as in Major Drone, Severe Technical or
 * Egregious Sportsmanship. More types are added in `data/penalties.json` as more rules need them.
 */
export type PenaltyType = 'drone' | 'technical' | 'sportsmanship';

export const penaltyTypes: readonly PenaltyType[] = penaltyData.types as PenaltyType[];

export interface PenaltyStep {
  id: PenaltyLevel;
  /** The share of the leader's lap time added to a prelim run. */
  prelimPercent: number;
  /** The places lost in a final. */
  places: number;
}

/** The penalty scale in order: Minor, Major, Severe, Flagrant, Egregious; level 1 is Minor, level 5 is Egregious (`data/penalties.json`). */
export const penaltyScale: readonly PenaltyStep[] = penaltyData.levels as PenaltyStep[];

/** The step with this id; refuses an id that is not on the scale. */
export function penaltyStep(id: PenaltyLevel): PenaltyStep {
  const step = penaltyScale.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown penalty level "${id}"`);
  return step;
}

/** Whether a penalty is the Palpably Unfair Act (a disqualification, not a time or places). */
export const isPalpablyUnfair = (level: string): level is PalpablyUnfair =>
  level === PALPABLY_UNFAIR;

/** What a penalty costs a prelim run, in milliseconds: its share of the leader's lap time, rounded. */
export function prelimPenaltyMs(level: PenaltyLevel, leaderMs: number): number {
  return Math.round((leaderMs * penaltyStep(level).prelimPercent) / 100);
}

/** What a penalty costs a car in a final: the places it drops back at the flag. */
export function penaltyPlaces(level: PenaltyLevel): number {
  return penaltyStep(level).places;
}

/**
 * Draws how bad an ignored drone signal was: mostly Minor, rarely Egregious (from `drone.severityWeights`) and,
 * very rarely, a Palpably Unfair Act (`drone.unfairWeight`, a share of the weights' total).
 */
export function drawDroneLevel(rng: RandomStream): PenaltyLevel | PalpablyUnfair {
  const weights = penaltyData.drone.severityWeights;
  const total = weights.reduce((a, b) => a + b, 0) + penaltyData.drone.unfairWeight;
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return penaltyScale[i]!.id;
  }
  return PALPABLY_UNFAIR;
}

/** How many races a Palpably Unfair Act keeps the offender out of after the one it happened in: 0 to 12, mostly few. */
export function drawBanRaces(rng: RandomStream): number {
  const max = penaltyData.unfairAct.maxBanRaces;
  const u = rng.next();
  return Math.min(max, Math.floor((max + 1) * u * u));
}
/**
 * Whether a driver ignores a drone's stop signal this time. The chance is the base chance, raised by how hard the
 * driver is pushing (0 to 1) and lowered by their composure (0 to 100), so a calm driver saving the car almost
 * never does and a rattled one pushing often does.
 */
export function ignoresDrone(
  rng: RandomStream,
  baseChance: number,
  aggression: number,
  composure: number,
): boolean {
  return rng.chance(Math.min(1, baseChance * (1 + aggression) * (1 - composure / 150)));
}

export const dronePrelimChance = (): number => penaltyData.drone.prelimChance;
export const droneFinalChance = (): number => penaltyData.drone.finalChance;

/** The step of the scale a measure falls in, given the upper limit of each of the first four steps (above the last is Egregious). */
function stepFor(value: number, limits: readonly number[]): number {
  const i = limits.findIndex((limit) => value <= limit);
  return i === -1 ? penaltyScale.length - 1 : i;
}

/**
 * The penalty a car's scrutineering earns, or null for a legal car. A small overage is a Technical penalty at the
 * step its size falls in (Minor to Egregious, whichever of the tyres and the road-legality score is worse), and a car
 * that is obviously illegal, over by the "obvious" amounts in `data/penalties.json`, is a Palpably Unfair Act.
 */
export function technicalPenalty(
  tyreOverMm: number,
  legalityShort: number,
): PenaltyLevel | PalpablyUnfair | null {
  const t = penaltyData.technical;
  if (tyreOverMm <= 0 && legalityShort <= 0) return null;
  if (tyreOverMm >= t.obviousTyreOverMm || legalityShort >= t.obviousLegalityShort)
    return PALPABLY_UNFAIR;
  const step = Math.max(
    tyreOverMm > 0 ? stepFor(tyreOverMm, t.tyreOverMm) : 0,
    legalityShort > 0 ? stepFor(legalityShort, t.legalityShort) : 0,
  );
  return penaltyScale[step]!.id;
}

/**
 * How bad a contact was, drawn mostly Minor (`sportsmanship.contactWeights`). Causing contact is a Sportsmanship
 * penalty, which replaces the fixed time penalty it used to carry.
 */
export function drawContactLevel(rng: RandomStream): PenaltyLevel {
  const weights = penaltyData.sportsmanship.contactWeights;
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return penaltyScale[i]!.id;
  }
  return penaltyScale[0]!.id;
}

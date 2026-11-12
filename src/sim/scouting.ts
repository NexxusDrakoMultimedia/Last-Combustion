// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng, type RandomStream } from './rng';
import { scoutingBalance } from './worldgen/data';
import { personName } from './worldgen/names';

/** What a scout looks at by default. */
export type ScoutFocus = 'drivers' | 'cars' | 'garages';

export interface Scout {
  /** 0 to 100. */
  skill: number;
  focus: ScoutFocus;
  /** The subject the scout is assigned to, as `kind:id`, or null. */
  assignedTo: string | null;
}

export interface Subject {
  kind: ScoutFocus;
  id: number;
}

/** The key a subject goes by in assignments and in random streams. */
export const subjectKey = (s: Subject): string => `${s.kind}:${s.id}`;

export type Cover = 'assigned' | 'kind' | 'other';

/** How closely a scout covers a subject: assigned to it, covering its kind, or neither. */
export function coverOf(scout: Scout, subject: Subject): Cover {
  if (scout.assignedTo === subjectKey(subject)) return 'assigned';
  return scout.focus === subject.kind ? 'kind' : 'other';
}

/** A scout's skill once the Head of Scouting has lifted it (`lift` is 0.25 at most, 0 with no head). */
export function scoutSkill(scout: Scout, lift: number): number {
  return Math.min(100, scout.skill * (1 + Math.max(0, lift)));
}

export interface KnowledgeInput {
  subject: Subject;
  scouts: Scout[];
  /** The Head of Scouting's lift to every scout (`executiveBonuses(...).scouts`), 0 with none. */
  scoutLift: number;
  /** Scored finals of the subject in the last three seasons. */
  scoredFinals: number;
  /** The subject's fame, 0 to 100. */
  fame: number;
  /** The player's garage, 0 to 100 each. */
  prestige: number;
  playerFame: number;
  /** Signed or owned now. */
  owned: boolean;
  /** Whole years since the player last worked with the subject, or null if never. */
  yearsSinceWorked: number | null;
  /** An attention flag is on the subject this season. */
  flagged: boolean;
}

export interface KnowledgeParts {
  scouts: number;
  evidence: number;
  visibility: number;
  standing: number;
  experience: number;
  flag: number;
  total: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** The knowledge score of a subject, with the parts that make it up. A whole number, 0 to 100. */
export function knowledgeOf(input: KnowledgeInput): KnowledgeParts {
  const b = scoutingBalance;
  const unknown = input.scouts.reduce((left, scout) => {
    const weight = b.scouts[coverOf(scout, input.subject)];
    const skill = (scoutSkill(scout, input.scoutLift) * weight) / 100;
    return left * (1 - clamp(skill, 0, 1));
  }, 1);
  const scouts = b.scouts.max * (1 - unknown);
  const evidence = Math.min(b.evidence.max, b.evidence.perFinal * Math.max(0, input.scoredFinals));
  const visibility = (b.visibility * clamp(input.fame, 0, 100)) / 100;
  const standing =
    (b.standing.prestige * clamp(input.prestige, 0, 100)) / 100 +
    (b.standing.fame * clamp(input.playerFame, 0, 100)) / 100;
  const years = input.yearsSinceWorked;
  const experience = input.owned
    ? b.experience.owned
    : years === null
      ? 0
      : years <= 1
        ? b.experience.year
        : years <= 3
          ? b.experience.threeYears
          : 0;
  const flag = input.flagged ? b.attentionFlag : 0;
  const total = Math.floor(
    clamp(scouts + evidence + visibility + standing + experience + flag, 0, b.cap),
  );
  return { scouts, evidence, visibility, standing, experience, flag, total };
}

/** The word for a value: weak, modest, solid, strong or elite. */
export function bandFor(value: number): string {
  const v = clamp(Math.round(value), 0, 100);
  return (scoutingBalance.bands.find((band) => v <= band.max) ?? scoutingBalance.bands.at(-1)!)
    .name;
}

/**
 * How far either side of the truth a range reaches at this knowledge: null below the first
 * range (a word only), 0 from the exact threshold, and otherwise 20 falling to 2.
 */
export function halfWidth(knowledge: number): number | null {
  const b = scoutingBalance;
  const k = Math.floor(knowledge);
  if (k < b.rangeFrom) return null;
  if (k >= b.exactFrom) return 0;
  const steps = b.widest - b.narrowest + 1;
  return b.widest - Math.floor(((k - b.rangeFrom) * steps) / (b.exactFrom - b.rangeFrom));
}

/** Potential reads as if knowledge were lower, so it stays the foggiest number. */
export function potentialKnowledge(knowledge: number): number {
  return Math.max(0, knowledge - scoutingBalance.potentialPenalty);
}

/**
 * Where the truth sits in the widest range, from 0 (at the bottom) to just under 1 (at the
 * top). Drawn once for each stat of a subject in a season, so it never changes on a reload.
 */
export function placement(
  seed: string | number,
  subject: Subject,
  year: number,
  stat: string,
): number {
  return createRng(seed)
    .stream(`scout:${subjectKey(subject)}:${year}:${stat}`)
    .next();
}

export type Reading =
  | { kind: 'word'; band: string }
  | { kind: 'range'; low: number; high: number; band: string }
  | { kind: 'exact'; value: number };

/**
 * What the player sees of a true value (0 to 100) at a knowledge score. `place` is the draw
 * from `placement`. The range is whole numbers inside 0 to 100, always holds the truth, and
 * each rise in knowledge leaves it inside the range before.
 */
export function readValue(truth: number, knowledge: number, place: number): Reading {
  const half = halfWidth(knowledge);
  if (half === null) return { kind: 'word', band: bandFor(truth) };
  if (half === 0) return { kind: 'exact', value: truth };
  const width = 2 * half;
  const low = truth - Math.floor(width * place);
  return {
    kind: 'range',
    low: Math.max(0, low),
    high: Math.min(100, low + width),
    band: bandFor(truth),
  };
}

/** A reading as one number for sorting and filtering, so the order never gives the truth away. */
export function readingMidpoint(reading: Reading): number {
  if (reading.kind === 'exact') return reading.value;
  if (reading.kind === 'range') return (reading.low + reading.high) / 2;
  const band = scoutingBalance.bands;
  const i = band.findIndex((x) => x.name === reading.band);
  const lo = i === 0 ? 0 : band[i - 1]!.max + 1;
  return (lo + band[i]!.max) / 2;
}

/** A scout who could be hired. */
export interface ScoutOffer {
  name: string;
  /** 0 to 100. */
  skill: number;
  /** What they ask for a year. */
  wagePerYear: number;
}

/** A scout's yearly wage from their skill: $20,000 plus $600 a point, so $50,000 for a middling 50. */
export function scoutWageFor(skill: number): number {
  return Math.round(scoutingBalance.staff.wageBase + scoutingBalance.staff.wagePerSkill * skill);
}

/** What a scout is paid for one round: a year's wage shared over the season's rounds. */
export function scoutWagePerRound(wagePerYear: number): number {
  return Math.round(wagePerYear / scoutingBalance.staff.roundsPerSeason);
}

/** The scouts on offer, drawn from a stream. */
export function scoutOffers(rng: RandomStream): ScoutOffer[] {
  const [lo, hi] = scoutingBalance.staff.skill as [number, number];
  return Array.from({ length: scoutingBalance.staff.candidates }, () => {
    const skill = rng.int(lo, hi);
    return {
      name: personName(rng, 'AU', rng.chance(0.5) ? 'male' : 'female'),
      skill,
      wagePerYear: scoutWageFor(skill),
    };
  });
}

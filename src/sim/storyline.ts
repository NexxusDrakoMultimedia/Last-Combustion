// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { storylineData } from './worldgen/data';

/** When a beat comes: as the storyline starts, once both drivers race a final, or a round after the last beat. */
export type BeatWhen = 'start' | 'meeting' | 'next_round';

export interface Beat {
  key: string;
  when: BeatWhen;
}

/** What a choice on an event card does (see `data/storylines.json`). */
export interface Effects {
  /** A share of the series audience, gained by the driver. */
  fans?: number;
  /** Points of driver reputation. */
  reputation?: number;
  /** Points of relationship between the two drivers. */
  relationship?: number;
}

export interface Choice {
  key: string;
  effects: Effects;
}

export interface Template {
  trigger: { rivalryLevels: string[] };
  beats: Beat[];
  cards: Record<string, Choice[]>;
}

/** What the round showed about a storyline's drivers. */
export interface RoundFacts {
  /** Both drivers were classified in the round's final. */
  bothInFinal: boolean;
  /** The rivalry behind the storyline is still open. */
  rivalryOpen: boolean;
}

export type Advance = { kind: 'beat'; index: number; key: string } | { kind: 'end' } | null;

/** The template with this name, or undefined. */
export function templateOf(name: string): Template | undefined {
  return (storylineData.templates as Record<string, Template>)[name];
}

/**
 * What a storyline that has played `step` beats does after a round: the next beat if it is due, the
 * end if it was waiting for a meeting and the rivalry is over, or nothing yet. Beats never skip, and
 * once a showdown has happened the aftermath is played even if the rivalry has cooled.
 */
export function nextBeat(beats: Beat[], step: number, facts: RoundFacts): Advance {
  const beat = beats[step];
  if (!beat) return null;
  if (beat.when === 'meeting' && !facts.bothInFinal)
    return facts.rivalryOpen ? null : { kind: 'end' };
  return { kind: 'beat', index: step, key: beat.key };
}

/** How many more storylines may be highlighted for the player. */
export function highlightSlots(highlighted: number, cap = storylineData.highlightCap): number {
  return Math.max(0, cap - highlighted);
}

/** A driver's reputation after a change, kept between 0 and 100. */
export function clampReputation(current: number, delta: number): number {
  return Math.min(100, Math.max(0, Math.round(current + delta)));
}

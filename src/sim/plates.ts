// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import platesJson from '../../data/plates.json';
import type { RandomStream } from './rng';

export type PlateState = 'ACT' | 'NSW' | 'NT' | 'QLD' | 'SA' | 'TAS' | 'VIC' | 'WA';

export interface PlateStyle {
  name: string;
  format: string;
  slogan: string;
  /** The colour of the characters. */
  text: string;
  /** The colour of the plate. */
  background: string;
  /** How many of the country's cars are registered there (used when a car has no home state). */
  weight: number;
}

export const plateStyles = platesJson.states as Record<PlateState, PlateStyle>;
export const PLATE_STATES = Object.keys(plateStyles) as PlateState[];
const homeStates = platesJson.homeStates as Record<string, PlateState>;
const deny = platesJson.denyLetters;

/** Personalised plates for famous cars, keyed by the car model's id; each keeps the state it was registered in. */
export const customPlates = platesJson.custom as Record<
  string,
  { plate: string; state: PlateState }
>;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** The plate state of a place in Australia (by its region code), or undefined for anywhere else. */
export function plateStateOfRegion(region: string | undefined): PlateState | undefined {
  return region === undefined ? undefined : homeStates[region];
}

/** A plate state picked by how many cars each state has, for a car with no Australian home. */
export function randomPlateState(rng: RandomStream): PlateState {
  return rng.weighted(
    PLATE_STATES,
    PLATE_STATES.map((s) => plateStyles[s].weight),
  );
}

type Token =
  | { kind: 'lit'; text: string }
  | { kind: 'l' }
  | { kind: 'd' }
  | { kind: 'f' }
  | { kind: 'n' }
  | { kind: 'series'; options: string[] };

/** Splits a plate format (see `data/plates.json`) into tokens. */
function parse(format: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < format.length; i++) {
    const ch = format[i]!;
    if (ch === '[') {
      const end = format.indexOf(']', i);
      tokens.push({ kind: 'series', options: format.slice(i + 1, end).split(',') });
      i = end;
    } else if (ch === 'l' || ch === 'd' || ch === 'f' || ch === 'n') tokens.push({ kind: ch });
    else tokens.push({ kind: 'lit', text: ch });
  }
  return tokens;
}

/**
 * Fills in a plate format from a stream. A series prefix is picked from its list: a new car
 * (`newness` 1) leans towards the last, current entry, and an old one (0) towards the first.
 */
function fill(format: string, rng: RandomStream, newness: number): string {
  let out = '';
  for (const t of parse(format)) {
    if (t.kind === 'lit') out += t.text;
    else if (t.kind === 'l') out += LETTERS[rng.int(0, LETTERS.length - 1)];
    else if (t.kind === 'd') out += String(rng.int(0, 9));
    else if (t.kind === 'f') out += String(rng.int(1, 9));
    else if (t.kind === 'n') out += String(rng.int(2, 9));
    else {
      const last = t.options.length - 1;
      const index = Math.min(last, Math.max(0, Math.round(last * newness + rng.normal(0, 1))));
      out += t.options[index];
    }
  }
  return out;
}

/**
 * What makes a plate unique: its text and the state that issued it. Two cars registered in one state
 * never share a plate, but a personalised plate can be the same in two states.
 */
export function plateKey(state: string, plate: string): string {
  return `${state}:${plate}`;
}

/** Whether the letters on a plate spell something that should not be on a car. */
export function isRude(plate: string): boolean {
  const letters = plate.replace(/[^A-Z]/g, '');
  return deny.some((word) => letters.includes(word));
}

/**
 * A new plate in a state's standard format, such as `DT·42·HW` in New South Wales or `2GJ·1AA` in
 * Victoria. Newer cars (`newness` near 1) carry the current series, older ones earlier series. It
 * never repeats a plate of the same state in `used` (see `plateKey`), which is added to, and never
 * spells a word from the deny list.
 */
export function makePlate(
  rng: RandomStream,
  state: PlateState,
  used: Set<string>,
  newness = 1,
): string {
  const format = plateStyles[state].format;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const plate = fill(format, rng, newness);
    if (used.has(plateKey(state, plate)) || isRude(plate)) continue;
    used.add(plateKey(state, plate));
    return plate;
  }
  throw new Error(`No free ${state} plate was found.`);
}

/** How new a car is for choosing its plate series: 1 for this year's, falling to 0 at fifteen years old. */
export function newnessOf(modelYear: number, year: number): number {
  return Math.min(1, Math.max(0, 1 - (year - modelYear) / 15));
}

/**
 * The states whose formats a plate fits. The formats overlap a little (a New South Wales series can
 * start with the Northern Territory's C), so a car stores the state it was registered in.
 */
export function statesOfPlate(plate: string): PlateState[] {
  return PLATE_STATES.filter((s) => matches(plateStyles[s].format, plate));
}

function matches(format: string, plate: string): boolean {
  const tokens = parse(format);
  const go = (t: number, at: number): boolean => {
    if (t === tokens.length) return at === plate.length;
    const token = tokens[t]!;
    if (token.kind === 'series')
      return token.options.some((o) => plate.startsWith(o, at) && go(t + 1, at + o.length));
    const p = plate[at];
    if (p === undefined) return false;
    const ok =
      token.kind === 'lit'
        ? token.text === p
        : token.kind === 'l'
          ? LETTERS.includes(p)
          : token.kind === 'd'
            ? /[0-9]/.test(p)
            : token.kind === 'f'
              ? /[1-9]/.test(p)
              : /[2-9]/.test(p);
    return ok && go(t + 1, at + 1);
  };
  return go(0, 0);
}

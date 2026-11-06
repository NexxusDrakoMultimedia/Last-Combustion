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
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
  /** Any letter except these (`[^C]`). */
  | { kind: 'except'; letters: string };

/** Splits a plate format (see `data/plates.json`) into tokens. */
function parse(format: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < format.length; i++) {
    const ch = format[i]!;
    if (ch === '[' && format[i + 1] === '^') {
      const end = format.indexOf(']', i);
      tokens.push({ kind: 'except', letters: format.slice(i + 2, end) });
      i = end;
    } else if (ch === 'l' || ch === 'd') tokens.push({ kind: ch });
    else tokens.push({ kind: 'lit', text: ch });
  }
  return tokens;
}

/**
 * Fills in a plate format from a stream: any letter where the format has a letter and any digit
 * where it has a digit. Nothing is locked into a series; only the letters a state's own rules fix
 * are written into its format.
 */
function fill(format: string, rng: RandomStream): string {
  let out = '';
  for (const t of parse(format)) {
    if (t.kind === 'lit') out += t.text;
    else if (t.kind === 'l') out += LETTERS[rng.int(0, LETTERS.length - 1)];
    else if (t.kind === 'except') {
      const allowed = [...LETTERS].filter((c) => !t.letters.includes(c));
      out += allowed[rng.int(0, allowed.length - 1)];
    } else out += String(rng.int(0, 9));
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
 * Victoria, with every free letter and digit drawn at random. It never repeats a plate of the same
 * state in `used` (see `plateKey`), which is added to, and never spells a word from the deny list.
 */
export function makePlate(rng: RandomStream, state: PlateState, used: Set<string>): string {
  const format = plateStyles[state].format;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const plate = fill(format, rng);
    if (used.has(plateKey(state, plate)) || isRude(plate)) continue;
    used.add(plateKey(state, plate));
    return plate;
  }
  throw new Error(`No free ${state} plate was found.`);
}

/**
 * The states whose formats a plate fits. A few formats still overlap (New South Wales and the
 * Northern Territory share a shape, told apart by the NT's fixed C), so a car stores the state it
 * was registered in.
 */
export function statesOfPlate(plate: string): PlateState[] {
  return PLATE_STATES.filter((s) => matches(plateStyles[s].format, plate));
}

function matches(format: string, plate: string): boolean {
  const tokens = parse(format);
  if (tokens.length !== plate.length) return false;
  return tokens.every((token, i) => {
    const p = plate[i]!;
    return token.kind === 'lit'
      ? token.text === p
      : token.kind === 'l'
        ? LETTERS.includes(p)
        : token.kind === 'except'
          ? LETTERS.includes(p) && !token.letters.includes(p)
          : /[0-9]/.test(p);
  });
}

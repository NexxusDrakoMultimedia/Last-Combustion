// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import type { NameTheme } from '../worldgen/data';

/** Words a pattern can ask for that do not come from the theme's own lists. */
export interface NameContext {
  /** A family name, for `{surname}` and `{surname2}`. */
  surname?: () => string;
  /** A town or region, for `{place}`. */
  place?: () => string;
}

/**
 * Fills in a pattern such as "{adj} {noun} Racing". Each `{token}` is a random word from the theme's
 * list of that name, or from the context for `surname`, `surname2` and `place`. An underscore in a
 * pattern is a space.
 */
export function expand(
  pattern: string,
  words: Record<string, string[]>,
  rng: RandomStream,
  ctx: NameContext = {},
): string {
  return pattern
    .replace(/\{(\w+)\}/g, (_, token: string) => {
      const list = words[token];
      if (list && list.length > 0) return rng.pick(list);
      if ((token === 'surname' || token === 'surname2') && ctx.surname) return ctx.surname();
      if (token === 'place' && ctx.place) return ctx.place();
      throw new Error(`The pattern "${pattern}" asks for "${token}" but nothing provides it`);
    })
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Picks a theme by weight (a theme without a weight counts as 1). */
export function pickTheme(
  rng: RandomStream,
  themes: Record<string, NameTheme>,
  only?: readonly string[],
): [string, NameTheme] {
  const ids = Object.keys(themes).filter((id) => !only || only.includes(id));
  if (ids.length === 0) throw new Error('There are no name themes to choose from');
  const id = rng.weighted(
    ids,
    ids.map((i) => themes[i]!.weight ?? 1),
  );
  return [id, themes[id]!];
}

export interface GenerateOptions {
  /** Names to refuse (for example names already in use). New names are added to it. */
  used?: Set<string>;
  /** Restrict the choice to these theme ids. */
  only?: readonly string[];
  /** A name that must never be produced (for example real model names). */
  deny?: ReadonlySet<string>;
  /** How many times to try before giving up. */
  attempts?: number;
}

/** One name from a randomly chosen theme, unused and not denied. */
export function generateName(
  rng: RandomStream,
  themes: Record<string, NameTheme>,
  ctx: NameContext = {},
  options: GenerateOptions = {},
): { name: string; theme: string } {
  const attempts = options.attempts ?? 300;
  for (let i = 0; i < attempts; i++) {
    const [id, theme] = pickTheme(rng, themes, options.only);
    const name = expand(rng.pick(theme.patterns), theme.words, rng, ctx);
    if (options.used?.has(name)) continue;
    if (options.deny && name.split(' ').some((w) => options.deny!.has(w))) continue;
    options.used?.add(name);
    return { name, theme: id };
  }
  throw new Error('Could not find an unused name');
}

/** How many different names a set of themes can make, at most (surname and place count as 100 each). */
export function capacity(themes: Record<string, NameTheme>, contextSize = 100): number {
  let total = 0;
  for (const theme of Object.values(themes)) {
    for (const pattern of theme.patterns) {
      let n = 1;
      for (const [, token] of pattern.matchAll(/\{(\w+)\}/g)) {
        const list = theme.words[token!];
        n *= list ? list.length : contextSize;
      }
      total += n;
    }
  }
  return total;
}

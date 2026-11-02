// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import { nameLists } from './data';

export function pickNationality(rng: RandomStream): string {
  const codes = Object.keys(nameLists.nationalityWeights);
  return rng.weighted(
    codes,
    codes.map((code) => nameLists.nationalityWeights[code] as number),
  );
}

/** A person's name from a nationality's pools that is not on the deny list of famous names. */
export function personName(
  rng: RandomStream,
  nationality: string,
  gender: 'male' | 'female',
): string {
  const pools = nameLists.byNationality[nationality];
  if (!pools) throw new Error(`No name lists for nationality "${nationality}"`);
  for (;;) {
    const name = `${rng.pick(gender === 'male' ? pools.male : pools.female)} ${rng.pick(pools.surnames)}`;
    if (!nameLists.denyFullNames.includes(name)) return name;
  }
}

export function surname(rng: RandomStream, nationality: string): string {
  const pools = nameLists.byNationality[nationality];
  if (!pools) throw new Error(`No name lists for nationality "${nationality}"`);
  return rng.pick(pools.surnames);
}

/** A garage name that has not been used yet. */
export function garageName(rng: RandomStream, nationality: string, used: Set<string>): string {
  const words = nameLists.garageWords;
  for (let attempt = 0; attempt < 200; attempt++) {
    const style = rng.int(0, 3);
    let name: string;
    if (style === 0) name = `${rng.pick(words.adjectives)} ${rng.pick(words.nouns)}`;
    else if (style === 1) name = `${surname(rng, nationality)} ${rng.pick(words.nouns)}`;
    else if (style === 2) name = `${surname(rng, nationality)} ${rng.pick(words.suffixes)}`;
    else
      name = `${rng.pick(words.adjectives)} ${surname(rng, nationality)} ${rng.pick(words.nouns)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  throw new Error('Could not find an unused garage name');
}

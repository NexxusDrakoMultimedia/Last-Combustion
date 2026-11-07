// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import { generateName } from '../names/generate';
import {
  HOST_COUNTRY,
  balance,
  carCategories,
  denyCarNames,
  excludedFlags,
  flagNames,
  garageThemes,
  nameLists,
  nicknameThemes,
  places,
} from './data';

export function pickNationality(rng: RandomStream): string {
  const codes = Object.keys(nameLists.nationalityWeights);
  // Now and then a nation is chosen with no weighting at all, from every nation we have names for.
  if (rng.chance(nameLists.wildcardNationShare))
    return rng.pick(Object.keys(nameLists.byNationality));
  return rng.weighted(
    codes,
    codes.map((code) => nameLists.nationalityWeights[code] as number),
  );
}

/** Every flag a garage may fly except the host country's, for the foreign wildcard. */
const WILDCARD_FLAGS = Object.keys(flagNames)
  .filter((code) => code !== HOST_COUNTRY && !excludedFlags.has(code))
  .sort();

/** A nationality other than the host country, weighted the same way, for a garage that flies a foreign flag. */
export function pickForeignNationality(rng: RandomStream): string {
  const codes = Object.keys(nameLists.nationalityWeights).filter((c) => c !== HOST_COUNTRY);
  // Now and then the flag is chosen with no weighting at all, from every flag there is. A nation we have
  // no name lists for gets Australian-style names for now (more lists are planned).
  if (rng.chance(balance.garage.foreignWildcardShare)) return rng.pick(WILDCARD_FLAGS);
  return rng.weighted(
    codes,
    codes.map((code) => nameLists.nationalityWeights[code] as number),
  );
}

const DENY_FULL = new Set(nameLists.denyFullNames.map((n) => n.toLowerCase()));
const DENY_WORDS = new Set(nameLists.denyWords.map((w) => w.toLowerCase()));

/**
 * Whether a name is one the game will not generate: the name of an infamous person, or a name with an
 * offensive word as a part. A name that happens to match a real person who is not on the list is fine.
 */
export function isOffensiveName(name: string): boolean {
  const lower = name.toLowerCase();
  if (DENY_FULL.has(lower)) return true;
  return lower.split(/[\s-]+/).some((part) => DENY_WORDS.has(part));
}

/** A person's name from a nationality's pools that is not an offensive one. */
export function personName(
  rng: RandomStream,
  nationality: string,
  gender: 'male' | 'female',
): string {
  const pools = nameLists.byNationality[nationality];
  if (!pools) throw new Error(`No name lists for nationality "${nationality}"`);
  for (;;) {
    const name = `${rng.pick(gender === 'male' ? pools.male : pools.female)} ${rng.pick(pools.surnames)}`;
    if (!isOffensiveName(name)) return name;
  }
}

export function surname(rng: RandomStream, nationality: string): string {
  const pools = nameLists.byNationality[nationality];
  if (!pools) throw new Error(`No name lists for nationality "${nationality}"`);
  return rng.pick(pools.surnames);
}

/** A garage name from a random theme (heritage, engineering, animals, places and so on) that has not been used yet. */
export function garageName(
  rng: RandomStream,
  nationality: string,
  used: Set<string>,
  /** The town or city the garage is from: a name that carries a place carries this one. */
  home?: string,
): string {
  const regional = places.filter((p) => p.country === nationality);
  const pool = regional.length > 0 ? regional : places;
  return generateName(
    rng,
    garageThemes,
    {
      surname: () => surname(rng, nationality),
      place: () => home ?? rng.pick(pool).name,
    },
    { used },
  ).name;
}

const PLACES_LONGEST_FIRST = [...places].sort((a, b) => b.name.length - a.name.length);

/**
 * The place a garage name carries, if it has one in it ("Mount Barker Coast Tuning" carries Mount
 * Barker): the longest place name that stands as whole words in the name. A garage named for a place
 * is from that place, so its flag and headquarters follow it.
 */
export function placeInName(name: string): (typeof places)[number] | undefined {
  return PLACES_LONGEST_FIRST.find((p) =>
    new RegExp(
      `(^|[^\\p{L}])${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`,
      'u',
    ).test(name),
  );
}

/** A model name for a car of a category (hypercar, supercar, jdm, sports, domestic or other). */
export function carModelName(rng: RandomStream, category: string, used: Set<string>): string {
  const theme = carCategories[category] ?? carCategories.other;
  if (!theme) throw new Error(`There are no car names for "${category}"`);
  return generateName(rng, { [category]: theme }, {}, { used, deny: denyCarNames }).name;
}

/** The nickname themes that suit a driver, most fitting first (the way a driver races sets their handle). */
export function nicknameThemesFor(driver: {
  homeRoadType: string;
  wetSkill: number;
  racecraft: number;
  consistency: number;
  age: number;
}): string[] {
  const themes: string[] = [driver.homeRoadType];
  if (driver.wetSkill >= 70) themes.push('wet');
  if (driver.racecraft >= 70) themes.push('aggressive');
  if (driver.consistency >= 70) themes.push('smooth');
  if (driver.age >= 38) themes.push('veteran');
  if (driver.age <= 22) themes.push('rookie');
  return themes;
}

/** A nickname such as "The Midnight Ghost", from the themes that suit a driver. */
export function nickname(
  rng: RandomStream,
  themeIds: readonly string[],
  used: Set<string>,
): string {
  const only = themeIds.filter((id) => id in nicknameThemes);
  return generateName(
    rng,
    nicknameThemes,
    { place: () => rng.pick(places).name },
    { used, only: only.length > 0 ? only : undefined },
  ).name;
}

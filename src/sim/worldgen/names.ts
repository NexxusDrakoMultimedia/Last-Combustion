// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import { generateName } from '../names/generate';
import {
  carCategories,
  denyCarNames,
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

/** A garage name from a random theme (heritage, engineering, animals, places and so on) that has not been used yet. */
export function garageName(rng: RandomStream, nationality: string, used: Set<string>): string {
  const regional = places.filter((p) => p.country === nationality);
  const pool = regional.length > 0 ? regional : places;
  return generateName(
    rng,
    garageThemes,
    { surname: () => surname(rng, nationality), place: () => rng.pick(pool).name },
    { used },
  ).name;
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

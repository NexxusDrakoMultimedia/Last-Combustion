// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import titlesJson from '../../data/titles.json';

export type TitleRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type TitleCategory = 'milestone' | 'skill' | 'road' | 'legacy';

export interface TitleCondition {
  /** A name from the driver's record (see `DriverRecord`). */
  metric: string;
  atLeast: number;
}

export interface TitleData {
  id: string;
  name: string;
  category: TitleCategory;
  rarity: TitleRarity;
  description: string;
  /** Every condition must hold. */
  conditions: TitleCondition[];
}

/** The figures from a driver's career that titles are earned from. Anything missing counts as zero. */
export type DriverRecord = Record<string, number>;

export const titles = titlesJson.titles as TitleData[];
const byId = new Map(titles.map((t) => [t.id, t]));

/** Looks a title up by id. */
export function title(id: string): TitleData {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown title "${id}"`);
  return found;
}

/** Whether a record meets every condition of a title. */
export function qualifies(record: DriverRecord, t: TitleData): boolean {
  return t.conditions.every((c) => (record[c.metric] ?? 0) >= c.atLeast);
}

/** Every title a record has earned, rarest last in the list of ids it returns. */
export function earnedTitles(record: DriverRecord): string[] {
  const order: Record<TitleRarity, number> = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  };
  return titles
    .filter((t) => qualifies(record, t))
    .sort((a, b) => order[a.rarity] - order[b.rarity] || a.name.localeCompare(b.name, 'en'))
    .map((t) => t.id);
}

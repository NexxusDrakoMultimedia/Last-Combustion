// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';

/**
 * What a race number carries (see the GDD, "Numbers, borders and liveries"): a gold border for
 * anyone who has reached a final, a silver border for a Junior Series points scorer who has not,
 * and a black box for the reigning champion.
 */
export interface NumberBadge {
  gold: boolean;
  silver: boolean;
  blackBox: boolean;
}

export const NO_BADGE: NumberBadge = { gold: false, silver: false, blackBox: false };

/** The badge of each driver for a season: borders earned by then, and the box for last season's champion. */
export function badgesFor(db: Database, year: number): Map<number, NumberBadge> {
  const champion = all(
    db,
    'SELECT champion_driver_id AS id FROM season WHERE year = ? AND champion_driver_id IS NOT NULL',
    [year - 1],
  )[0]?.id as number | undefined;
  const out = new Map<number, NumberBadge>();
  for (const d of all(
    db,
    `SELECT id, gold_border_year AS gold, silver_border_year AS silver FROM driver
      WHERE gold_border_year IS NOT NULL OR silver_border_year IS NOT NULL OR id = ?`,
    [champion ?? -1],
  )) {
    const gold = d.gold !== null && (d.gold as number) <= year;
    out.set(d.id as number, {
      gold,
      silver: !gold && d.silver !== null && (d.silver as number) <= year,
      blackBox: d.id === champion,
    });
  }
  return out;
}

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
  /** The main colour of the garage the driver raced for that season (the colour of the number plate), if they raced. */
  colour: string | null;
}

export const NO_BADGE: NumberBadge = { gold: false, silver: false, blackBox: false, colour: null };

/** The badge of each driver for a season: borders earned by then, and the box for last season's champion. */
export function badgesFor(db: Database, year: number): Map<number, NumberBadge> {
  const champion = all(
    db,
    'SELECT champion_driver_id AS id FROM season WHERE year = ? AND champion_driver_id IS NOT NULL',
    [year - 1],
  )[0]?.id as number | undefined;
  const out = new Map<number, NumberBadge>();
  // Everyone who raced that season carries their garage's main colour on their number plate.
  for (const e of all(
    db,
    `SELECT e.driver_id AS id, g.primary_colour AS colour FROM entry e
       JOIN garage g ON g.id = e.garage_id JOIN season s ON s.id = e.season_id
      WHERE s.year = ? AND e.series = 'main' ORDER BY e.id`,
    [year],
  )) {
    out.set(e.id as number, { ...NO_BADGE, colour: e.colour as string });
  }
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
      colour: out.get(d.id as number)?.colour ?? null,
    });
  }
  return out;
}

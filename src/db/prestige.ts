// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { garageBonuses } from './bonuses';
import { all } from './entries';

/**
 * A player garage's prestige from what it has done (see the GDD, "Garages and Field Size"): it
 * starts at 1 and rises by 4 for each entry after the first, by 2 for each gold-bordered driver in
 * its entries and by 5 for each Drivers' Championship it has won, never above 100. Prestige unlocks
 * better sponsors, supplier deals and executive roles.
 */
export function prestigeOf(entries: number, goldBordered: number, titles: number): number {
  return Math.min(
    100,
    Math.max(1, 1 + 4 * Math.max(0, entries - 1) + 2 * goldBordered + 5 * titles),
  );
}

/** Works out the player garage's prestige again and saves it. Returns the new prestige, or undefined if there is no player garage. */
export function refreshPlayerPrestige(db: Database): number | undefined {
  const garage = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!garage) return undefined;
  const id = garage.id as number;
  const season = all(db, 'SELECT MAX(id) AS id FROM season')[0];
  const entries = Number(
    all(
      db,
      "SELECT COUNT(*) AS n FROM entry WHERE garage_id = ? AND series = 'main' AND season_id = ?",
      [id, season?.id ?? 0],
    )[0]!.n,
  );
  const gold = Number(
    all(
      db,
      `SELECT COUNT(DISTINCT d.id) AS n FROM entry e JOIN driver d ON d.id = e.driver_id
        WHERE e.garage_id = ? AND e.series = 'main' AND e.season_id = ? AND d.gold_border_year IS NOT NULL`,
      [id, season?.id ?? 0],
    )[0]!.n,
  );
  const titles = Number(
    all(db, 'SELECT COUNT(*) AS n FROM season WHERE champion_driver_garage_id = ?', [id])[0]!.n,
  );
  // A Chief Executive makes what the garage has earned count for more.
  const earned = prestigeOf(entries, gold, titles) - 1;
  const prestige = Math.min(100, 1 + Math.round(earned * (1 + garageBonuses(db, id).prestige)));
  db.run('UPDATE garage SET prestige = ? WHERE id = ?', [prestige, id]);
  return prestige;
}

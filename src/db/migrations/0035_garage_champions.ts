// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 35: garage champions. `season.champion_garage_id` held the garage of the drivers'
 * champion, which is not the Garage Championship winner (that table scores each garage's best two
 * results a round). The old column keeps its meaning under a clearer name, and
 * `champion_garage_id` now holds the Garage Championship winner, filled in for every season that has
 * ended from its saved garage table.
 */
export const migration0035: Migration = {
  version: 35,
  name: 'garage_champions',
  sql: `
    ALTER TABLE season RENAME COLUMN champion_garage_id TO champion_driver_garage_id;
    ALTER TABLE season ADD COLUMN champion_garage_id INTEGER REFERENCES garage (id);
    UPDATE season
       SET champion_garage_id = (
         SELECT CAST(subject AS INTEGER) FROM standing_snapshot
          WHERE season_id = season.id AND table_kind = 'garage' AND position = 1)
     WHERE status = 'complete';
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 14: final standings and the champions of each season (milestone M5). */
export const migration0014: Migration = {
  version: 14,
  name: 'standings',
  sql: `
    ALTER TABLE season ADD COLUMN champion_driver_id INTEGER REFERENCES driver (id);
    ALTER TABLE season ADD COLUMN champion_garage_id INTEGER REFERENCES garage (id);

    CREATE TABLE standing_snapshot (
      id           INTEGER PRIMARY KEY,
      season_id    INTEGER NOT NULL REFERENCES season (id),
      table_kind   TEXT NOT NULL CHECK (table_kind IN ('driver', 'garage', 'manufacturer', 'driver_nation', 'garage_nation')),
      subject      TEXT NOT NULL,
      after_round  INTEGER NOT NULL,
      points       REAL NOT NULL,
      wins         INTEGER NOT NULL DEFAULT 0,
      position     INTEGER NOT NULL CHECK (position >= 1),
      UNIQUE (season_id, table_kind, subject, after_round)
    );
  `,
};

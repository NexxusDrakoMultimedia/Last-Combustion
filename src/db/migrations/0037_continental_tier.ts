// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 37: the continental tier for sponsors, between national and global. The sponsor
 * table is rebuilt with the wider list of tiers (SQLite cannot change a CHECK in place), keeping
 * every id so existing deals still point at the right sponsor. A save that already has its sponsors
 * (an older career) gets the three continental sponsors added; a new world is filled in from the
 * data files after the migrations run, so nothing is added to an empty table.
 */
export const migration0037: Migration = {
  version: 37,
  name: 'continental_tier',
  sql: `
    CREATE TABLE sponsor_v2 (
      id            INTEGER PRIMARY KEY,
      stable_id     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      home_country  TEXT NOT NULL,
      tier          TEXT NOT NULL CHECK (tier IN ('local', 'regional', 'national', 'continental', 'global')),
      min_prestige  INTEGER NOT NULL CHECK (min_prestige >= 1),
      strength      INTEGER NOT NULL CHECK (strength BETWEEN 0 AND 100)
    );
    INSERT INTO sponsor_v2 SELECT * FROM sponsor;
    DROP TABLE sponsor;
    ALTER TABLE sponsor_v2 RENAME TO sponsor;

    INSERT INTO sponsor (id, stable_id, name, home_country, tier, min_prestige, strength)
      SELECT 13, 'tasman-motors', 'Tasman Motors', 'NZ', 'continental', 58, 80
        WHERE EXISTS (SELECT 1 FROM sponsor);
    INSERT INTO sponsor (id, stable_id, name, home_country, tier, min_prestige, strength)
      SELECT 14, 'pacific-reserve-bank', 'Pacific Reserve Bank', 'SG', 'continental', 60, 82
        WHERE EXISTS (SELECT 1 FROM sponsor);
    INSERT INTO sponsor (id, stable_id, name, home_country, tier, min_prestige, strength)
      SELECT 15, 'southern-skies-airlines', 'Southern Skies Airlines', 'AU', 'continental', 62, 85
        WHERE EXISTS (SELECT 1 FROM sponsor);
  `,
};

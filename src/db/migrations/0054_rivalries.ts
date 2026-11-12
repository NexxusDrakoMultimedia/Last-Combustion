// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 54: driver rivalries. A pair of drivers (the lower id first) has a heat score and a
 * level, `live` once the heat has reached Spark, and an end year and reason when it ends. Only one
 * open rivalry exists for a pair at a time; a pair that has cooled can start again. Every shared moment
 * that raised the heat is kept as a meeting, once for each kind in a round.
 */
export const migration0054: Migration = {
  version: 54,
  name: 'rivalries',
  sql: `
    CREATE TABLE rivalry (
      id               INTEGER PRIMARY KEY,
      driver_a         INTEGER NOT NULL REFERENCES driver (id),
      driver_b         INTEGER NOT NULL REFERENCES driver (id),
      heat             REAL NOT NULL CHECK (heat >= 0),
      peak             REAL NOT NULL CHECK (peak >= 0),
      level            TEXT NOT NULL CHECK (level IN ('none', 'spark', 'rivalry', 'feud', 'legendary')),
      live             INTEGER NOT NULL DEFAULT 0 CHECK (live IN (0, 1)),
      started_year     INTEGER NOT NULL,
      started_round_id INTEGER REFERENCES round (id),
      ended_year       INTEGER,
      end_reason       TEXT CHECK (end_reason IS NULL OR end_reason IN ('cooled', 'retired', 'reconciled', 'displaced')),
      CHECK (driver_a < driver_b)
    );
    CREATE UNIQUE INDEX rivalry_open_pair ON rivalry (driver_a, driver_b) WHERE ended_year IS NULL;
    CREATE INDEX rivalry_driver_b ON rivalry (driver_b);

    CREATE TABLE rivalry_meeting (
      id          INTEGER PRIMARY KEY,
      rivalry_id  INTEGER NOT NULL REFERENCES rivalry (id),
      round_id    INTEGER NOT NULL REFERENCES round (id),
      kind        TEXT NOT NULL CHECK (kind IN ('close_finish', 'title_fight')),
      gain        REAL NOT NULL,
      UNIQUE (rivalry_id, round_id, kind)
    );
  `,
};

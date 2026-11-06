// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 31: season awards. `season_award` holds one winner per award per season, written
 * when the season ends. `driver_season_fans` adds up the fans each driver wins through a season, so
 * the Fan Favourite can be found (a season already in progress counts from here on).
 */
export const migration0031: Migration = {
  version: 31,
  name: 'awards',
  sql: `
    CREATE TABLE season_award (
      id            INTEGER PRIMARY KEY,
      season_id     INTEGER NOT NULL REFERENCES season (id),
      award         TEXT NOT NULL,
      subject_type  TEXT NOT NULL CHECK (subject_type IN ('driver', 'garage')),
      subject_id    INTEGER NOT NULL,
      value         REAL NOT NULL,
      UNIQUE (season_id, award)
    );
    CREATE INDEX season_award_subject ON season_award (subject_type, subject_id);

    CREATE TABLE driver_season_fans (
      season_id  INTEGER NOT NULL REFERENCES season (id),
      driver_id  INTEGER NOT NULL REFERENCES driver (id),
      gained     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season_id, driver_id)
    );
  `,
};

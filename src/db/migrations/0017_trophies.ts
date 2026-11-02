// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 17: trophy and shield decals (see the GDD, "Numbers, borders and liveries"). A
 * trophy marks a race win and a shield a championship; a driver's decals follow the driver and a
 * car's follow the car.
 */
export const migration0017: Migration = {
  version: 17,
  name: 'trophies',
  sql: `
    CREATE TABLE trophy (
      id          INTEGER PRIMARY KEY,
      owner_type  TEXT NOT NULL CHECK (owner_type IN ('driver', 'car')),
      owner_id    INTEGER NOT NULL,
      kind        TEXT NOT NULL CHECK (kind IN ('win', 'title')),
      series      TEXT NOT NULL DEFAULT 'main' CHECK (series IN ('main', 'junior')),
      season_id   INTEGER NOT NULL REFERENCES season (id),
      round_id    INTEGER REFERENCES round (id),
      earned_on   TEXT NOT NULL
    );
    CREATE INDEX trophy_owner ON trophy (owner_type, owner_id);
  `,
};

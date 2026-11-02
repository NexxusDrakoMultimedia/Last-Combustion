// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 16: driver nicknames and the titles drivers earn and equip. */
export const migration0016: Migration = {
  version: 16,
  name: 'titles',
  sql: `
    ALTER TABLE driver ADD COLUMN nickname TEXT;
    ALTER TABLE driver ADD COLUMN equipped_title TEXT;

    CREATE TABLE driver_title (
      driver_id    INTEGER NOT NULL REFERENCES driver (id),
      title_id     TEXT NOT NULL,
      earned_year  INTEGER NOT NULL,
      PRIMARY KEY (driver_id, title_id)
    );
  `,
};

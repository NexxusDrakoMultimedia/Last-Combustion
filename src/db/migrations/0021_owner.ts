// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** The player's character: the owner of the player's garage. */
export const migration0021: Migration = {
  version: 21,
  name: 'owner',
  sql: `
    CREATE TABLE owner (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      garage_id   INTEGER NOT NULL REFERENCES garage (id),
      name        TEXT NOT NULL,
      identity    TEXT NOT NULL CHECK (identity IN ('masculine', 'feminine', 'non_binary')),
      birth_date  TEXT NOT NULL
    );
  `,
};

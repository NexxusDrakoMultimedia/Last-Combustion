// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 45: computer garages as businesses. A computer garage now has a sponsor and a
 * supplier on record, besides the executives and facilities that use the tables the player's garage
 * uses. The garages already in a save are given theirs the next time it opens.
 */
export const migration0045: Migration = {
  version: 45,
  name: 'business',
  sql: `
    CREATE TABLE business (
      garage_id    INTEGER PRIMARY KEY REFERENCES garage (id),
      sponsor_id   INTEGER REFERENCES sponsor (id),
      supplier_id  INTEGER,
      since_year   INTEGER NOT NULL
    );
  `,
};

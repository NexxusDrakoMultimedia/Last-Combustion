// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 38: garage facilities. A garage holds at most one of each kind, at a level from 1 to
 * 5 (see `data/facilities.json`). A kind a garage does not hold has no row.
 */
export const migration0038: Migration = {
  version: 38,
  name: 'facilities',
  sql: `
    CREATE TABLE facility (
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      kind       TEXT NOT NULL,
      level      INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
      PRIMARY KEY (garage_id, kind)
    );
  `,
};

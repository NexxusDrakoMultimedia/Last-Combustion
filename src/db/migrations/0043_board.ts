// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 43: the board's season target. The board expects a finish in the Garage table each
 * season; when the season ends the finish is written beside it, and a vote of no confidence is noted
 * when the target has been missed twice in a row while the owner holds no more than half the votes.
 */
export const migration0043: Migration = {
  version: 43,
  name: 'board',
  sql: `
    CREATE TABLE board_target (
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      year       INTEGER NOT NULL,
      target     INTEGER NOT NULL CHECK (target >= 1),
      finish     INTEGER,
      met        INTEGER CHECK (met IN (0, 1)),
      vote       INTEGER NOT NULL DEFAULT 0 CHECK (vote IN (0, 1)),
      PRIMARY KEY (garage_id, year)
    );
  `,
};

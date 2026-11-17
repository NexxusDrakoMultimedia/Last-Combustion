// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 64: driver bans. A Palpably Unfair Act disqualifies a driver from the race it happened in
 * and can keep them out of the next few (up to twelve). One row for each banned driver holds the races
 * still to be sat out; the row goes when the last one has been served.
 */
export const migration0064: Migration = {
  version: 64,
  name: 'driver_ban',
  sql: `
    CREATE TABLE driver_ban (
      driver_id      INTEGER PRIMARY KEY REFERENCES driver(id),
      races_left     INTEGER NOT NULL CHECK (races_left BETWEEN 1 AND 12),
      banned_on      TEXT NOT NULL,
      round_id       INTEGER REFERENCES round(id),
      reason         TEXT NOT NULL
    );
  `,
};

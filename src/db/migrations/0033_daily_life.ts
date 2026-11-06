// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 33: daily life. A driver can move home in the off-season; the move is paid for
 * then and takes effect when the next season starts, so it waits in `driver_move` until then.
 */
export const migration0033: Migration = {
  version: 33,
  name: 'daily_life',
  sql: `
    CREATE TABLE driver_move (
      driver_id  INTEGER PRIMARY KEY REFERENCES driver (id),
      place_id   INTEGER NOT NULL REFERENCES place (id),
      paid_on    TEXT NOT NULL
    );
  `,
};

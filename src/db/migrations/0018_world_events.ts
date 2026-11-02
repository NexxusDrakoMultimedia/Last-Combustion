// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** World changes that happened in this career (flag splits and renames), and flag names as they changed. */
export const migration0018: Migration = {
  version: 18,
  name: 'world_events',
  sql: `
    CREATE TABLE world_event (
      id        INTEGER PRIMARY KEY,
      event_id  TEXT NOT NULL UNIQUE,
      year      INTEGER NOT NULL,
      payload   TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE flag_name (
      flag       TEXT NOT NULL,
      from_year  INTEGER NOT NULL,
      short_name TEXT NOT NULL,
      long_name  TEXT NOT NULL,
      PRIMARY KEY (flag, from_year)
    );
  `,
};

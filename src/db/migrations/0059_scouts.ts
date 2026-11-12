// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 59: scouts. A garage employs scouts, each with a skill, a yearly wage and a focus
 * (drivers, cars or garages). A scout may be assigned to one subject, which is how the player chases a
 * prospect or sizes up a rival. Scouts are their own table, not a staff role, so mechanics and their
 * crew cover are untouched. A save from an earlier version starts with no scouts.
 */
export const migration0059: Migration = {
  version: 59,
  name: 'scouts',
  sql: `
    CREATE TABLE scout (
      id            INTEGER PRIMARY KEY,
      garage_id     INTEGER NOT NULL REFERENCES garage (id),
      name          TEXT NOT NULL,
      skill         INTEGER NOT NULL CHECK (skill BETWEEN 0 AND 100),
      focus         TEXT NOT NULL CHECK (focus IN ('drivers', 'cars', 'garages')),
      wage_per_year INTEGER NOT NULL CHECK (wage_per_year >= 0),
      hired_on      TEXT NOT NULL,
      left_on       TEXT,
      left_reason   TEXT
    );
    CREATE INDEX scout_garage ON scout (garage_id, left_on);

    CREATE TABLE scout_assignment (
      scout_id     INTEGER PRIMARY KEY REFERENCES scout (id),
      subject_kind TEXT NOT NULL CHECK (subject_kind IN ('drivers', 'cars', 'garages')),
      subject_id   INTEGER NOT NULL,
      assigned_on  TEXT NOT NULL
    );
  `,
};

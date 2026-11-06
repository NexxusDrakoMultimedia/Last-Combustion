// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** The mechanics a garage employs: each has a skill, is paid weekly and keeps the cars in better shape. */
export const migration0028: Migration = {
  version: 28,
  name: 'staff',
  sql: `
    CREATE TABLE staff (
      id             INTEGER PRIMARY KEY,
      garage_id      INTEGER NOT NULL REFERENCES garage (id),
      role           TEXT NOT NULL DEFAULT 'mechanic' CHECK (role IN ('mechanic')),
      name           TEXT NOT NULL,
      skill          INTEGER NOT NULL CHECK (skill BETWEEN 0 AND 100),
      wage_per_week  INTEGER NOT NULL CHECK (wage_per_week >= 0),
      hired_on       TEXT NOT NULL,
      left_on        TEXT
    );
    CREATE INDEX staff_garage ON staff (garage_id, left_on);
  `,
};

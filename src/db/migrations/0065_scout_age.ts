// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 65: scouts have an age. A scout now has a birth year, so a scout can retire at the age
 * set in `data/scouting.json`. A scout hired before this version gets an age from their number (between
 * 30 and 49 on the day they were hired), so the same save always loads the same way.
 */
export const migration0065: Migration = {
  version: 65,
  name: 'scout_age',
  sql: `
    ALTER TABLE scout ADD COLUMN birth_year INTEGER NOT NULL DEFAULT 0;
    UPDATE scout SET birth_year = CAST(substr(hired_on, 1, 4) AS INTEGER) - (30 + id % 20);
  `,
};

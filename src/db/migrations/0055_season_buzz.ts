// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 55: season buzz. The buzz a season leaves behind (an exciting title race, different
 * winners, live rivalries and word of mouth) is kept on the season, as extra growth for the series
 * audience the next season starts with. A save from before this version has 0 on every season.
 */
export const migration0055: Migration = {
  version: 55,
  name: 'season_buzz',
  sql: `
    ALTER TABLE season ADD COLUMN buzz REAL NOT NULL DEFAULT 0 CHECK (buzz >= 0);
  `,
};

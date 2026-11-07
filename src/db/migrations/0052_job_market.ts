// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 52: the job market. A mechanic has an age and a reason for leaving, as an executive
 * already does, so that someone let go can go back on the market until they retire (see
 * `data/balance.json`, `jobs`).
 */
export const migration0052: Migration = {
  version: 52,
  name: 'job_market',
  sql: `
    ALTER TABLE staff ADD COLUMN birth_year INTEGER;
    ALTER TABLE staff ADD COLUMN left_reason TEXT;
  `,
};

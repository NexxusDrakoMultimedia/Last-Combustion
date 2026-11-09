// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 53: sponsors and utility suppliers that have withdrawn from the series for a while.
 * A company is out for the years from `from_year` to `to_year` and then comes back; none leaves for
 * good.
 */
export const migration0053: Migration = {
  version: 53,
  name: 'company_breaks',
  sql: `
    CREATE TABLE company_break (
      kind        TEXT NOT NULL CHECK (kind IN ('sponsor', 'utility')),
      company_id  INTEGER NOT NULL,
      from_year   INTEGER NOT NULL,
      to_year     INTEGER NOT NULL CHECK (to_year >= from_year),
      PRIMARY KEY (kind, company_id, from_year)
    );
  `,
};

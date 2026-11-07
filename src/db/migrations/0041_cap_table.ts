// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 41: who owns each garage. A garage's capital is split into shares; each holding is
 * a holder (the owner, family, an investor, a sponsor or a manufacturer), a class, a number of shares
 * and what the holder paid. Share classes live in `data/equity.json`. A garage's value is written
 * when a season ends, so its history is kept. Garages with no holdings get their cap table when the
 * save loads (see `ensureCapTables`).
 */
export const migration0041: Migration = {
  version: 41,
  name: 'cap_table',
  sql: `
    CREATE TABLE shareholding (
      id           INTEGER PRIMARY KEY,
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      holder_type  TEXT NOT NULL CHECK (holder_type IN
        ('owner', 'family', 'investor', 'sponsor', 'manufacturer', 'executive', 'driver', 'garage', 'bank', 'public')),
      holder_id    INTEGER,
      holder_name  TEXT NOT NULL,
      class        TEXT NOT NULL CHECK (class IN ('ordinary', 'preferred', 'option')),
      shares       INTEGER NOT NULL CHECK (shares > 0),
      paid         INTEGER NOT NULL DEFAULT 0 CHECK (paid >= 0),
      since        TEXT NOT NULL
    );
    CREATE INDEX shareholding_garage ON shareholding (garage_id);

    CREATE TABLE valuation (
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      date       TEXT NOT NULL,
      value      INTEGER NOT NULL,
      PRIMARY KEY (garage_id, date)
    );
  `,
};

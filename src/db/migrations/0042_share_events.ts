// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 42: what happens to a garage's shares. `share_event` records funding rounds,
 * dividends and buy-backs (the detail is JSON), and the owner gets personal cash, where dividends
 * and the money from selling shares go, and which buys shares back.
 */
export const migration0042: Migration = {
  version: 42,
  name: 'share_events',
  sql: `
    CREATE TABLE share_event (
      id         INTEGER PRIMARY KEY,
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      date       TEXT NOT NULL,
      kind       TEXT NOT NULL CHECK (kind IN ('round', 'dividend', 'buyback')),
      detail     TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX share_event_garage ON share_event (garage_id, date);

    ALTER TABLE owner ADD COLUMN personal_cash INTEGER NOT NULL DEFAULT 0 CHECK (personal_cash >= 0);
  `,
};

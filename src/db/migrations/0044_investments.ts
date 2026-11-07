// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 44: holdings in other garages and takeovers. A garage that has been taken over
 * remembers by whom; the owner's holdings are recognised by holder id 1 (the owner), which the
 * owners already in saves are given; and the history of shares gets two more kinds of event, so the
 * table is rebuilt (SQLite cannot change a CHECK in place).
 */
export const migration0044: Migration = {
  version: 44,
  name: 'investments',
  sql: `
    ALTER TABLE garage ADD COLUMN acquired_by INTEGER REFERENCES garage (id);

    UPDATE shareholding SET holder_id = 1
      WHERE holder_type = 'owner' AND garage_id IN (SELECT garage_id FROM owner);

    CREATE TABLE share_event_v2 (
      id         INTEGER PRIMARY KEY,
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      date       TEXT NOT NULL,
      kind       TEXT NOT NULL CHECK (kind IN ('round', 'dividend', 'buyback', 'stake', 'takeover')),
      detail     TEXT NOT NULL DEFAULT '{}'
    );
    INSERT INTO share_event_v2 SELECT * FROM share_event;
    DROP TABLE share_event;
    ALTER TABLE share_event_v2 RENAME TO share_event;
    CREATE INDEX share_event_garage ON share_event (garage_id, date);
  `,
};

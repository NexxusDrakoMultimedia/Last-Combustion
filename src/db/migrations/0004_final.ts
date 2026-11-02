// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 4: timing, money and bonuses from the final race (milestone M3). */
export const migration0004: Migration = {
  version: 4,
  name: 'final',
  sql: `
    CREATE TABLE timing (
      id            INTEGER PRIMARY KEY,
      round_id      INTEGER NOT NULL REFERENCES round (id),
      entry_id      INTEGER NOT NULL REFERENCES entry (id),
      lap           INTEGER NOT NULL,
      sector        INTEGER NOT NULL,
      exit_seconds  REAL NOT NULL,
      tyre_pct      REAL NOT NULL,
      position      INTEGER NOT NULL
    );
    CREATE INDEX timing_round ON timing (round_id, entry_id);

    CREATE TABLE ledger (
      id         INTEGER PRIMARY KEY,
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      round_id   INTEGER REFERENCES round (id),
      date       TEXT NOT NULL,
      category   TEXT NOT NULL,
      amount     INTEGER NOT NULL,
      note       TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX ledger_garage ON ledger (garage_id);

    CREATE TABLE season_bonus (
      id         INTEGER PRIMARY KEY,
      season_id  INTEGER NOT NULL REFERENCES season (id),
      round_id   INTEGER NOT NULL REFERENCES round (id),
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      entry_id   INTEGER NOT NULL REFERENCES entry (id),
      kind       TEXT NOT NULL CHECK (kind IN ('pole', 'overtake')),
      amount     INTEGER NOT NULL CHECK (amount >= 0),
      paid       INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1))
    );
  `,
};

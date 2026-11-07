// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 48: the press. A journalist writes a headline about the player's garage after each
 * final. The headline keeps who wrote it, how they saw the garage and what happened (the driver and the
 * finish), and the words are made from that when it is shown.
 */
export const migration0048: Migration = {
  version: 48,
  name: 'press',
  sql: `
    CREATE TABLE headline (
      id            INTEGER PRIMARY KEY,
      garage_id     INTEGER NOT NULL REFERENCES garage (id),
      round_id      INTEGER NOT NULL REFERENCES round (id),
      journalist_id INTEGER NOT NULL,
      kind          TEXT NOT NULL CHECK (kind IN ('win', 'podium', 'points', 'nopoints')),
      tone          TEXT NOT NULL CHECK (tone IN ('warm', 'fair', 'cold')),
      driver        TEXT NOT NULL,
      position      INTEGER NOT NULL,
      fans          INTEGER NOT NULL DEFAULT 0,
      date          TEXT NOT NULL,
      UNIQUE (garage_id, round_id)
    );
  `,
};

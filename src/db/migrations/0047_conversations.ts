// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 47: social occasions. Each conversation the player has at an occasion is kept, with
 * who they talked to, how, and what came of it.
 */
export const migration0047: Migration = {
  version: 47,
  name: 'conversations',
  sql: `
    CREATE TABLE conversation (
      id           INTEGER PRIMARY KEY,
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      season_id    INTEGER NOT NULL REFERENCES season (id),
      occasion     TEXT NOT NULL,
      party_type   TEXT NOT NULL,
      party_id     INTEGER NOT NULL,
      manner       TEXT NOT NULL CHECK (manner IN ('warm', 'direct', 'bold', 'discreet')),
      delta        INTEGER NOT NULL,
      trouble      INTEGER NOT NULL DEFAULT 0 CHECK (trouble IN (0, 1)),
      introduced   INTEGER NOT NULL DEFAULT 0 CHECK (introduced IN (0, 1)),
      met          INTEGER NOT NULL DEFAULT 0 CHECK (met IN (0, 1)),
      date         TEXT NOT NULL
    );
    CREATE INDEX conversation_garage ON conversation (garage_id, season_id, occasion);
  `,
};

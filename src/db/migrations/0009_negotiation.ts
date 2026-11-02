// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 9: negotiations, their offers and the relationships between parties (milestone M4). */
export const migration0009: Migration = {
  version: 9,
  name: 'negotiation',
  sql: `
    CREATE TABLE negotiation (
      id             INTEGER PRIMARY KEY,
      kind           TEXT NOT NULL CHECK (kind IN ('driver_contract')),
      window         TEXT NOT NULL,
      party_a_type   TEXT NOT NULL,
      party_a_id     INTEGER NOT NULL,
      party_b_type   TEXT NOT NULL,
      party_b_id     INTEGER NOT NULL,
      status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'walked')),
      patience_left  INTEGER NOT NULL CHECK (patience_left >= 0),
      counters       INTEGER NOT NULL DEFAULT 0,
      fair_value     REAL NOT NULL,
      walk_away      REAL NOT NULL
    );
    CREATE INDEX negotiation_parties ON negotiation (party_a_type, party_a_id, party_b_type, party_b_id);

    CREATE TABLE offer (
      id              INTEGER PRIMARY KEY,
      negotiation_id  INTEGER NOT NULL REFERENCES negotiation (id),
      round_no        INTEGER NOT NULL,
      from_side       TEXT NOT NULL CHECK (from_side IN ('a', 'b')),
      terms           TEXT NOT NULL,
      value           REAL NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('accepted', 'countered', 'walked'))
    );

    CREATE TABLE relationship (
      party_a_type  TEXT NOT NULL,
      party_a_id    INTEGER NOT NULL,
      party_b_type  TEXT NOT NULL,
      party_b_id    INTEGER NOT NULL,
      score         INTEGER NOT NULL CHECK (score BETWEEN -100 AND 100),
      PRIMARY KEY (party_a_type, party_a_id, party_b_type, party_b_id)
    );
  `,
};

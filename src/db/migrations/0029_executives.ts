// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 29: executives. A garage can appoint one executive to each role; they are hired by
 * negotiation, so the negotiation tables are rebuilt once more to allow that kind (SQLite cannot
 * change a CHECK in place), keeping every existing row.
 */
export const migration0029: Migration = {
  version: 29,
  name: 'executives',
  sql: `
    CREATE TABLE executive (
      id          INTEGER PRIMARY KEY,
      garage_id   INTEGER NOT NULL REFERENCES garage (id),
      role        TEXT NOT NULL CHECK (role IN (
        'chief_executive', 'commercial_director', 'contracts_director', 'head_of_marketing',
        'operations_director', 'finance_director', 'technical_director', 'sporting_director')),
      name        TEXT NOT NULL,
      birth_year  INTEGER NOT NULL,
      skill       INTEGER NOT NULL CHECK (skill BETWEEN 0 AND 100),
      status      TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'employed', 'left')),
      salary      INTEGER NOT NULL DEFAULT 0 CHECK (salary >= 0),
      start_year  INTEGER,
      end_year    INTEGER,
      hired_on    TEXT,
      left_on     TEXT
    );
    CREATE INDEX executive_garage ON executive (garage_id, status);
    CREATE UNIQUE INDEX executive_role ON executive (garage_id, role) WHERE status = 'employed';

    CREATE TABLE negotiation_v4 (
      id             INTEGER PRIMARY KEY,
      kind           TEXT NOT NULL CHECK (kind IN ('driver_contract', 'sponsor_deal', 'supplier_deal', 'manufacturer_deal', 'executive_contract')),
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
    INSERT INTO negotiation_v4 SELECT * FROM negotiation;

    CREATE TABLE offer_v4 (
      id              INTEGER PRIMARY KEY,
      negotiation_id  INTEGER NOT NULL REFERENCES negotiation_v4 (id),
      round_no        INTEGER NOT NULL,
      from_side       TEXT NOT NULL CHECK (from_side IN ('a', 'b')),
      terms           TEXT NOT NULL,
      value           REAL NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('accepted', 'countered', 'walked'))
    );
    INSERT INTO offer_v4 SELECT * FROM offer;

    DROP TABLE offer;
    DROP TABLE negotiation;
    ALTER TABLE negotiation_v4 RENAME TO negotiation;
    ALTER TABLE offer_v4 RENAME TO offer;
    CREATE INDEX negotiation_parties ON negotiation (party_a_type, party_a_id, party_b_type, party_b_id);
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 12: supplier and manufacturer discount deals (milestone M4). The negotiation
 * tables are rebuilt again so negotiations can be about these deals (SQLite cannot change a CHECK
 * in place), keeping every existing row.
 */
export const migration0012: Migration = {
  version: 12,
  name: 'deals',
  sql: `
    CREATE TABLE supplier_deal (
      id           INTEGER PRIMARY KEY,
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      supplier_id  INTEGER NOT NULL REFERENCES part_supplier (id),
      start_year   INTEGER NOT NULL,
      end_year     INTEGER NOT NULL,
      discount     REAL NOT NULL CHECK (discount BETWEEN 0 AND 1),
      CHECK (end_year >= start_year)
    );
    CREATE INDEX supplier_deal_garage ON supplier_deal (garage_id);

    CREATE TABLE manufacturer_deal (
      id               INTEGER PRIMARY KEY,
      garage_id        INTEGER NOT NULL REFERENCES garage (id),
      manufacturer_id  INTEGER NOT NULL REFERENCES manufacturer (id),
      start_year       INTEGER NOT NULL,
      end_year         INTEGER NOT NULL,
      discount         REAL NOT NULL CHECK (discount BETWEEN 0 AND 1),
      CHECK (end_year >= start_year)
    );
    CREATE INDEX manufacturer_deal_garage ON manufacturer_deal (garage_id);

    CREATE TABLE negotiation_v3 (
      id             INTEGER PRIMARY KEY,
      kind           TEXT NOT NULL CHECK (kind IN ('driver_contract', 'sponsor_deal', 'supplier_deal', 'manufacturer_deal')),
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
    INSERT INTO negotiation_v3 SELECT * FROM negotiation;

    CREATE TABLE offer_v3 (
      id              INTEGER PRIMARY KEY,
      negotiation_id  INTEGER NOT NULL REFERENCES negotiation_v3 (id),
      round_no        INTEGER NOT NULL,
      from_side       TEXT NOT NULL CHECK (from_side IN ('a', 'b')),
      terms           TEXT NOT NULL,
      value           REAL NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('accepted', 'countered', 'walked'))
    );
    INSERT INTO offer_v3 SELECT * FROM offer;

    DROP TABLE offer;
    DROP TABLE negotiation;
    ALTER TABLE negotiation_v3 RENAME TO negotiation;
    ALTER TABLE offer_v3 RENAME TO offer;
    CREATE INDEX negotiation_parties ON negotiation (party_a_type, party_a_id, party_b_type, party_b_id);
  `,
};

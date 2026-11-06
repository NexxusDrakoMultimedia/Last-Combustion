// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 30: supply contracts. A garage can sign a contract with an operating supplier
 * (electricity, water, race fuel, travel fuel, logistics), which fixes its price for the length of
 * the deal. The negotiation tables are rebuilt once more to allow the new kind (SQLite cannot change
 * a CHECK in place), keeping every existing row.
 */
export const migration0030: Migration = {
  version: 30,
  name: 'supply',
  sql: `
    CREATE TABLE supply_contract (
      id           INTEGER PRIMARY KEY,
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      category     TEXT NOT NULL CHECK (category IN ('electricity', 'water', 'race_fuel', 'travel_fuel', 'logistics')),
      supplier_id  INTEGER NOT NULL,
      start_year   INTEGER NOT NULL,
      end_year     INTEGER NOT NULL CHECK (end_year >= start_year),
      discount     REAL NOT NULL CHECK (discount BETWEEN 0 AND 1),
      rate         REAL NOT NULL CHECK (rate > 0)
    );
    CREATE INDEX supply_contract_garage ON supply_contract (garage_id, category);

    CREATE TABLE negotiation_v5 (
      id             INTEGER PRIMARY KEY,
      kind           TEXT NOT NULL CHECK (kind IN ('driver_contract', 'sponsor_deal', 'supplier_deal', 'manufacturer_deal', 'executive_contract', 'supply_contract')),
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
    INSERT INTO negotiation_v5 SELECT * FROM negotiation;

    CREATE TABLE offer_v5 (
      id              INTEGER PRIMARY KEY,
      negotiation_id  INTEGER NOT NULL REFERENCES negotiation_v5 (id),
      round_no        INTEGER NOT NULL,
      from_side       TEXT NOT NULL CHECK (from_side IN ('a', 'b')),
      terms           TEXT NOT NULL,
      value           REAL NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('accepted', 'countered', 'walked'))
    );
    INSERT INTO offer_v5 SELECT * FROM offer;

    DROP TABLE offer;
    DROP TABLE negotiation;
    ALTER TABLE negotiation_v5 RENAME TO negotiation;
    ALTER TABLE offer_v5 RENAME TO offer;
    CREATE INDEX negotiation_parties ON negotiation (party_a_type, party_a_id, party_b_type, party_b_id);
  `,
};

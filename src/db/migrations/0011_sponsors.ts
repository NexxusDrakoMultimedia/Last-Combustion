// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 11: sponsors and sponsor deals (milestone M4). Negotiations can now be about
 * sponsor deals as well as driver contracts, so the negotiation tables are rebuilt with the wider
 * list of kinds (SQLite cannot change a CHECK in place).
 */
export const migration0011: Migration = {
  version: 11,
  name: 'sponsors',
  sql: `
    CREATE TABLE sponsor (
      id            INTEGER PRIMARY KEY,
      stable_id     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      home_country  TEXT NOT NULL,
      tier          TEXT NOT NULL CHECK (tier IN ('local', 'regional', 'national', 'global')),
      min_prestige  INTEGER NOT NULL CHECK (min_prestige >= 1),
      strength      INTEGER NOT NULL CHECK (strength BETWEEN 0 AND 100)
    );

    CREATE TABLE sponsor_deal (
      id          INTEGER PRIMARY KEY,
      garage_id   INTEGER NOT NULL REFERENCES garage (id),
      sponsor_id  INTEGER NOT NULL REFERENCES sponsor (id),
      start_year  INTEGER NOT NULL,
      end_year    INTEGER NOT NULL,
      season_fee  INTEGER NOT NULL CHECK (season_fee >= 0),
      is_title    INTEGER NOT NULL DEFAULT 1 CHECK (is_title IN (0, 1)),
      CHECK (end_year >= start_year)
    );
    CREATE INDEX sponsor_deal_garage ON sponsor_deal (garage_id);

    CREATE TABLE negotiation_v2 (
      id             INTEGER PRIMARY KEY,
      kind           TEXT NOT NULL CHECK (kind IN ('driver_contract', 'sponsor_deal')),
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
    INSERT INTO negotiation_v2 SELECT * FROM negotiation;

    CREATE TABLE offer_v2 (
      id              INTEGER PRIMARY KEY,
      negotiation_id  INTEGER NOT NULL REFERENCES negotiation_v2 (id),
      round_no        INTEGER NOT NULL,
      from_side       TEXT NOT NULL CHECK (from_side IN ('a', 'b')),
      terms           TEXT NOT NULL,
      value           REAL NOT NULL,
      outcome         TEXT NOT NULL CHECK (outcome IN ('accepted', 'countered', 'walked'))
    );
    INSERT INTO offer_v2 SELECT * FROM offer;

    DROP TABLE offer;
    DROP TABLE negotiation;
    ALTER TABLE negotiation_v2 RENAME TO negotiation;
    ALTER TABLE offer_v2 RENAME TO offer;
    CREATE INDEX negotiation_parties ON negotiation (party_a_type, party_a_id, party_b_type, party_b_id);
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 7: aftermarket parts and the parts fitted to each car (milestone M4, upgrades). */
export const migration0007: Migration = {
  version: 7,
  name: 'parts',
  sql: `
    CREATE TABLE part_supplier (
      id            INTEGER PRIMARY KEY,
      stable_id     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      home_country  TEXT NOT NULL
    );

    CREATE TABLE part (
      id              INTEGER PRIMARY KEY,
      stable_id       TEXT NOT NULL UNIQUE,
      supplier_id     INTEGER NOT NULL REFERENCES part_supplier (id),
      category        TEXT NOT NULL,
      grade           TEXT NOT NULL CHECK (grade IN ('street', 'sport', 'race')),
      name            TEXT NOT NULL,
      price           INTEGER NOT NULL CHECK (price >= 0),
      ps_pct          REAL NOT NULL,
      delta_kg        INTEGER NOT NULL,
      delta_grip      REAL NOT NULL,
      delta_handling  REAL NOT NULL,
      delta_traction  REAL NOT NULL,
      tyre_mm         INTEGER NOT NULL,
      legality_cost   INTEGER NOT NULL CHECK (legality_cost >= 0)
    );

    CREATE TABLE car_part (
      id              INTEGER PRIMARY KEY,
      car_id          INTEGER NOT NULL REFERENCES car (id),
      part_id         INTEGER NOT NULL REFERENCES part (id),
      category        TEXT NOT NULL,
      installed_date  TEXT NOT NULL,
      UNIQUE (car_id, category)
    );
  `,
};

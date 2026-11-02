// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 6: the used market (milestone M4). A hidden "market" garage owns cars that are
 * for sale, and a listing says at what price.
 */
export const migration0006: Migration = {
  version: 6,
  name: 'market',
  sql: `
    ALTER TABLE garage ADD COLUMN kind TEXT NOT NULL DEFAULT 'racing' CHECK (kind IN ('racing', 'market'));

    CREATE TABLE market_listing (
      id           INTEGER PRIMARY KEY,
      car_id       INTEGER NOT NULL REFERENCES car (id),
      price        INTEGER NOT NULL CHECK (price >= 0),
      listed_date  TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'withdrawn')),
      sold_date    TEXT
    );
    CREATE UNIQUE INDEX market_listing_open ON market_listing (car_id) WHERE status = 'open';
  `,
};

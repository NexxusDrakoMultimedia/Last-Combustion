// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 8: the auction house (milestone M4). */
export const migration0008: Migration = {
  version: 8,
  name: 'auctions',
  sql: `
    CREATE TABLE auction (
      id         INTEGER PRIMARY KEY,
      kind       TEXT NOT NULL CHECK (kind IN ('weekly', 'festival')),
      opens_on   TEXT NOT NULL,
      closes_on  TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      CHECK (closes_on >= opens_on)
    );

    CREATE TABLE auction_lot (
      id               INTEGER PRIMARY KEY,
      auction_id       INTEGER NOT NULL REFERENCES auction (id),
      car_id           INTEGER NOT NULL REFERENCES car (id),
      seller_garage_id INTEGER NOT NULL REFERENCES garage (id),
      reserve          INTEGER NOT NULL CHECK (reserve >= 0),
      final_price      INTEGER,
      buyer_garage_id  INTEGER REFERENCES garage (id),
      status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'unsold')),
      UNIQUE (auction_id, car_id)
    );

    CREATE TABLE auction_bid (
      id                INTEGER PRIMARY KEY,
      lot_id            INTEGER NOT NULL REFERENCES auction_lot (id),
      bidder_garage_id  INTEGER NOT NULL REFERENCES garage (id),
      amount            INTEGER NOT NULL CHECK (amount > 0),
      placed_on         TEXT NOT NULL
    );
  `,
};

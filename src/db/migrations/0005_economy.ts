// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 5: who has owned each chassis (milestone M4, car purchase). */
export const migration0005: Migration = {
  version: 5,
  name: 'economy',
  sql: `
    CREATE TABLE car_ownership (
      id         INTEGER PRIMARY KEY,
      car_id     INTEGER NOT NULL REFERENCES car (id),
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      from_date  TEXT NOT NULL,
      to_date    TEXT,
      price      INTEGER NOT NULL CHECK (price >= 0),
      route      TEXT NOT NULL CHECK (route IN ('new', 'used', 'auction', 'private')),
      CHECK (to_date IS NULL OR to_date >= from_date)
    );
    CREATE INDEX car_ownership_car ON car_ownership (car_id);
  `,
};

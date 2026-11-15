// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 61: paid inspections. A garage can pay to inspect a car for sale, which takes it to
 * exact for that sale: the row keeps who owned the car when it was inspected (`seller_garage_id`), so
 * the inspection stops counting once the car has a different owner. A save from an earlier version
 * starts with none.
 */
export const migration0061: Migration = {
  version: 61,
  name: 'car_inspection',
  sql: `
    CREATE TABLE car_inspection (
      garage_id        INTEGER NOT NULL REFERENCES garage (id),
      car_id           INTEGER NOT NULL REFERENCES car (id),
      seller_garage_id INTEGER NOT NULL REFERENCES garage (id),
      inspected_on     TEXT NOT NULL,
      fee              INTEGER NOT NULL CHECK (fee >= 0),
      PRIMARY KEY (garage_id, car_id)
    );
  `,
};

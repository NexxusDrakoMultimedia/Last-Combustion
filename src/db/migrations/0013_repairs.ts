// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 13: wear on fitted parts, and a chassis wear offset that a restoration sets
 * (chassis wear comes from kilometres, so a restoration records how much wear it took away).
 */
export const migration0013: Migration = {
  version: 13,
  name: 'repairs',
  sql: `
    ALTER TABLE car_part ADD COLUMN wear REAL NOT NULL DEFAULT 0 CHECK (wear BETWEEN 0 AND 100);
    ALTER TABLE car ADD COLUMN wear_offset REAL NOT NULL DEFAULT 0 CHECK (wear_offset >= 0);
  `,
};

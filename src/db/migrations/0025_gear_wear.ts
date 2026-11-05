// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Gear wears with racing, like parts do: 0 is new, 100 is worn out. */
export const migration0025: Migration = {
  version: 25,
  name: 'gear_wear',
  sql: `
    ALTER TABLE driver_gear ADD COLUMN wear REAL NOT NULL DEFAULT 0 CHECK (wear BETWEEN 0 AND 100);
  `,
};

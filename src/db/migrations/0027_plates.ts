// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Every car is identified by its Australian licence plate and the state or territory that issued it. */
export const migration0027: Migration = {
  version: 27,
  name: 'plates',
  sql: `
    ALTER TABLE car ADD COLUMN plate TEXT;
    ALTER TABLE car ADD COLUMN plate_state TEXT
      CHECK (plate_state IN ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'));
    -- A plate is unique within its state; a personalised plate may be the same in two states.
    CREATE UNIQUE INDEX car_plate ON car (plate_state, plate) WHERE plate IS NOT NULL;
  `,
};

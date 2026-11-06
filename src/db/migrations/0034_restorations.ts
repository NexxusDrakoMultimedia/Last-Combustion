// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 34: full restorations. A chassis can be fully restored, which takes most of its
 * wear away but leaves a floor that rises with each restoration, so `car.restorations` counts them.
 */
export const migration0034: Migration = {
  version: 34,
  name: 'restorations',
  sql: `
    ALTER TABLE car ADD COLUMN restorations INTEGER NOT NULL DEFAULT 0 CHECK (restorations >= 0);
  `,
};

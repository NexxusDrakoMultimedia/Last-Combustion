// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** How many season ends in a row a computer garage has finished with negative cash (two folds it). */
export const migration0024: Migration = {
  version: 24,
  name: 'garage_finances',
  sql: `
    ALTER TABLE garage ADD COLUMN broke_years INTEGER NOT NULL DEFAULT 0;
  `,
};

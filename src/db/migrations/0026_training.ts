// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** A driver's training level (0 none, 3 elite), set by the garage and paid for at the season end. */
export const migration0026: Migration = {
  version: 26,
  name: 'training',
  sql: `
    ALTER TABLE driver ADD COLUMN training INTEGER NOT NULL DEFAULT 0 CHECK (training BETWEEN 0 AND 3);
  `,
};

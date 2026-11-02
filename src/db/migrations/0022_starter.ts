// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** The starter cars and driver prospects a new owner chooses between, until they choose. */
export const migration0022: Migration = {
  version: 22,
  name: 'starter',
  sql: `
    CREATE TABLE starter_offer (
      id          INTEGER PRIMARY KEY,
      kind        TEXT NOT NULL CHECK (kind IN ('car', 'driver')),
      subject_id  INTEGER NOT NULL,
      UNIQUE (kind, subject_id)
    );
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/** Marks the dragon-blooded characters (shown with a dragon emoji). */
export const migration0020: Migration = {
  version: 20,
  name: 'easter_egg',
  sql: `
    ALTER TABLE driver ADD COLUMN easter_egg INTEGER NOT NULL DEFAULT 0 CHECK (easter_egg IN (0, 1));
  `,
};

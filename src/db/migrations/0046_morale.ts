// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 46: morale. Mechanics and executives each have a morale from 0 to 100, which
 * starts at 50 (no effect) for everyone already in a save.
 */
export const migration0046: Migration = {
  version: 46,
  name: 'morale',
  sql: `
    ALTER TABLE staff ADD COLUMN morale INTEGER NOT NULL DEFAULT 50 CHECK (morale BETWEEN 0 AND 100);
    ALTER TABLE executive ADD COLUMN morale INTEGER NOT NULL DEFAULT 50 CHECK (morale BETWEEN 0 AND 100);
  `,
};

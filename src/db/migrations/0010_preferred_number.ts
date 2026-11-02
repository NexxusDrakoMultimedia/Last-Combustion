// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 10: a driver's preferred number, the number they chose for themselves. It stays
 * part of their legacy even when a ranked number (1 to 40) has to be taken instead.
 */
export const migration0010: Migration = {
  version: 10,
  name: 'preferred_number',
  sql: `
    ALTER TABLE driver ADD COLUMN preferred_number INTEGER CHECK (preferred_number IS NULL OR preferred_number >= 1);
  `,
};

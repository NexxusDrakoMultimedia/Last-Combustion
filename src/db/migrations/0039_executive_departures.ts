// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 39: why an executive left (a contract that ran out, dismissal, retirement or a rival
 * poaching them). Executives who left before this version have no reason recorded.
 */
export const migration0039: Migration = {
  version: 39,
  name: 'executive_departures',
  sql: `
    ALTER TABLE executive ADD COLUMN left_reason TEXT
      CHECK (left_reason IN ('contract', 'dismissed', 'retired', 'poached'));
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * A driver's contract sets how much of the driver's prize money the garage keeps; the driver
 * takes the rest, and it is kept on the driver as personal earnings.
 */
export const migration0023: Migration = {
  version: 23,
  name: 'prize_share',
  sql: `
    ALTER TABLE contract ADD COLUMN garage_prize_share REAL NOT NULL DEFAULT 0.8
      CHECK (garage_prize_share BETWEEN 0.3 AND 1);
    ALTER TABLE driver ADD COLUMN earnings INTEGER NOT NULL DEFAULT 0;
  `,
};

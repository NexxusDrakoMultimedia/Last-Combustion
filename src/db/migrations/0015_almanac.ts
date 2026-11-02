// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 15: the year a garage stopped operating, for the almanac (milestone M5). */
export const migration0015: Migration = {
  version: 15,
  name: 'almanac',
  sql: `
    ALTER TABLE garage ADD COLUMN closed_year INTEGER;
  `,
};

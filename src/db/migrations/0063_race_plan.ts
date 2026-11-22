// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 63: what the calendar needs to know about a race under way. The prelims of a round
 * are played on days the weather has already settled, so when they are started the dates of the seven
 * prelim days are kept here, small and cheap to read, beside the large saved state. The calendar then
 * stops on each prelim day in turn. A row with no plan (a final) is `NULL`.
 */
export const migration0063: Migration = {
  version: 63,
  name: 'race_plan',
  sql: `
    ALTER TABLE race_state ADD COLUMN plan TEXT;
  `,
};

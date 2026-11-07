// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 50: deaths. A person can die in something that has nothing to do with racing. The
 * death is kept with who it was, when and how, and the person's own row records that they have gone
 * (a driver retires, a mechanic or an executive leaves).
 */
export const migration0050: Migration = {
  version: 50,
  name: 'deaths',
  sql: `
    CREATE TABLE death (
      id          INTEGER PRIMARY KEY,
      person_type TEXT NOT NULL CHECK (person_type IN ('driver', 'mechanic', 'executive')),
      person_id   INTEGER NOT NULL,
      name        TEXT NOT NULL,
      date        TEXT NOT NULL,
      cause       TEXT NOT NULL,
      UNIQUE (person_type, person_id)
    );
  `,
};

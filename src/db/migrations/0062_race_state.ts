// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 62: a race in progress. The prelims of a round are played a day at a time and the
 * final a sector at a time, and between steps the whole state is plain data kept here, so a save made
 * on prelim day 3 or lap 7 of a final loads and carries on. `input` freezes what the race was started
 * with (the field, their cars and drivers, the weather and the outages) so that changes made between
 * steps do not change the race already under way, and `state` is the snapshot of the engine. A row
 * lives only while the race is under way: finishing it writes the results as before and deletes the
 * row. A save from an earlier version has no rows, and a round with none is simply not started.
 */
export const migration0062: Migration = {
  version: 62,
  name: 'race_state',
  sql: `
    CREATE TABLE race_state (
      round_id   INTEGER NOT NULL REFERENCES round (id),
      kind       TEXT NOT NULL CHECK (kind IN ('prelims', 'final')),
      input      TEXT NOT NULL,
      state      TEXT NOT NULL,
      progress   INTEGER NOT NULL CHECK (progress >= 0),
      started_on TEXT NOT NULL,
      saved_on   TEXT NOT NULL,
      PRIMARY KEY (round_id, kind)
    );
  `,
};

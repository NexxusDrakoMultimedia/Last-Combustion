// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 58: the ghost record. Before a round's prelims the player picks a ghost for each of
 * their entries: Easy (two seconds ahead of the run) or Hard (a top driver's run on the course last
 * season, so `ghost_driver_id` is set). The prelims settle it: the ghost's time, the entry's own time and
 * whether the run beat a Hard ghost (`beaten`, left empty for Easy).
 */
export const migration0058: Migration = {
  version: 58,
  name: 'ghost',
  sql: `
    CREATE TABLE ghost_choice (
      round_id        INTEGER NOT NULL REFERENCES round (id),
      entry_id        INTEGER NOT NULL REFERENCES entry (id),
      mode            TEXT NOT NULL CHECK (mode IN ('easy', 'hard')),
      ghost_driver_id INTEGER REFERENCES driver (id),
      ghost_time_ms   INTEGER,
      own_time_ms     INTEGER,
      beaten          INTEGER CHECK (beaten IS NULL OR beaten IN (0, 1)),
      settled         INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),
      PRIMARY KEY (round_id, entry_id),
      CHECK ((mode = 'hard') = (ghost_driver_id IS NOT NULL))
    );
  `,
};

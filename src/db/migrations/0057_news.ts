// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 57: the world's news. After each final the press writes items about the winner, the
 * crash highlights, the rivalry meetings and the storyline beats, for any driver and garage (the player
 * garage's own result headline stays in `headline`). The text is built from the kind and detail at
 * display time. `ref_id` says which thing the item is about (an entry for a crash, a rivalry, a
 * storyline beat, or 0 for the winner), so a round writes each item once.
 */
export const migration0057: Migration = {
  version: 57,
  name: 'news',
  sql: `
    CREATE TABLE news (
      id              INTEGER PRIMARY KEY,
      round_id        INTEGER NOT NULL REFERENCES round (id),
      kind            TEXT NOT NULL CHECK (kind IN ('winner', 'crash', 'rivalry', 'story')),
      driver_id       INTEGER NOT NULL REFERENCES driver (id),
      other_driver_id INTEGER REFERENCES driver (id),
      detail          TEXT NOT NULL DEFAULT '',
      ref_id          INTEGER NOT NULL DEFAULT 0,
      journalist_id   INTEGER NOT NULL,
      date            TEXT NOT NULL,
      UNIQUE (round_id, kind, ref_id, detail)
    );
    CREATE INDEX news_round ON news (round_id);
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 56: storylines and event cards. A storyline is an arc from a data template (for now,
 * a rivalry that reached Feud) with the beats it has played, `highlighted` when it involves one of the
 * player's drivers and so gives cards. An event card offers the player's driver a choice at a beat; it
 * is pending until it is answered or the next round is run, which expires it.
 */
export const migration0056: Migration = {
  version: 56,
  name: 'storylines',
  sql: `
    CREATE TABLE storyline (
      id               INTEGER PRIMARY KEY,
      template         TEXT NOT NULL,
      rivalry_id       INTEGER NOT NULL REFERENCES rivalry (id),
      driver_a         INTEGER NOT NULL REFERENCES driver (id),
      driver_b         INTEGER NOT NULL REFERENCES driver (id),
      started_round_id INTEGER NOT NULL REFERENCES round (id),
      step             INTEGER NOT NULL DEFAULT 0 CHECK (step >= 0),
      status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete', 'ended')),
      highlighted      INTEGER NOT NULL DEFAULT 0 CHECK (highlighted IN (0, 1)),
      ended_round_id   INTEGER REFERENCES round (id),
      UNIQUE (template, rivalry_id),
      CHECK (driver_a < driver_b)
    );
    CREATE INDEX storyline_status ON storyline (status);

    CREATE TABLE storyline_beat (
      id           INTEGER PRIMARY KEY,
      storyline_id INTEGER NOT NULL REFERENCES storyline (id),
      step         INTEGER NOT NULL CHECK (step >= 0),
      beat         TEXT NOT NULL,
      round_id     INTEGER NOT NULL REFERENCES round (id),
      event_log_id INTEGER REFERENCES event_log (id),
      UNIQUE (storyline_id, step)
    );

    CREATE TABLE event_card (
      id           INTEGER PRIMARY KEY,
      storyline_id INTEGER NOT NULL REFERENCES storyline (id),
      beat         TEXT NOT NULL,
      driver_id    INTEGER NOT NULL REFERENCES driver (id),
      round_id     INTEGER NOT NULL REFERENCES round (id),
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'expired')),
      choice       TEXT,
      UNIQUE (storyline_id, beat, driver_id),
      CHECK ((status = 'answered') = (choice IS NOT NULL))
    );
    CREATE INDEX event_card_status ON event_card (status);
  `,
};

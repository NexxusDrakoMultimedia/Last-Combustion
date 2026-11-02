// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 3: sectors, results, the event log and driver gear (milestone M2). */
export const migration0003: Migration = {
  version: 3,
  name: 'prelims',
  sql: `
    CREATE TABLE sector (
      id                  INTEGER PRIMARY KEY,
      course_id           INTEGER NOT NULL REFERENCES course (id),
      sector_order        INTEGER NOT NULL,
      surface             TEXT NOT NULL CHECK (surface = 'sealed'),
      start_km            REAL NOT NULL,
      length_m            INTEGER NOT NULL,
      corner_density      REAL NOT NULL,
      straight_m          INTEGER NOT NULL,
      elevation_change_m  INTEGER NOT NULL,
      width_m             REAL NOT NULL,
      overtake_spot       INTEGER NOT NULL CHECK (overtake_spot IN (0, 1)),
      ref_seconds         REAL NOT NULL,
      UNIQUE (course_id, sector_order)
    );

    CREATE TABLE result (
      id                INTEGER PRIMARY KEY,
      round_id          INTEGER NOT NULL REFERENCES round (id),
      entry_id          INTEGER NOT NULL REFERENCES entry (id),
      run_day           INTEGER,
      run_slot          INTEGER,
      prelim_time_ms    INTEGER,
      prelim_pos        INTEGER,
      final_pos         INTEGER,
      final_time_ms     INTEGER,
      points            REAL NOT NULL DEFAULT 0,
      prize             INTEGER NOT NULL DEFAULT 0,
      pole              INTEGER NOT NULL DEFAULT 0 CHECK (pole IN (0, 1)),
      dnf_reason        TEXT,
      tyre_pct_at_flag  REAL,
      UNIQUE (round_id, entry_id)
    );
    CREATE INDEX result_round ON result (round_id);

    CREATE TABLE event_log (
      id           INTEGER PRIMARY KEY,
      round_id     INTEGER REFERENCES round (id),
      scope        TEXT NOT NULL CHECK (scope IN ('practice', 'prelim', 'final', 'event', 'season')),
      occurred_on  TEXT NOT NULL,
      km           REAL,
      type         TEXT NOT NULL,
      entry_id     INTEGER REFERENCES entry (id),
      payload      TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX event_log_round ON event_log (round_id);

    CREATE TABLE commentator (
      id               INTEGER PRIMARY KEY,
      stable_id        TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      flag             TEXT NOT NULL,
      hometown_place_id INTEGER NOT NULL REFERENCES place (id),
      background       TEXT NOT NULL,
      role             TEXT NOT NULL,
      focus            TEXT NOT NULL,
      voice            TEXT NOT NULL
    );

    CREATE TABLE gear_supplier (
      id            INTEGER PRIMARY KEY,
      stable_id     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      home_country  TEXT NOT NULL
    );

    CREATE TABLE gear_item (
      id           INTEGER PRIMARY KEY,
      stable_id    TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      slot         TEXT NOT NULL CHECK (slot IN ('helmet', 'suit', 'gloves', 'boots', 'trinket')),
      tier         TEXT NOT NULL CHECK (tier IN ('basic', 'club', 'pro', 'elite', 'legendary')),
      supplier_id  INTEGER REFERENCES gear_supplier (id),
      price        INTEGER NOT NULL CHECK (price >= 0),
      stats        TEXT NOT NULL
    );

    CREATE TABLE driver_gear (
      driver_id  INTEGER NOT NULL REFERENCES driver (id),
      item_id    INTEGER NOT NULL REFERENCES gear_item (id),
      PRIMARY KEY (driver_id, item_id)
    );
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 1: the minimum needed to create, save and load a career.
 * Later milestones add the rest of the data model (see the GDD, "Data model").
 */
export const migration0001: Migration = {
  version: 1,
  name: 'initial',
  sql: `
    CREATE TABLE meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE career (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      mode            TEXT    NOT NULL CHECK (mode IN ('garage_owner', 'owner_driver', 'driver_manager')),
      master_seed     TEXT    NOT NULL,
      start_year      INTEGER NOT NULL,
      game_date       TEXT    NOT NULL,
      difficulty      TEXT    NOT NULL CHECK (difficulty IN ('relaxed', 'standard', 'hard')),
      founder_career  INTEGER NOT NULL DEFAULT 0 CHECK (founder_career IN (0, 1))
    );
  `,
};

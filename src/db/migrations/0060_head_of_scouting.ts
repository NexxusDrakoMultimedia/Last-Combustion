// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 60: the Head of Scouting, a ninth executive role. SQLite cannot change a CHECK in place,
 * so the `executive` table is rebuilt with the new role allowed, keeping every row and column (nothing
 * references the table by a foreign key; people of every kind are found by type and id).
 */
export const migration0060: Migration = {
  version: 60,
  name: 'head_of_scouting',
  sql: `
    CREATE TABLE executive_v2 (
      id          INTEGER PRIMARY KEY,
      garage_id   INTEGER NOT NULL REFERENCES garage (id),
      role        TEXT NOT NULL CHECK (role IN (
        'chief_executive', 'commercial_director', 'contracts_director', 'head_of_marketing',
        'operations_director', 'finance_director', 'technical_director', 'sporting_director',
        'head_of_scouting')),
      name        TEXT NOT NULL,
      birth_year  INTEGER NOT NULL,
      skill       INTEGER NOT NULL CHECK (skill BETWEEN 0 AND 100),
      status      TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'employed', 'left')),
      salary      INTEGER NOT NULL DEFAULT 0 CHECK (salary >= 0),
      start_year  INTEGER,
      end_year    INTEGER,
      hired_on    TEXT,
      left_on     TEXT,
      left_reason TEXT CHECK (left_reason IN ('contract', 'dismissed', 'retired', 'poached')),
      morale      INTEGER NOT NULL DEFAULT 50 CHECK (morale BETWEEN 0 AND 100),
      nationality TEXT,
      hometown_place_id  INTEGER REFERENCES place (id),
      residence_place_id INTEGER REFERENCES place (id)
    );
    INSERT INTO executive_v2 (id, garage_id, role, name, birth_year, skill, status, salary, start_year,
        end_year, hired_on, left_on, left_reason, morale, nationality, hometown_place_id, residence_place_id)
      SELECT id, garage_id, role, name, birth_year, skill, status, salary, start_year,
        end_year, hired_on, left_on, left_reason, morale, nationality, hometown_place_id, residence_place_id
      FROM executive;
    DROP TABLE executive;
    ALTER TABLE executive_v2 RENAME TO executive;
    CREATE INDEX executive_garage ON executive (garage_id, status);
    CREATE UNIQUE INDEX executive_role ON executive (garage_id, role) WHERE status = 'employed';
  `,
};

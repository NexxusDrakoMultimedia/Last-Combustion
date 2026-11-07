// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 40: a summary of each garage's books for every financial year that has closed.
 * A financial year is a season's year and closes on 11 November (the day the season ends), so lines
 * dated after it belong to the next year. Years that closed before this version are summed from the
 * ledger lines now; from here on the summary is written when a season ends.
 */
export const migration0040: Migration = {
  version: 40,
  name: 'ledger_year',
  sql: `
    CREATE TABLE ledger_year (
      garage_id  INTEGER NOT NULL REFERENCES garage (id),
      year       INTEGER NOT NULL,
      category   TEXT NOT NULL,
      income     INTEGER NOT NULL CHECK (income >= 0),
      spending   INTEGER NOT NULL CHECK (spending >= 0),
      PRIMARY KEY (garage_id, year, category)
    );

    INSERT INTO ledger_year (garage_id, year, category, income, spending)
      SELECT garage_id, fy, category,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),
             SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)
        FROM (SELECT garage_id, category, amount,
                     CAST(substr(date, 1, 4) AS INTEGER) + (substr(date, 6, 5) > '11-11') AS fy
                FROM ledger)
       WHERE fy IN (SELECT year FROM season WHERE status = 'complete')
       GROUP BY garage_id, fy, category;
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * How a driver is described: masculine, feminine or non-binary. `driver.gender` stays as the name
 * pool the driver's name came from (it keeps its male or female check); this column is what the
 * game shows, as pronouns and the male, female or combined sign.
 */
export const migration0019: Migration = {
  version: 19,
  name: 'identity',
  sql: `
    ALTER TABLE driver ADD COLUMN identity TEXT NOT NULL DEFAULT 'masculine'
      CHECK (identity IN ('masculine', 'feminine', 'non_binary'));
    UPDATE driver SET identity = CASE gender WHEN 'female' THEN 'feminine' ELSE 'masculine' END;
  `,
};

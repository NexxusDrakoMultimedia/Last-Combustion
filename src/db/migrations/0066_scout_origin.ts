// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 66: scouts are from somewhere. Like an executive or a mechanic, a scout has a
 * nationality (their flag), a hometown and a residence. A scout on the books keeps them empty until the
 * game fills them in from the seed the first time they are read, so a save has them too.
 */
export const migration0066: Migration = {
  version: 66,
  name: 'scout_origin',
  sql: `
    ALTER TABLE scout ADD COLUMN nationality TEXT;
    ALTER TABLE scout ADD COLUMN hometown_place_id INTEGER REFERENCES place (id);
    ALTER TABLE scout ADD COLUMN residence_place_id INTEGER REFERENCES place (id);
  `,
};

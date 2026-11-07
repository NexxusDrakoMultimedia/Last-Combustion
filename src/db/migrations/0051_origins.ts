// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 51: where people and companies are from. An executive, a mechanic and a shareholder
 * has a nationality (their flag), a hometown and a residence; a manufacturer, a sponsor and a parts
 * supplier has a headquarters. They start empty and the game fills them in from the seed the first time
 * they are read, so a save from an earlier version has them too.
 */
export const migration0051: Migration = {
  version: 51,
  name: 'origins',
  sql: `
    ALTER TABLE executive ADD COLUMN nationality TEXT;
    ALTER TABLE executive ADD COLUMN hometown_place_id INTEGER REFERENCES place (id);
    ALTER TABLE executive ADD COLUMN residence_place_id INTEGER REFERENCES place (id);

    ALTER TABLE staff ADD COLUMN nationality TEXT;
    ALTER TABLE staff ADD COLUMN hometown_place_id INTEGER REFERENCES place (id);
    ALTER TABLE staff ADD COLUMN residence_place_id INTEGER REFERENCES place (id);

    ALTER TABLE shareholding ADD COLUMN nationality TEXT;
    ALTER TABLE shareholding ADD COLUMN hometown_place_id INTEGER REFERENCES place (id);
    ALTER TABLE shareholding ADD COLUMN residence_place_id INTEGER REFERENCES place (id);

    ALTER TABLE manufacturer ADD COLUMN hq_place_id INTEGER REFERENCES place (id);
    ALTER TABLE sponsor ADD COLUMN hq_place_id INTEGER REFERENCES place (id);
    ALTER TABLE part_supplier ADD COLUMN hq_place_id INTEGER REFERENCES place (id);
  `,
};

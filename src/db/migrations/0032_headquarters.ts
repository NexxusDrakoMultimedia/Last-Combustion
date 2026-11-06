// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 32: headquarters. A garage must be based in an Australian state or territory to
 * race in the series, and its flag shows where its main factory, founder, owner or executive office
 * is. So a garage now has two places: `base_place_id`, where it works and races from (always in
 * Australia), and `hq_place_id`, where its flag comes from (anywhere). Every existing garage keeps
 * its old place as its headquarters; one based abroad moves its base to an Australian place picked
 * from its id, so the same save always gives the same result.
 */
export const migration0032: Migration = {
  version: 32,
  name: 'headquarters',
  sql: `
    ALTER TABLE garage ADD COLUMN hq_place_id INTEGER REFERENCES place (id);
    UPDATE garage SET hq_place_id = base_place_id;
    UPDATE garage
       SET base_place_id = (
         SELECT p.id FROM place p
          WHERE p.country = 'AU'
            AND (SELECT COUNT(*) FROM place q WHERE q.country = 'AU' AND q.id < p.id)
                = garage.id % (SELECT COUNT(*) FROM place WHERE country = 'AU'))
     WHERE (SELECT country FROM place WHERE id = garage.base_place_id) <> 'AU';
    UPDATE garage SET home_state = (SELECT region FROM place WHERE id = garage.base_place_id);
  `,
};

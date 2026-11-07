// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { relationshipKind, type RelationshipKind } from '../sim/relationships';
import { supplierById } from '../sim/supply';
import { all } from './entries';

export type ContactType = 'sponsor' | 'utility' | 'supplier' | 'manufacturer' | 'executive';

export interface Contact {
  type: ContactType;
  id: number;
  name: string;
  /** -100 to +100. */
  score: number;
  kind: RelationshipKind;
}

const NAME_SQL: Record<Exclude<ContactType, 'utility'>, string> = {
  sponsor: 'SELECT name FROM sponsor WHERE id = ?',
  supplier: 'SELECT name FROM part_supplier WHERE id = ?',
  manufacturer: 'SELECT name FROM manufacturer WHERE id = ?',
  executive: 'SELECT name FROM executive WHERE id = ?',
};

/**
 * The garage's contacts book: everyone it has dealt with, the best relationships first. A party
 * whose name cannot be found (a supplier no longer in the data) is left out.
 */
export function contactsBook(db: Database, garageId: number): Contact[] {
  const out: Contact[] = [];
  for (const r of all(
    db,
    `SELECT party_b_type AS type, party_b_id AS id, score FROM relationship
      WHERE party_a_type = 'garage' AND party_a_id = ? ORDER BY score DESC, party_b_type, party_b_id`,
    [garageId],
  )) {
    const type = r.type as ContactType;
    const id = r.id as number;
    const name =
      type === 'utility'
        ? supplierById(id)?.name
        : NAME_SQL[type]
          ? (all(db, NAME_SQL[type], [id])[0]?.name as string | undefined)
          : undefined;
    if (!name) continue;
    const score = r.score as number;
    out.push({ type, id, name, score, kind: relationshipKind(score) });
  }
  return out;
}

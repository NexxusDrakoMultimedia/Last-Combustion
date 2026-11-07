// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { relationshipKind, type RelationshipKind } from '../sim/relationships';
import { journalistById } from '../sim/press';
import { supplierById } from '../sim/supply';
import { all } from './entries';

export type ContactType =
  'sponsor' | 'utility' | 'supplier' | 'manufacturer' | 'executive' | 'journalist';

export interface Contact {
  type: ContactType;
  id: number;
  name: string;
  /** -100 to +100. */
  score: number;
  kind: RelationshipKind;
}

const NAME_SQL: Record<Exclude<ContactType, 'utility' | 'journalist'>, string> = {
  sponsor: 'SELECT name FROM sponsor WHERE id = ?',
  supplier: 'SELECT name FROM part_supplier WHERE id = ?',
  manufacturer: 'SELECT name FROM manufacturer WHERE id = ?',
  executive: 'SELECT name FROM executive WHERE id = ?',
};

/** The name of a party, or undefined when it cannot be found. */
export function partyName(db: Database, type: string, id: number): string | undefined {
  if (type === 'utility') return supplierById(id)?.name;
  if (type === 'journalist') return journalistById(id)?.name;
  const sql = NAME_SQL[type as Exclude<ContactType, 'utility' | 'journalist'>];
  return sql ? (all(db, sql, [id])[0]?.name as string | undefined) : undefined;
}

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
    const name = partyName(db, type, id);
    if (!name) continue;
    const score = r.score as number;
    out.push({ type, id, name, score, kind: relationshipKind(score) });
  }
  return out;
}

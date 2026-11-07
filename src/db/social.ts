// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { JOURNALISTS } from '../sim/press';
import { createRng } from '../sim/rng';
import {
  CONVERSATIONS,
  MANNERS,
  converseOutcome,
  occasionAfter,
  startingScore,
  type Manner,
  type OccasionId,
} from '../sim/social';
import { readCareer } from './career';
import { contactsBook, partyName, type Contact, type ContactType } from './contacts';
import { all } from './entries';
import { adjustRelationship } from './negotiation';

export interface ConversationLine {
  id: number;
  occasion: string;
  party: { type: string; id: number; name: string };
  manner: Manner;
  delta: number;
  trouble: boolean;
  /** The party was met for the first time in this conversation. */
  met: boolean;
  /** Someone else was introduced as well. */
  introduced: boolean;
  date: string;
}

export interface SocialView {
  /** The occasion open now, or null when none is. */
  occasion: OccasionId | null;
  left: number;
  total: number;
  /** The people the player could talk to: their contacts book. */
  contacts: Contact[];
  /** How many people the garage has not met yet. */
  strangers: number;
  history: ConversationLine[];
}

interface SeasonNow {
  id: number;
  status: string;
  complete: number;
}

function seasonNow(db: Database): SeasonNow | undefined {
  const s = all(db, 'SELECT id, status FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!s) return undefined;
  const complete = Number(
    all(db, "SELECT COUNT(*) AS n FROM round WHERE season_id = ? AND status = 'complete'", [
      s.id as number,
    ])[0]!.n,
  );
  return { id: s.id as number, status: s.status as string, complete };
}

/** Who the garage has not met: sponsors that would have it, manufacturers and journalists. */
function strangersOf(db: Database, garageId: number): { type: ContactType; id: number }[] {
  const prestige = Number(
    all(db, 'SELECT prestige FROM garage WHERE id = ?', [garageId])[0]?.prestige ?? 0,
  );
  const met = new Set(
    all(
      db,
      "SELECT party_b_type AS t, party_b_id AS i FROM relationship WHERE party_a_type = 'garage' AND party_a_id = ?",
      [garageId],
    ).map((r) => `${r.t as string}:${r.i as number}`),
  );
  const out: { type: ContactType; id: number }[] = [];
  for (const r of all(db, 'SELECT id FROM sponsor WHERE min_prestige <= ? ORDER BY id', [prestige]))
    out.push({ type: 'sponsor', id: r.id as number });
  for (const r of all(db, 'SELECT id FROM manufacturer ORDER BY id'))
    out.push({ type: 'manufacturer', id: r.id as number });
  for (const j of JOURNALISTS) out.push({ type: 'journalist', id: j.id });
  return out.filter((p) => !met.has(`${p.type}:${p.id}`));
}

const countFor = (db: Database, garageId: number, seasonId: number, occasion: string): number =>
  Number(
    all(
      db,
      'SELECT COUNT(*) AS n FROM conversation WHERE garage_id = ? AND season_id = ? AND occasion = ?',
      [garageId, seasonId, occasion],
    )[0]!.n,
  );

/** The social occasion open now, what is left to spend at it, and what has happened so far. */
export function socialView(db: Database, garageId: number): SocialView {
  const season = seasonNow(db);
  const occasion = season ? occasionAfter(season.complete) : null;
  const used = season && occasion ? countFor(db, garageId, season.id, occasion) : 0;
  return {
    occasion,
    left: occasion ? Math.max(0, CONVERSATIONS - used) : 0,
    total: CONVERSATIONS,
    contacts: contactsBook(db, garageId),
    strangers: strangersOf(db, garageId).length,
    history: all(db, 'SELECT * FROM conversation WHERE garage_id = ? ORDER BY id DESC LIMIT 12', [
      garageId,
    ]).map((r) => ({
      id: r.id as number,
      occasion: r.occasion as string,
      party: {
        type: r.party_type as string,
        id: r.party_id as number,
        name: partyName(db, r.party_type as string, r.party_id as number) ?? '',
      },
      manner: r.manner as Manner,
      delta: r.delta as number,
      trouble: r.trouble === 1,
      met: r.met === 1,
      introduced: r.introduced === 1,
      date: r.date as string,
    })),
  };
}

/**
 * Spends one conversation at the open occasion. The target is someone in the contacts book, or null to
 * meet someone new. The way it goes comes from the career's seed, the occasion and how many
 * conversations came before.
 */
export function converse(
  db: Database,
  garageId: number,
  target: { type: ContactType; id: number } | null,
  manner: Manner,
): ConversationLine {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  if (!MANNERS.includes(manner)) throw new Error(`There is no manner "${manner}".`);
  const season = seasonNow(db);
  const occasion = season ? occasionAfter(season.complete) : null;
  if (!season || !occasion) throw new Error('There is no social occasion open now.');
  const used = countFor(db, garageId, season.id, occasion);
  if (used >= CONVERSATIONS) throw new Error('There are no conversations left at this occasion.');
  const stream = createRng(career.masterSeed).stream(`social:${season.id}:${occasion}:${used}`);
  const strangers = strangersOf(db, garageId);
  let party: { type: ContactType; id: number };
  let met = false;
  if (target === null) {
    if (strangers.length === 0) throw new Error('There is no one left to meet.');
    party = stream.pick(strangers);
    met = true;
  } else {
    if (!partyName(db, target.type, target.id)) throw new Error('There is no such contact.');
    if (!contactsBook(db, garageId).some((c) => c.type === target.type && c.id === target.id))
      throw new Error('That is not someone the garage has dealt with.');
    party = target;
  }
  const outcome = converseOutcome(stream, manner);
  const me = { type: 'garage', id: garageId };
  adjustRelationship(db, me, party, met ? startingScore(outcome.delta) : outcome.delta);
  let introduced = false;
  if (outcome.introduces) {
    const others = strangers.filter((p) => !(p.type === party.type && p.id === party.id));
    if (others.length > 0) {
      adjustRelationship(db, me, stream.pick(others), startingScore(0));
      introduced = true;
    }
  }
  db.run(
    `INSERT INTO conversation (garage_id, season_id, occasion, party_type, party_id, manner, delta, trouble, introduced, met, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      garageId,
      season.id,
      occasion,
      party.type,
      party.id,
      manner,
      outcome.delta,
      outcome.trouble ? 1 : 0,
      introduced ? 1 : 0,
      met ? 1 : 0,
      career.gameDate,
    ],
  );
  return socialView(db, garageId).history[0]!;
}

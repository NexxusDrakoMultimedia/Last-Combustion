// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { createRng } from '../sim/rng';
import {
  JOURNALISTS,
  fansFor,
  journalistById,
  pickJournalist,
  resultKind,
  toneOf,
  type Journalist,
  type ResultKind,
  type Tone,
} from '../sim/press';
import { readCareer } from './career';
import { all } from './entries';
import { adjustRelationship, relationshipScore } from './negotiation';

export interface HeadlineLine {
  id: number;
  journalist: Journalist;
  kind: ResultKind;
  tone: Tone;
  driver: string;
  position: number;
  fans: number;
  round: number;
  year: number;
}

export interface JournalistLine extends Journalist {
  /** -100 to +100. */
  score: number;
  tone: Tone;
}

export interface PressView {
  journalists: JournalistLine[];
  headlines: HeadlineLine[];
}

/**
 * After a final, a journalist writes about the player's garage: chosen by how the garage did (a taste
 * for results, technique or gossip makes a journalist likelier to cover some results), and written in
 * the tone the journalist's view of the garage gives. A warm headline wins fans and a cold one loses
 * them. Does nothing if the player's garage did not race.
 */
export function writeHeadline(db: Database, roundId: number): HeadlineLine | undefined {
  const career = readCareer(db);
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  if (!career || !player) return undefined;
  const garageId = player.id as number;
  const best = all(
    db,
    `SELECT r.final_pos, r.points, d.name FROM result r
       JOIN entry e ON e.id = r.entry_id JOIN driver d ON d.id = e.driver_id
      WHERE r.round_id = ? AND e.garage_id = ? AND r.final_pos IS NOT NULL
      ORDER BY r.final_pos LIMIT 1`,
    [roundId, garageId],
  )[0];
  const kind = resultKind(best ? (best.final_pos as number) : null, best ? Number(best.points) : 0);
  if (!best || !kind) return undefined;
  const stream = createRng(career.masterSeed).stream(`press:${roundId}`);
  const journalist = pickJournalist(stream, kind);
  const me = { type: 'garage', id: garageId };
  const them = { type: 'journalist', id: journalist.id };
  const tone = toneOf(relationshipScore(db, me, them));
  const fans = fansFor(tone);
  db.run(
    `INSERT INTO headline (garage_id, round_id, journalist_id, kind, tone, driver, position, fans, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (garage_id, round_id) DO NOTHING`,
    [
      garageId,
      roundId,
      journalist.id,
      kind,
      tone,
      best.name as string,
      best.final_pos as number,
      fans,
      career.gameDate,
    ],
  );
  if (fans !== 0)
    db.run('UPDATE garage SET fans = MAX(0, fans + ?) WHERE id = ?', [fans, garageId]);
  // Being written about, kindly or not, makes a journalist's acquaintance.
  if (relationshipScore(db, me, them) === 0) adjustRelationship(db, me, them, 1);
  return pressView(db, garageId).headlines[0];
}

/** The journalists, how each sees the garage, and the latest headlines about it. */
export function pressView(db: Database, garageId: number): PressView {
  return {
    journalists: JOURNALISTS.map((j) => {
      const score = relationshipScore(
        db,
        { type: 'garage', id: garageId },
        { type: 'journalist', id: j.id },
      );
      return { ...j, score, tone: toneOf(score) };
    }),
    headlines: all(
      db,
      `SELECT h.*, ro.number AS round_number, s.year FROM headline h
         JOIN round ro ON ro.id = h.round_id JOIN season s ON s.id = ro.season_id
        WHERE h.garage_id = ? ORDER BY h.id DESC LIMIT 12`,
      [garageId],
    ).flatMap((h) => {
      const journalist = journalistById(h.journalist_id as number);
      return journalist
        ? [
            {
              id: h.id as number,
              journalist,
              kind: h.kind as ResultKind,
              tone: h.tone as Tone,
              driver: h.driver as string,
              position: h.position as number,
              fans: h.fans as number,
              round: h.round_number as number,
              year: h.year as number,
            },
          ]
        : [];
    }),
  };
}

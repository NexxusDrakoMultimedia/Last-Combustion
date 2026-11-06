// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { AWARDS, pickWinner, type Candidate } from '../sim/awards';
import type { Standing } from '../sim/standings';
import { finalBalance } from '../sim/worldgen/data';
import { all } from './entries';
import type { StandingsTables } from './season';

export interface AwardWon {
  award: string;
  subjectType: 'driver' | 'garage';
  subjectId: number;
  name: string;
  value: number;
}

/** The candidates for each award this season, from the results (the main series only). */
function candidatesFor(
  db: Database,
  seasonId: number,
  year: number,
  tables: StandingsTables,
): Record<string, Candidate[]> {
  const points = new Map<number, number>(
    tables.drivers.map((d) => [d.id as number, d.points] as const),
  );
  const garagePoints = new Map<number, number>(
    tables.garages.map((g) => [g.id as number, g.points] as const),
  );
  const driver = (rows: { id: number; value: number }[]): Candidate[] =>
    rows.map((r) => ({ id: r.id, value: r.value, points: points.get(r.id) ?? 0 }));
  const rows = (sql: string, params: (number | string)[] = [seasonId]) =>
    all(db, sql, params).map((r) => ({ id: r.id as number, value: Number(r.value) }));

  const out: Record<string, Candidate[]> = {};
  out.fan_favourite = driver(
    rows('SELECT driver_id AS id, gained AS value FROM driver_season_fans WHERE season_id = ?'),
  );
  // A rookie is in their first season; in the career's first year everyone is new, so nobody is a rookie.
  const startYear = Number(
    all(db, 'SELECT start_year AS n FROM career WHERE id = 1')[0]?.n ?? year,
  );
  out.rookie_of_the_year =
    year > startYear
      ? driver(
          rows(
            `SELECT e.driver_id AS id, COALESCE(SUM(r.points), 0) AS value
               FROM entry e LEFT JOIN result r ON r.entry_id = e.id
              WHERE e.season_id = ? AND e.series = 'main'
                AND NOT EXISTS (SELECT 1 FROM entry o JOIN season os ON os.id = o.season_id
                                 WHERE o.driver_id = e.driver_id AND os.year < ?)
              GROUP BY e.driver_id`,
            [seasonId, year],
          ),
        )
      : [];
  out.hard_charger = driver(
    rows(
      `SELECT e.driver_id AS id, SUM(r.prelim_pos - r.final_pos) AS value
         FROM result r JOIN entry e ON e.id = r.entry_id JOIN round ro ON ro.id = r.round_id
        WHERE ro.season_id = ? AND e.series = 'main' AND r.final_pos IS NOT NULL
          AND r.prelim_pos IS NOT NULL AND r.dnf_reason IS NULL
        GROUP BY e.driver_id`,
    ),
  );
  out.pole_sitter = driver(
    rows(
      `SELECT e.driver_id AS id, COUNT(*) AS value
         FROM result r JOIN entry e ON e.id = r.entry_id JOIN round ro ON ro.id = r.round_id
        WHERE ro.season_id = ? AND e.series = 'main' AND r.pole = 1 GROUP BY e.driver_id`,
    ),
  );
  out.overtaker = driver(
    rows(
      `SELECT e.driver_id AS id, SUM(sb.amount) / ${finalBalance.overtakeBonus} AS value
         FROM season_bonus sb JOIN entry e ON e.id = sb.entry_id
        WHERE sb.season_id = ? AND sb.kind = 'overtake' GROUP BY e.driver_id`,
    ),
  );

  // Improvement is the places climbed in the final table since last season, for those in both.
  const improvement = (kind: 'driver' | 'garage', current: Standing[]) => {
    const before = new Map(
      all(
        db,
        `SELECT subject, position FROM standing_snapshot
          WHERE table_kind = ? AND season_id = (SELECT id FROM season WHERE year = ?)`,
        [kind, year - 1],
      ).map((r) => [String(r.subject), r.position as number]),
    );
    return current
      .filter((c) => before.has(String(c.id)) && c.points > 0)
      .map((c) => ({
        id: Number(c.id),
        value: before.get(String(c.id))! - c.rank,
        points: c.points,
      }));
  };
  out.most_improved = improvement('driver', tables.drivers);
  out.most_improved_garage = improvement('garage', tables.garages).map((c) => ({
    ...c,
    points: garagePoints.get(c.id) ?? c.points,
  }));
  return out;
}

/**
 * Gives out the season's awards (see `data/awards.json`) and records them. Called when a season
 * ends, inside its transaction, with the final tables.
 */
export function awardSeason(
  db: Database,
  seasonId: number,
  year: number,
  tables: StandingsTables,
): AwardWon[] {
  const candidates = candidatesFor(db, seasonId, year, tables);
  const won: AwardWon[] = [];
  for (const award of AWARDS) {
    const winner = pickWinner(candidates[award.id] ?? [], award.min);
    if (!winner) continue;
    db.run(
      'INSERT INTO season_award (season_id, award, subject_type, subject_id, value) VALUES (?, ?, ?, ?, ?)',
      [seasonId, award.id, award.subject, winner.id, winner.value],
    );
    const name = String(
      all(db, `SELECT name FROM ${award.subject} WHERE id = ?`, [winner.id])[0]?.name ?? '',
    );
    won.push({
      award: award.id,
      subjectType: award.subject,
      subjectId: winner.id,
      name,
      value: Math.round(winner.value * 10) / 10,
    });
  }
  return won;
}

/** The awards given out for a season (empty before it ends). */
export function seasonAwards(db: Database, year: number): AwardWon[] {
  const order = new Map(AWARDS.map((a, i) => [a.id, i]));
  return all(
    db,
    `SELECT a.award, a.subject_type, a.subject_id, a.value,
            CASE a.subject_type WHEN 'driver' THEN d.name ELSE g.name END AS name
       FROM season_award a JOIN season s ON s.id = a.season_id
       LEFT JOIN driver d ON a.subject_type = 'driver' AND d.id = a.subject_id
       LEFT JOIN garage g ON a.subject_type = 'garage' AND g.id = a.subject_id
      WHERE s.year = ?`,
    [year],
  )
    .map((r) => ({
      award: r.award as string,
      subjectType: r.subject_type as 'driver' | 'garage',
      subjectId: r.subject_id as number,
      name: String(r.name ?? ''),
      value: Math.round((r.value as number) * 10) / 10,
    }))
    .sort((a, b) => (order.get(a.award) ?? 99) - (order.get(b.award) ?? 99));
}

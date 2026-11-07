// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { seasonBalance } from './worldgen/data';

/** One entry's result in one round, with the groups it scores for. */
export interface RoundResult {
  round: number;
  driverId: number;
  garageId: number;
  manufacturerId: number;
  driverFlag: string;
  garageFlag: string;
  /** Overall finishing position that round (1-15 from the final, 16 and up from the prelims), or null. */
  position: number | null;
  points: number;
  /** The prelim time in milliseconds. */
  prelimTimeMs: number | null;
  /** Where the entry finished in that round's prelims (1 is the fastest), or null if it set no time. */
  prelimPos: number | null;
}

/**
 * What separates entries that are level on points and on every finishing position, in order:
 * prestige, then valuation (both higher is better), then a random draw that is fixed for the entry
 * (a higher draw wins). The database layer supplies them, and each is only asked for when the
 * earlier ones leave a tie.
 */
export interface TieBreaks {
  prestige(id: number | string): number;
  valuation(id: number | string): number;
  draw(id: number | string): number;
}

/** No tie-breakers beyond the results themselves: ties fall back to the entry's id. */
export const NO_TIEBREAKS: TieBreaks = { prestige: () => 0, valuation: () => 0, draw: () => 0 };

export interface Standing {
  id: number | string;
  points: number;
  wins: number;
  /** The rank, from 1; tied entries get different ranks because the tiebreak always separates them. */
  rank: number;
}

/** The countback goes from 1st to 15th place: the places of the final, which seats 15 cars. */
const MAX_POSITIONS = 15;

/** How often each finishing place in the final was taken, 1st to 15th. */
function countPositions(rows: readonly RoundResult[]): number[] {
  const counts = new Array<number>(MAX_POSITIONS).fill(0);
  for (const r of rows) {
    if (r.position !== null && r.position >= 1 && r.position <= MAX_POSITIONS) {
      counts[r.position - 1]! += 1;
    }
  }
  return counts;
}

/** The mean prelim finishing position of some results (lower is better), or Infinity with none. */
function averagePrelim(rows: readonly RoundResult[]): number {
  const places = rows.map((r) => r.prelimPos).filter((p): p is number => p !== null);
  return places.length === 0
    ? Number.POSITIVE_INFINITY
    : places.reduce((sum, p) => sum + p, 0) / places.length;
}

interface Entrant {
  id: number | string;
  points: number;
  positions: number[];
  prelim: number;
}

/**
 * Orders entrants by points. Ties go to the entrant with most wins, then most 2nds, and so on
 * through to most 15th places (the countback), then the better average prelim finishing position,
 * then the higher prestige, then the higher valuation, then a random draw.
 */
function ranked(entrants: Entrant[], ties: TieBreaks): Standing[] {
  const prestige = new Map<number | string, number>();
  const valuation = new Map<number | string, number>();
  const lazy =
    (cache: Map<number | string, number>, read: (id: number | string) => number) =>
    (id: number | string): number => {
      if (!cache.has(id)) cache.set(id, read(id));
      return cache.get(id)!;
    };
  const prestigeOf = lazy(prestige, (id) => ties.prestige(id));
  const valuationOf = lazy(valuation, (id) => ties.valuation(id));
  entrants.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (let i = 0; i < MAX_POSITIONS; i++) {
      if (b.positions[i] !== a.positions[i]) return b.positions[i]! - a.positions[i]!;
    }
    if (a.prelim !== b.prelim) return a.prelim - b.prelim;
    if (prestigeOf(a.id) !== prestigeOf(b.id)) return prestigeOf(b.id) - prestigeOf(a.id);
    if (valuationOf(a.id) !== valuationOf(b.id)) return valuationOf(b.id) - valuationOf(a.id);
    const draws = ties.draw(b.id) - ties.draw(a.id);
    if (draws !== 0) return draws;
    return String(a.id).localeCompare(String(b.id), 'en', { numeric: true });
  });
  return entrants.map((e, i) => ({
    id: e.id,
    points: e.points,
    wins: e.positions[0]!,
    rank: i + 1,
  }));
}

/** The Driver Championship: each driver's own points, with the tie-breakers in `ranked`. */
export function driverStandings(
  rows: readonly RoundResult[],
  ties: TieBreaks = NO_TIEBREAKS,
): Standing[] {
  const byDriver = new Map<number, RoundResult[]>();
  for (const r of rows) byDriver.set(r.driverId, [...(byDriver.get(r.driverId) ?? []), r]);
  return ranked(
    [...byDriver.entries()].map(([id, list]) => ({
      id,
      points: Math.round(list.reduce((s, r) => s + r.points, 0) * 10) / 10,
      positions: countPositions(list),
      prelim: averagePrelim(list),
    })),
    ties,
  );
}

/**
 * Sums, for each group and round, the best N results (two by default) and adds the rounds up.
 * Used for the garage, manufacturer and nation tables.
 */
function bestPerRound(
  rows: readonly RoundResult[],
  keyOf: (r: RoundResult) => number | string,
  best: number = seasonBalance.bestResultsPerRound,
): Entrant[] {
  const byRound = new Map<string, number[]>();
  const groupRows = new Map<number | string, RoundResult[]>();
  for (const r of rows) {
    const key = keyOf(r);
    const k = `${r.round}|${String(key)}`;
    byRound.set(k, [...(byRound.get(k) ?? []), r.points]);
    groupRows.set(key, [...(groupRows.get(key) ?? []), r]);
  }
  const out: Entrant[] = [];
  for (const [key, list] of groupRows) {
    const rounds = new Set(list.map((r) => r.round));
    let points = 0;
    for (const round of rounds) {
      const scores = (byRound.get(`${round}|${String(key)}`) ?? []).sort((a, b) => b - a);
      points += scores.slice(0, best).reduce((s, v) => s + v, 0);
    }
    out.push({
      id: key,
      points: Math.round(points * 10) / 10,
      positions: countPositions(list),
      prelim: averagePrelim(list),
    });
  }
  return out;
}

/** The Garage Championship: each garage's best two results in each round. */
export const garageStandings = (
  rows: readonly RoundResult[],
  ties: TieBreaks = NO_TIEBREAKS,
): Standing[] =>
  ranked(
    bestPerRound(rows, (r) => r.garageId),
    ties,
  );

/** The Manufacturer Championship: the best two results among a make's cars in each round. */
export const manufacturerStandings = (
  rows: readonly RoundResult[],
  ties: TieBreaks = NO_TIEBREAKS,
): Standing[] =>
  ranked(
    bestPerRound(rows, (r) => r.manufacturerId),
    ties,
  );

/** Driver nations: the best two driver results in each round among drivers under a flag. */
export const driverNationStandings = (
  rows: readonly RoundResult[],
  ties: TieBreaks = NO_TIEBREAKS,
): Standing[] =>
  ranked(
    bestPerRound(rows, (r) => r.driverFlag),
    ties,
  );

/**
 * Garage nations: each garage scores its best two results in a round, and a flag scores the best
 * two garages' round scores among garages racing under it. The countback and the average prelim
 * position are those of every result of the garages under the flag.
 */
export function garageNationStandings(
  rows: readonly RoundResult[],
  ties: TieBreaks = NO_TIEBREAKS,
): Standing[] {
  const best = seasonBalance.bestResultsPerRound;
  const byGarageRound = new Map<string, { flag: string; scores: number[] }>();
  for (const r of rows) {
    const k = `${r.round}|${r.garageId}`;
    const cur = byGarageRound.get(k) ?? { flag: r.garageFlag, scores: [] };
    cur.scores.push(r.points);
    byGarageRound.set(k, cur);
  }
  // Each garage's score in each round, filed under its flag as if it were one result.
  const synthetic: RoundResult[] = [...byGarageRound.entries()].map(([k, v]) => ({
    round: Number(k.split('|')[0]),
    driverId: 0,
    garageId: 0,
    manufacturerId: 0,
    driverFlag: v.flag,
    garageFlag: v.flag,
    position: null,
    points: v.scores
      .sort((a, b) => b - a)
      .slice(0, best)
      .reduce((s, x) => s + x, 0),
    prelimTimeMs: null,
    prelimPos: null,
  }));
  const scored = bestPerRound(synthetic, (r) => r.garageFlag);
  const detail = new Map<string, RoundResult[]>();
  for (const r of rows) detail.set(r.garageFlag, [...(detail.get(r.garageFlag) ?? []), r]);
  return ranked(
    scored.map((e) => ({
      ...e,
      positions: countPositions(detail.get(String(e.id)) ?? []),
      prelim: averagePrelim(detail.get(String(e.id)) ?? []),
    })),
    ties,
  );
}

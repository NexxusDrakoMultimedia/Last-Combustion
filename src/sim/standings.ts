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
  /** The prelim time in milliseconds, used to break a tie at the last round. */
  prelimTimeMs: number | null;
}

export interface Standing {
  id: number | string;
  points: number;
  wins: number;
  /** The rank, from 1; tied entries get different ranks because the tiebreak always separates them. */
  rank: number;
}

const MAX_POSITIONS = 31;

/** How often each finishing position was taken, 1st to 31st. */
function countPositions(rows: readonly RoundResult[]): number[] {
  const counts = new Array<number>(MAX_POSITIONS).fill(0);
  for (const r of rows) {
    if (r.position !== null && r.position >= 1 && r.position <= MAX_POSITIONS) {
      counts[r.position - 1]! += 1;
    }
  }
  return counts;
}

/**
 * The Driver Championship: each driver's own points. Ties go to the driver with most wins, then
 * most 2nds, and so on down the positions, then the best prelim time at the final round.
 */
export function driverStandings(rows: readonly RoundResult[]): Standing[] {
  const byDriver = new Map<number, RoundResult[]>();
  for (const r of rows) byDriver.set(r.driverId, [...(byDriver.get(r.driverId) ?? []), r]);
  const lastRound = Math.max(0, ...rows.map((r) => r.round));
  const entries = [...byDriver.entries()].map(([id, list]) => ({
    id,
    points: Math.round(list.reduce((s, r) => s + r.points, 0) * 10) / 10,
    positions: countPositions(list),
    lastTime: list.find((r) => r.round === lastRound)?.prelimTimeMs ?? Number.POSITIVE_INFINITY,
  }));
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (let i = 0; i < MAX_POSITIONS; i++) {
      if (b.positions[i] !== a.positions[i]) return b.positions[i]! - a.positions[i]!;
    }
    if (a.lastTime !== b.lastTime) return a.lastTime - b.lastTime;
    return a.id - b.id;
  });
  return entries.map((e, i) => ({
    id: e.id,
    points: e.points,
    wins: e.positions[0]!,
    rank: i + 1,
  }));
}

/**
 * Sums, for each group and round, the best N results (two by default) and adds the rounds up.
 * Used for the garage, manufacturer and nation tables.
 */
function bestPerRound(
  rows: readonly RoundResult[],
  keyOf: (r: RoundResult) => number | string,
  best: number = seasonBalance.bestResultsPerRound,
): Map<number | string, { points: number; positions: number[] }> {
  const byRound = new Map<string, number[]>();
  const groupRows = new Map<number | string, RoundResult[]>();
  for (const r of rows) {
    const key = keyOf(r);
    const k = `${r.round}|${String(key)}`;
    byRound.set(k, [...(byRound.get(k) ?? []), r.points]);
    groupRows.set(key, [...(groupRows.get(key) ?? []), r]);
  }
  const out = new Map<number | string, { points: number; positions: number[] }>();
  for (const [key, list] of groupRows) {
    const rounds = new Set(list.map((r) => r.round));
    let points = 0;
    for (const round of rounds) {
      const scores = (byRound.get(`${round}|${String(key)}`) ?? []).sort((a, b) => b - a);
      points += scores.slice(0, best).reduce((s, v) => s + v, 0);
    }
    out.set(key, { points: Math.round(points * 10) / 10, positions: countPositions(list) });
  }
  return out;
}

function rank(groups: Map<number | string, { points: number; positions: number[] }>): Standing[] {
  const list = [...groups.entries()].map(([id, g]) => ({ id, ...g }));
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (let i = 0; i < MAX_POSITIONS; i++) {
      if (b.positions[i] !== a.positions[i]) return b.positions[i]! - a.positions[i]!;
    }
    return String(a.id).localeCompare(String(b.id), 'en', { numeric: true });
  });
  return list.map((e, i) => ({ id: e.id, points: e.points, wins: e.positions[0]!, rank: i + 1 }));
}

/** The Garage Championship: each garage's best two results in each round. */
export const garageStandings = (rows: readonly RoundResult[]): Standing[] =>
  rank(bestPerRound(rows, (r) => r.garageId));

/** The Manufacturer Championship: the best two results among a make's cars in each round. */
export const manufacturerStandings = (rows: readonly RoundResult[]): Standing[] =>
  rank(bestPerRound(rows, (r) => r.manufacturerId));

/** Driver nations: the best two driver results in each round among drivers under a flag. */
export const driverNationStandings = (rows: readonly RoundResult[]): Standing[] =>
  rank(bestPerRound(rows, (r) => r.driverFlag));

/**
 * Garage nations: each garage scores its best two results in a round, and a flag scores the best
 * two garages' round scores among garages racing under it.
 */
export function garageNationStandings(rows: readonly RoundResult[]): Standing[] {
  const perGarage = new Map<string, { flag: string; points: number }>();
  const best = seasonBalance.bestResultsPerRound;
  const byGarageRound = new Map<string, { flag: string; scores: number[] }>();
  for (const r of rows) {
    const k = `${r.round}|${r.garageId}`;
    const cur = byGarageRound.get(k) ?? { flag: r.garageFlag, scores: [] };
    cur.scores.push(r.points);
    byGarageRound.set(k, cur);
  }
  for (const [k, v] of byGarageRound) {
    const round = k.split('|')[0]!;
    const score = v.scores
      .sort((a, b) => b - a)
      .slice(0, best)
      .reduce((s, x) => s + x, 0);
    perGarage.set(`${round}|${v.flag}|${k}`, { flag: v.flag, points: score });
  }
  const synthetic: RoundResult[] = [...perGarage.entries()].map(([k, v]) => ({
    round: Number(k.split('|')[0]),
    driverId: 0,
    garageId: 0,
    manufacturerId: 0,
    driverFlag: v.flag,
    garageFlag: v.flag,
    position: null,
    points: v.points,
    prelimTimeMs: null,
  }));
  return rank(bestPerRound(synthetic, (r) => r.garageFlag));
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import awardsJson from '../../data/awards.json';

export interface AwardData {
  id: string;
  subject: 'driver' | 'garage';
  min: number;
}

export const AWARDS = awardsJson.awards as AwardData[];

export interface Candidate {
  id: number;
  /** What the award measures: fans gained, places gained, poles and so on. */
  value: number;
  /** The candidate's points in the season, which break a tie. */
  points: number;
}

/**
 * The winner among some candidates: the highest value (at least `min`), a tie going to more points
 * and then to the lower id, so the same season always gives the same winner.
 */
export function pickWinner(candidates: readonly Candidate[], min: number): Candidate | undefined {
  let best: Candidate | undefined;
  for (const c of candidates) {
    if (!(c.value >= min)) continue;
    if (
      !best ||
      c.value > best.value ||
      (c.value === best.value &&
        (c.points > best.points || (c.points === best.points && c.id < best.id)))
    )
      best = c;
  }
  return best;
}

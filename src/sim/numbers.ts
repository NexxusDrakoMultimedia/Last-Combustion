// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { RESERVED_NUMBER } from './worldgen';

/** The numbers 1 to 40 are given by last season's ranking. */
export const RANKED_NUMBERS = 40;

export interface RankedDriver {
  driverId: number;
  /** Whether the driver is racing in the Super Series this season (not retired, not in the Junior Series). */
  racing: boolean;
}

/**
 * Race numbers 1 to 40 for a new season, from last season's classification (best first). The
 * driver who finished first must take #1, second #2, and so on: a ranked driver cannot turn the
 * number down. A ranked driver who is not racing this season leaves their number free, and it
 * goes to the best-ranked racing driver after 40 who has no number yet. #313 is never given.
 * Everyone else applies for a number from 41 up.
 */
export function rankingNumbers(classification: readonly RankedDriver[]): Map<number, number> {
  const numbers = new Map<number, number>();
  const racing = classification.filter((d) => d.racing);
  const taken = new Set<number>();
  const vacant: number[] = [];
  for (let rank = 1; rank <= RANKED_NUMBERS; rank++) {
    const driver = classification[rank - 1];
    if (driver?.racing && rank !== RESERVED_NUMBER) {
      numbers.set(driver.driverId, rank);
      taken.add(driver.driverId);
    } else if (rank !== RESERVED_NUMBER) {
      vacant.push(rank);
    }
  }
  for (const number of vacant) {
    const next = racing.find((d) => !taken.has(d.driverId));
    if (!next) break;
    numbers.set(next.driverId, number);
    taken.add(next.driverId);
  }
  return numbers;
}

/** Whether a number is in the ranked block that a driver cannot decline. */
export const isRankedNumber = (n: number): boolean => n >= 1 && n <= RANKED_NUMBERS;

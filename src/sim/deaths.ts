// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { seasonBalance } from './worldgen/data';

/** The non-racing ways a person can die. Their text is in `locales/en.json` (`death.cause.<key>`). */
export type DeathCause = (typeof seasonBalance.deaths.causes)[number];

export interface DeathRoll {
  cause: DeathCause;
  /** The month (1 to 12) and day (1 to 28) of the year it happened on. */
  month: number;
  day: number;
}

/**
 * Whether a person dies in a year in something that has nothing to do with racing (a road accident,
 * an illness, a fall, a fire, an accident in the water), and if so how and when. Old age is a
 * separate matter. Racing never kills anyone: the drones and rescue crews see to that. One draw
 * decides, and the cause and the day only draw when it does, so they never shift anyone else's roll.
 */
export function rollDeath(rng: RandomStream): DeathRoll | null {
  if (!rng.chance(seasonBalance.deaths.chancePerYear)) return null;
  return {
    cause: rng.pick(seasonBalance.deaths.causes),
    month: rng.int(1, 12),
    day: rng.int(1, 28),
  };
}

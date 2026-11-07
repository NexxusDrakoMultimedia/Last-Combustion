// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { seasonBalance } from './worldgen/data';

/**
 * What a driver puts into a garage's shares after a season: a share of what they have won, once they
 * have won enough to matter, in whole dollars. Nothing below the minimum.
 */
export function driverInvestment(earnings: number): number {
  const cfg = seasonBalance.driverInvesting;
  return earnings >= cfg.minEarnings ? Math.floor(earnings * cfg.share) : 0;
}

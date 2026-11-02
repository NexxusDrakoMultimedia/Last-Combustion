// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { gearItems, type GearSlot, type GearTier } from '../gear';
import type { RandomStream } from '../rng';

export interface Loadout {
  driverId: number;
  itemId: string;
}

const SLOTS: GearSlot[] = ['helmet', 'suit', 'gloves', 'boots'];

/** How likely each tier of gear is for a driver at a garage of the given prestige. */
function tierWeights(prestige: number): [GearTier, number][] {
  return [
    ['basic', Math.max(0.1, 1 - prestige / 25)],
    ['club', Math.min(1, prestige / 12)],
    ['pro', Math.max(0, (prestige - 18) / 35)],
    ['elite', Math.max(0, (prestige - 40) / 80)],
  ];
}

/**
 * Starting gear for the AI drivers: better-funded garages kit their drivers out in better gear.
 * Earned and one-off items (such as the Border Coin and the Founder's Coin) are never handed out.
 */
export function generateLoadouts(
  drivers: readonly { id: number }[],
  prestigeOf: (driverId: number) => number,
  rng: RandomStream,
): Loadout[] {
  const loadouts: Loadout[] = [];
  const sold = gearItems.filter((item) => item.price > 0);
  for (const driver of drivers) {
    const weights = tierWeights(prestigeOf(driver.id));
    for (const slot of SLOTS) {
      const tier = rng.weighted(
        weights.map(([t]) => t),
        weights.map(([, w]) => w),
      );
      const options = sold.filter((item) => item.slot === slot && item.tier === tier);
      if (options.length > 0) loadouts.push({ driverId: driver.id, itemId: rng.pick(options).id });
    }
    if (rng.chance(0.2)) {
      const trinkets = sold.filter(
        (item) => item.slot === 'trinket' && (item.tier === 'club' || item.tier === 'pro'),
      );
      loadouts.push({ driverId: driver.id, itemId: rng.pick(trinkets).id });
    }
  }
  return loadouts;
}

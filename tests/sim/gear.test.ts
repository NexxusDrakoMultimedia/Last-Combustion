// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  SLOT_LIMITS,
  STAT_CAP,
  applyGear,
  gearBudgets,
  gearItem,
  gearItems,
  gearSuppliers,
  gearWornShare,
  loadoutBonuses,
  validateLoadout,
} from '../../src/sim/gear';
import { generateWorld } from '../../src/sim/worldgen';

const world = generateWorld('gear');
const driver = world.drivers[0]!;
const items = (...ids: string[]) => ids.map(gearItem);

describe('gear catalogue', () => {
  it('has unique ids, valid suppliers and sensible prices', () => {
    expect(new Set(gearItems.map((g) => g.id)).size).toBe(gearItems.length);
    const suppliers = new Set(gearSuppliers.map((s) => s.id));
    for (const item of gearItems) {
      if (item.supplierId) expect(suppliers.has(item.supplierId), item.id).toBe(true);
      expect(item.price).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps every item inside the boost budget of its tier', () => {
    for (const item of gearItems) {
      const total = Object.values(item.stats).reduce((a, b) => a + b, 0);
      const [min, max] = gearBudgets[item.tier];
      expect(total, item.name).toBeGreaterThanOrEqual(min);
      expect(total, item.name).toBeLessThanOrEqual(max);
    }
  });

  it('covers every slot, and only earned items are not for sale', () => {
    for (const slot of Object.keys(SLOT_LIMITS)) {
      expect(
        gearItems.some((g) => g.slot === slot && g.price > 0),
        slot,
      ).toBe(true);
    }
    expect(
      gearItems
        .filter((g) => g.price === 0)
        .map((g) => g.tier)
        .sort(),
    ).toEqual(['elite', 'legendary']);
  });

  it('costs more the higher the tier', () => {
    const mean = (tier: string) => {
      const list = gearItems.filter((g) => g.tier === tier && g.price > 0);
      return list.reduce((s, g) => s + g.price, 0) / list.length;
    };
    expect(mean('club')).toBeGreaterThan(mean('basic'));
    expect(mean('pro')).toBeGreaterThan(mean('club'));
    expect(mean('elite')).toBeGreaterThan(mean('pro'));
  });
});

describe('loadouts', () => {
  it('accept one item per slot and two trinkets', () => {
    expect(
      validateLoadout([
        'helmet-brumby-road',
        'suit-brumby-overalls',
        'trinket-worn-dice',
        'trinket-wattle-sprig',
      ]),
    ).toEqual([]);
  });

  it('reject too many items in a slot, repeats and unknown items', () => {
    expect(validateLoadout(['helmet-brumby-road', 'helmet-vanta-circuit'])).toHaveLength(1);
    expect(
      validateLoadout(['trinket-worn-dice', 'trinket-wattle-sprig', 'trinket-road-map']),
    ).toHaveLength(1);
    expect(validateLoadout(['suit-brumby-overalls', 'suit-brumby-overalls'])[0]).toMatch(/twice/);
    expect(validateLoadout(['nope'])[0]).toMatch(/Unknown/);
  });
});

describe('boosts', () => {
  it('add up item stats', () => {
    const bonus = loadoutBonuses(items('helmet-vanta-circuit', 'gloves-kinetic-grip'));
    expect(bonus).toMatchObject({ composure: 2, consistency: 1, racecraft: 2, tyreManagement: 1 });
  });

  it('give a set bonus for matching suppliers that grows with the number of pieces', () => {
    const two = loadoutBonuses(items('helmet-brumby-road', 'suit-brumby-overalls'));
    const four = loadoutBonuses(
      items(
        'helmet-brumby-road',
        'suit-brumby-overalls',
        'gloves-brumby-driving',
        'boots-brumby-driving',
      ),
    );
    expect(two.composure).toBe(1 + 1);
    expect(four.composure).toBe(1 + 3);
    expect(four.consistency).toBe(1 + 2);
  });

  it('never raise one attribute by more than the cap', () => {
    const bonus = loadoutBonuses(
      items(
        'helmet-nordlys-carbon',
        'boots-nordlys-titanium',
        'gloves-nordlys-precision',
        'trinket-founders-coin',
      ),
    );
    for (const value of Object.values(bonus)) expect(value).toBeLessThanOrEqual(STAT_CAP);
    expect(bonus.pace).toBeLessThanOrEqual(STAT_CAP);
  });

  it('change a copy of the driver and leave the record alone', () => {
    const before = JSON.stringify(driver);
    const boosted = applyGear(driver, items('helmet-kinetic-aero', 'trinket-road-map'));
    expect(JSON.stringify(driver)).toBe(before);
    expect(boosted.composure).toBe(Math.min(99, driver.composure + 3));
    expect(boosted.affinities.mountain).toBe(Math.min(99, driver.affinities.mountain + 3));
    expect(boosted.affinities.coast).toBe(driver.affinities.coast);
  });

  it('keep attributes inside 1 to 99', () => {
    const maxed = { ...driver, pace: 98, composure: 97 };
    const boosted = applyGear(maxed, items('helmet-nordlys-carbon', 'trinket-founders-coin'));
    expect(boosted.pace).toBe(99);
    expect(boosted.composure).toBe(99);
  });

  it('do nothing for a driver with no gear', () => {
    expect(applyGear(driver, [])).toEqual(driver);
  });
});

describe('starting gear', () => {
  const byDriver = new Map<number, string[]>();
  for (const l of world.loadouts)
    byDriver.set(l.driverId, [...(byDriver.get(l.driverId) ?? []), l.itemId]);

  it('is valid for every driver and never hands out earned items', () => {
    for (const d of world.drivers) {
      expect(validateLoadout(byDriver.get(d.id) ?? []), d.name).toEqual([]);
      for (const id of byDriver.get(d.id) ?? []) expect(gearItem(id).price).toBeGreaterThan(0);
    }
  });

  it('is better at richer garages', () => {
    const score = (id: number) =>
      (byDriver.get(id) ?? []).reduce(
        (s, itemId) =>
          s + { basic: 1, club: 2, pro: 3, elite: 4, legendary: 5 }[gearItem(itemId).tier],
        0,
      );
    const prestigeOf = (driverId: number) => {
      const entry = world.entries.find((e) => e.driverId === driverId)!;
      return world.garages[entry.garageId - 1]!.prestige;
    };
    const sorted = [...world.drivers].sort((a, b) => prestigeOf(b.id) - prestigeOf(a.id));
    const top = sorted.slice(0, 60).reduce((s, d) => s + score(d.id), 0);
    const bottom = sorted.slice(-60).reduce((s, d) => s + score(d.id), 0);
    expect(top).toBeGreaterThan(bottom);
  });
});

describe('gear wear', () => {
  it('keeps all of a new item’s boost and 40% of a worn-out one’s', () => {
    expect(gearWornShare(0)).toBe(1);
    expect(gearWornShare(100)).toBeCloseTo(0.4, 5);
    expect(gearWornShare(50)).toBeCloseTo(0.7, 5);
    expect(gearWornShare(500)).toBeCloseTo(0.4, 5);
  });

  it('shrinks a loadout’s boost as it wears, without ever going below zero or above the cap', () => {
    const kit = items('helmet-nordlys-carbon', 'suit-nordlys-thermal');
    const fresh = loadoutBonuses(kit);
    const worn = loadoutBonuses(kit, [100, 100]);
    for (const [stat, value] of Object.entries(fresh)) {
      expect(worn[stat as keyof typeof worn] ?? 0).toBeLessThanOrEqual(value);
      expect(worn[stat as keyof typeof worn] ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(Object.values(worn).reduce((a, b) => a + b, 0)).toBeLessThan(
      Object.values(fresh).reduce((a, b) => a + b, 0),
    );
  });

  it('stops counting a threadbare piece towards a supplier set', () => {
    const pair = items('helmet-nordlys-carbon', 'suit-nordlys-thermal');
    // Two pieces from one supplier give +1 composure; with one piece worn out the set bonus is lost.
    const whole = loadoutBonuses(pair, [0, 0]);
    const lone = loadoutBonuses(pair, [0, 90]);
    expect(whole.composure ?? 0).toBeGreaterThan(lone.composure ?? 0);
  });

  it('lowers a driver’s effective stats but never touches the record', () => {
    const kit = items('helmet-nordlys-carbon', 'suit-nordlys-thermal');
    const fresh = applyGear(driver, kit);
    const worn = applyGear(driver, kit, [100, 100]);
    expect(worn.pace + worn.consistency + worn.racecraft + worn.composure).toBeLessThanOrEqual(
      fresh.pace + fresh.consistency + fresh.racecraft + fresh.composure,
    );
    expect(driver).toEqual(world.drivers[0]);
  });
});

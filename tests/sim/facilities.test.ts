// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  FACILITY_KINDS,
  MAX_FACILITY_LEVEL,
  facilityBonuses,
  facilityDef,
  levelCost,
  runningCost,
} from '../../src/sim/facilities';
import { crewStrength } from '../../src/sim/staff';

describe('facilities', () => {
  it('have levels 1 to 5, each level dearer than the last, and a running cost that grows with the level', () => {
    expect(MAX_FACILITY_LEVEL).toBe(5);
    for (const kind of FACILITY_KINDS) {
      for (let level = 2; level <= MAX_FACILITY_LEVEL; level++) {
        expect(levelCost(kind, level), kind).toBeGreaterThan(levelCost(kind, level - 1));
        expect(runningCost(kind, level), kind).toBeGreaterThan(runningCost(kind, level - 1));
      }
      expect(runningCost(kind, 0)).toBe(0);
    }
  });

  it('only need facilities that exist, and the simulator needs the data room', () => {
    for (const kind of FACILITY_KINDS) {
      const needs = facilityDef(kind).needs;
      if (needs) expect(FACILITY_KINDS).toContain(needs);
    }
    expect(facilityDef('driver_simulator').needs).toBe('data_room');
  });

  it('add up to nothing for a garage with none, and grow with each level', () => {
    expect(facilityBonuses({}).crewCover).toBe(0);
    expect(facilityBonuses({ solar_array: 2 }).electricity).toBeCloseTo(0.16, 10);
    expect(facilityBonuses({ solar_array: 4 }).outageCover).toBeCloseTo(0.6, 10);
    expect(facilityBonuses({ transporter_fleet: 5 }).lateDeliveries).toBe(1);
  });

  it('give no training boost from a simulator without a data room', () => {
    expect(facilityBonuses({ driver_simulator: 3 }).training).toBe(0);
    expect(facilityBonuses({ driver_simulator: 3, data_room: 1 }).training).toBeGreaterThan(0);
  });
});

describe('workshop bays', () => {
  it('lift the crew’s cover, and the most it can reach', () => {
    expect(crewStrength([50], 1)).toBe(0.5);
    expect(crewStrength([50], 1, 0.1)).toBeCloseTo(0.55, 10);
    expect(crewStrength([100], 1)).toBe(1);
    expect(crewStrength([100], 1, 0.1)).toBeCloseTo(1.1, 10);
  });
});

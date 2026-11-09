// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { facilityData } from './worldgen/data';

export type FacilityKind = keyof typeof facilityData.facilities;
export const FACILITY_KINDS = Object.keys(facilityData.facilities) as FacilityKind[];
export const MAX_FACILITY_LEVEL = facilityData.maxLevel;

export interface FacilityDef {
  buildCost: number;
  running: number;
  needs: FacilityKind | null;
  effect: Record<string, number>;
}

export const facilityDef = (kind: FacilityKind): FacilityDef =>
  facilityData.facilities[kind] as FacilityDef;

/** The price of taking a facility to a level (from the one below it). */
export function levelCost(kind: FacilityKind, level: number): number {
  return Math.round(facilityDef(kind).buildCost * facilityData.costGrowth ** (level - 1));
}

/** What a facility at a level costs to run each round. */
export function runningCost(kind: FacilityKind, level: number): number {
  return facilityDef(kind).running * level;
}

export type FacilityLevels = Partial<Record<FacilityKind, number>>;

/** What a garage's facilities add up to (zero for a garage with none). */
export interface FacilityBonuses {
  /** Lifts the crew's cover by this share (and the most it can reach). */
  crewCover: number;
  /** Raises the chance of a setup breakthrough in practice by this share. */
  breakthrough: number;
  /** Adds to the effect of driver training. */
  training: number;
  /** Share off part prices. */
  partPrice: number;
  /** Share off the electricity, water and logistics bills. */
  electricity: number;
  water: number;
  logistics: number;
  /** Share off the crew cover an electricity outage costs. */
  outageCover: number;
  /** Share off the chance that late transport hits. */
  lateDeliveries: number;
}

export const NO_FACILITY_BONUSES: FacilityBonuses = {
  crewCover: 0,
  breakthrough: 0,
  training: 0,
  partPrice: 0,
  electricity: 0,
  water: 0,
  logistics: 0,
  outageCover: 0,
  lateDeliveries: 0,
};

const cap = (x: number): number => Math.min(1, Math.max(0, x));

export function facilityBonuses(levels: FacilityLevels): FacilityBonuses {
  const at = (kind: FacilityKind, effect: string): number =>
    (levels[kind] ?? 0) * (facilityDef(kind).effect[effect] ?? 0);
  return {
    crewCover: at('workshop_bays', 'crewCover'),
    breakthrough: at('data_room', 'breakthrough'),
    training: levels.data_room ? at('driver_simulator', 'training') : 0,
    partPrice: cap(at('parts_store', 'partPrice')),
    electricity: cap(at('solar_array', 'electricity')),
    water: cap(at('water_tanks', 'water')),
    logistics: cap(at('transporter_fleet', 'logistics')),
    outageCover: cap(at('solar_array', 'outageCover')),
    lateDeliveries: cap(at('transporter_fleet', 'lateDeliveries')),
  };
}

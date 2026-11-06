// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { PlateState } from '../plates';

export type RoadType = 'forest' | 'coast' | 'mountain' | 'night';
export const ROAD_TYPES: readonly RoadType[] = ['forest', 'coast', 'mountain', 'night'];
export type CarType = 'hypercar' | 'supercar' | 'jdm' | 'sports' | 'domestic' | 'other';
export type Tier = 'starter' | 'mid' | 'premium' | 'elite' | 'hyper' | 'unique';
export type Layout = 'FR' | 'MR' | 'RR' | 'AWD' | 'FF';
export type AiProfile = 'cautious' | 'growth' | 'star_chaser' | 'local';

/** Reference data loaded from /data. */
export interface PlaceData {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  /** The kind of road around the place; left out, it is worked out from the place's id. */
  roadType?: RoadType;
}
export interface ManufacturerData {
  id: string;
  name: string;
  homeCountry: string;
  type: CarType;
  character: string;
}
export interface CarModelData {
  id: string;
  manufacturerId: string;
  name: string;
  tier: Tier;
  kerbKg: number;
  maxTyreMm: number;
  ps: number;
  layout: Layout;
  priceNew: number;
  /** 1 for a launch model; each successor adds one. */
  generation: number;
  introducedYear: number;
  /** Set when the model leaves the showroom. Retired models stay in the records. */
  retiredYear: number | null;
  predecessorId: string | null;
}

/** When a manufacturer next refreshes its lineup (about every five years). */
export interface ManufacturerRefresh {
  manufacturerId: string;
  nextRefreshYear: number;
}
export interface CourseData {
  id: string;
  number: number;
  name: string;
  state: string;
  shape: 'loop';
  lapKm: number;
  finalLaps: number;
  roadType: RoadType;
  altitudeM: number;
  night: boolean;
}

/** Generated world. Ids are 1-based and follow the order of the arrays. */
export interface Garage {
  id: number;
  name: string;
  flag: string;
  /** Where the garage works and races from: always an Australian place. */
  basePlaceId: string;
  /** Where its main factory, founder, owner or executive office is, which its flag stands for. */
  hqPlaceId: string;
  homeState: string;
  primaryColour: string;
  secondaryColour: string;
  prestige: number;
  cash: number;
  foundedYear: number;
  isPlayer: boolean;
  aiProfile: AiProfile;
  fans: number;
}

export type Identity = 'masculine' | 'feminine' | 'non_binary';

export interface Driver {
  id: number;
  name: string;
  /** The name pool the driver's name came from. How a driver is described is `identity`. */
  gender: 'male' | 'female';
  /** How the driver presents: masculine, feminine or non-binary (pronouns and the male, female or combined sign). */
  identity: Identity;
  /** One of the hidden characters (a dragon emoji marks them in the game). */
  easterEgg: boolean;
  birthDate: string;
  nationality: string;
  flag: string;
  hometownPlaceId: string;
  residencePlaceId: string;
  pace: number;
  consistency: number;
  racecraft: number;
  tyreManagement: number;
  composure: number;
  wetSkill: number;
  potential: number;
  affinities: Record<RoadType, number>;
  homeRoadType: RoadType;
  fans: number;
  fame: number;
  reputation: number;
  goldBorderYear: number | null;
  /** A handle such as "The Midnight Ghost", given to some drivers (see the GDD, "Titles and nicknames"). */
  nickname: string | null;
}

export interface Car {
  id: number;
  modelId: string;
  chassisNo: string;
  /** The Australian licence plate that identifies the car, such as `DT·42·HW`. */
  plate: string;
  /** The state or territory the plate was issued in. */
  plateState: PlateState;
  flag: string;
  fans: number;
  garageId: number;
  /** The model year of this actual chassis. */
  modelYear: number;
  /** Everyday and travel kilometres. */
  roadKm: number;
  /** Practice, prelim and race kilometres, which wear a car ten times as much. */
  raceKm: number;
  /** 0 is new, 100 is worn out. */
  wear: number;
  kerbKg: number;
  tyreWidthMm: number;
}

export interface Contract {
  driverId: number;
  garageId: number;
  startYear: number;
  endYear: number;
  salary: number;
  role: 'lead' | 'development';
  releaseFee: number;
}

export interface Entry {
  id: number;
  garageId: number;
  driverId: number;
  carId: number;
  raceNumber: number;
}

export interface RoundDates {
  number: number;
  courseId: string;
  practiceStart: string;
  prelimStart: string;
  finalDate: string;
}

export interface SeriesOfficial {
  name: string;
  role: 'chair' | 'technical' | 'interpersonal';
  residencePlaceId: string;
}

export interface Commentator {
  id: string;
  name: string;
  flag: string;
  hometownPlaceId: string;
  background: string;
  role: string;
  /** The kinds of moment this commentator tends to speak about. */
  focus: string[];
  voice: string;
}

export interface FlagFans {
  flag: string;
  fans: number;
}

export interface World {
  seed: string;
  year: number;
  seriesFans: number;
  rounds: RoundDates[];
  officials: SeriesOfficial[];
  garages: Garage[];
  drivers: Driver[];
  cars: Car[];
  entries: Entry[];
  contracts: Contract[];
  flagFans: FlagFans[];
  lineups: ManufacturerRefresh[];
  /** The gear each driver wears. */
  loadouts: { driverId: number; itemId: string }[];
}

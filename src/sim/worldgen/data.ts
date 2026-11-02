// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import balanceJson from '../../../data/balance.json';
import carModelsJson from '../../../data/car_models.json';
import coursesJson from '../../../data/courses.json';
import commentatorsJson from '../../../data/commentators.json';
import flagsJson from '../../../data/flags.json';
import manufacturersJson from '../../../data/manufacturers.json';
import namesJson from '../../../data/names.json';
import placesJson from '../../../data/places.json';
import pointsJson from '../../../data/points.json';
import prizesJson from '../../../data/prizes.json';
import type { CarModelData, Commentator, CourseData, ManufacturerData, PlaceData } from './types';

export const places = placesJson as PlaceData[];
export const manufacturers = manufacturersJson as ManufacturerData[];
export const carModels = carModelsJson as CarModelData[];
export const courses = coursesJson as CourseData[];
export const balance = balanceJson.worldgen;
export const wearBalance = balanceJson.wear;
export const simBalance = balanceJson.sim;
export const juniorBalance = balanceJson.junior;
export const finalBalance = balanceJson.final;
export const economyBalance = balanceJson.economy;
export const upgradeBalance = balanceJson.upgrades;
export const negotiationBalance = balanceJson.negotiation;
export const sponsorBalance = balanceJson.sponsors;
export const dealBalance = balanceJson.deals;
export const populations = flagsJson.populations as Record<string, number>;
/** Flags that no driver, car or garage may race under (see the GDD, "Flags"). */
/** Short name (UI and general use) and long name (standings, celebrations) for each flag. */
export const flagNames = flagsJson.names as Record<string, { short: string; long: string }>;
export const excludedFlags = new Set(flagsJson.excluded);

export interface NameLists {
  nationalityWeights: Record<string, number>;
  byNationality: Record<string, { male: string[]; female: string[]; surnames: string[] }>;
  garageWords: { adjectives: string[]; nouns: string[]; suffixes: string[] };
  denyFullNames: string[];
}
export const nameLists = namesJson as NameLists;

export const commentators = commentatorsJson as Commentator[];
export const HOST_COUNTRY = 'AU';

/** Championship points by finishing position (index 0 is 1st), by era. */
export const pointsTables = pointsJson as Record<string, number[]>;

/** Final race prize money by finishing position (index 0 is 1st), by era. */
export const prizeTables = prizesJson as Record<string, number[]>;

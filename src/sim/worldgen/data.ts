// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import balanceJson from '../../../data/balance.json';
import carModelsJson from '../../../data/car_models.json';
import coursesJson from '../../../data/courses.json';
import flagsJson from '../../../data/flags.json';
import manufacturersJson from '../../../data/manufacturers.json';
import namesJson from '../../../data/names.json';
import placesJson from '../../../data/places.json';
import type { CarModelData, CourseData, ManufacturerData, PlaceData } from './types';

export const places = placesJson as PlaceData[];
export const manufacturers = manufacturersJson as ManufacturerData[];
export const carModels = carModelsJson as CarModelData[];
export const courses = coursesJson as CourseData[];
export const balance = balanceJson.worldgen;
export const wearBalance = balanceJson.wear;
export const populations = flagsJson.populations as Record<string, number>;

export interface NameLists {
  nationalityWeights: Record<string, number>;
  byNationality: Record<string, { male: string[]; female: string[]; surnames: string[] }>;
  garageWords: { adjectives: string[]; nouns: string[]; suffixes: string[] };
  denyFullNames: string[];
}
export const nameLists = namesJson as NameLists;

export const HOST_COUNTRY = 'AU';

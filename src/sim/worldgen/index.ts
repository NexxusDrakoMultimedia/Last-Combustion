// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng, type RandomStream } from '../rng';
import { wearFromKm } from '../wear';
import { buildCalendar } from './calendar';
import {
  HOST_COUNTRY,
  balance,
  carModels,
  manufacturers,
  nameLists,
  places,
  populations,
} from './data';
import { garageName, nickname, nicknameThemesFor, personName, pickNationality } from './names';
import { generateLoadouts } from './loadouts';
import { clamp, fairSalary, fameFromFans, overallRating } from './rating';
import {
  ROAD_TYPES,
  type AiProfile,
  type Car,
  type CarModelData,
  type CarType,
  type Contract,
  type Driver,
  type Entry,
  type Garage,
  type RoadType,
  type World,
} from './types';

export { buildCalendar } from './calendar';
export { fameFromFans, overallRating } from './rating';
export type * from './types';

export const DRAKE_MOTORSPORTS = 'Drake Motorsports';
export const RESERVED_NUMBER = 313;
const SEASON_YEAR = 2031;
const SPIRIT_R7 = 'homura-spirit-r-7';

const COLOUR_PAIRS: readonly (readonly [string, string])[] = [
  ['#1d3557', '#f1faee'],
  ['#264653', '#e9c46a'],
  ['#6a040f', '#f4f1de'],
  ['#0b525b', '#ffd166'],
  ['#2b2d42', '#ef233c'],
  ['#3d405b', '#f2cc8f'],
  ['#14213d', '#fca311'],
  ['#403d39', '#eb5e28'],
  ['#386641', '#f2e8cf'],
  ['#5f0f40', '#fb8b24'],
  ['#023047', '#8ecae6'],
  ['#7f5539', '#ede0d4'],
  ['#9d0208', '#f8f9fa'],
  ['#1b4332', '#d8f3dc'],
  ['#212529', '#ffc300'],
  ['#003049', '#d62828'],
];

const placesByCountry = new Map<string, typeof places>();
for (const place of places) {
  const list = placesByCountry.get(place.country) ?? [];
  list.push(place);
  placesByCountry.set(place.country, list);
}
const placeById = new Map(places.map((p) => [p.id, p]));
const modelById = new Map(carModels.map((m) => [m.id, m]));
const makerById = new Map(manufacturers.map((m) => [m.id, m]));

const placeIn = (rng: RandomStream, country: string): string =>
  rng.pick(placesByCountry.get(country) ?? (placesByCountry.get(HOST_COUNTRY) as typeof places)).id;

const otherCountry = (rng: RandomStream, not: string): string =>
  rng.pick([...placesByCountry.keys()].filter((c) => c !== not));

/** Garage sizes: sampled from the configured weights, then nudged so they add up exactly. */
function garageSizes(rng: RandomStream): number[] {
  const sizes = Object.keys(balance.garageSizeWeights).map(Number);
  const weights = sizes.map(
    (s) => (balance.garageSizeWeights as Record<string, number>)[String(s)] as number,
  );
  const counts = Array.from({ length: balance.garages }, () => rng.weighted(sizes, weights));
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  let total = counts.reduce((sum, n) => sum + n, 0);
  while (total !== balance.entries) {
    const step = total < balance.entries ? 1 : -1;
    const index = rng.int(0, counts.length - 1);
    const next = (counts[index] as number) + step;
    if (next < min || next > max) continue;
    counts[index] = next;
    total += step;
  }
  return counts;
}

function makeDriver(rng: RandomStream, id: number): Driver {
  const cfg = balance.driver;
  const nationality = pickNationality(rng);
  const gender = rng.chance(cfg.femaleShare) ? 'female' : 'male';
  const flag = rng.chance(cfg.differentFlagShare) ? pickNationality(rng) : nationality;
  const origins = balance.origins;

  const hometownCountry = rng.chance(origins.hometownInFlagCountry)
    ? flag
    : otherCountry(rng, flag);
  let residenceCountry: string;
  if (flag === HOST_COUNTRY) {
    residenceCountry = rng.chance(origins.australianResidentInAustralia)
      ? HOST_COUNTRY
      : otherCountry(rng, HOST_COUNTRY);
  } else {
    const roll = rng.next();
    if (roll < origins.residenceInFlagCountry) residenceCountry = flag;
    else if (roll < origins.residenceInFlagCountry + origins.residenceInHostCountry)
      residenceCountry = HOST_COUNTRY;
    else residenceCountry = otherCountry(rng, flag);
  }

  const age = Math.round(rng.clampedNormal(cfg.ageMean, cfg.ageSd, cfg.ageMin, cfg.ageMax));
  const birthYear = SEASON_YEAR - age;
  const birthDate = new Date(Date.UTC(birthYear, rng.int(0, 11), rng.int(1, 28)));

  const pace = Math.round(rng.clampedNormal(cfg.paceMean, cfg.paceSd, cfg.paceMin, cfg.paceMax));
  const stat = (mean: number) =>
    Math.round(clamp(0.4 * pace + 0.6 * mean + rng.normal(0, 10), 10, 95));
  const homeRoadType = rng.weighted<RoadType>(
    ['forest', 'coast', 'mountain', 'night'],
    [0.35, 0.25, 0.3, 0.1],
  );
  const affinities = {} as Record<RoadType, number>;
  for (const type of ROAD_TYPES) {
    const base = pace + rng.normal(type === 'night' ? -5 : 0, 8) + (type === homeRoadType ? 10 : 0);
    affinities[type] = Math.round(clamp(base, 10, 95));
  }
  return {
    id,
    name: personName(rng, nationality, gender),
    gender,
    birthDate: birthDate.toISOString().slice(0, 10),
    nationality,
    flag,
    hometownPlaceId: placeIn(rng, hometownCountry),
    residencePlaceId: placeIn(rng, residenceCountry),
    pace,
    consistency: stat(50),
    racecraft: stat(pace),
    tyreManagement: stat(50),
    composure: stat(50),
    wetSkill: stat(45),
    potential: Math.min(99, pace + rng.int(0, 25)),
    affinities,
    homeRoadType,
    fans: 0,
    fame: 0,
    reputation: 0,
    goldBorderYear: null,
    nickname: null,
  };
}

/** Drivers are dealt into garages; stronger drivers tend to land in larger garages. */
function dealDrivers(rng: RandomStream, drivers: Driver[], sizes: number[]): number[] {
  const garageScore = sizes.map((size) => size + rng.normal(0, 1.2));
  const mean = garageScore.reduce((a, b) => a + b, 0) / garageScore.length;
  const remaining = [...sizes];
  const order = drivers
    .map((d) => ({ d, key: overallRating(d) + rng.normal(0, 8) }))
    .sort((a, b) => b.key - a.key);
  const assignment = new Array<number>(drivers.length);
  for (const { d } of order) {
    const weights = remaining.map((left, g) =>
      left > 0 ? left * Math.max(0.2, 1 + 0.5 * ((garageScore[g] as number) - mean)) : 0,
    );
    const garage = rng.weighted(
      weights.map((_, g) => g),
      weights,
    );
    assignment[d.id - 1] = garage;
    remaining[garage] = (remaining[garage] as number) - 1;
  }
  return assignment;
}

function tierWeight(tier: CarModelData['tier'], prestige: number): number {
  switch (tier) {
    case 'starter':
      return Math.max(0.15, 1 - prestige / 60);
    case 'mid':
      return 1;
    case 'premium':
      return Math.max(0.1, prestige / 35);
    case 'elite':
      return Math.max(0.05, prestige / 70);
    case 'hyper':
      return Math.max(0.01, prestige / 350);
    default:
      return 0;
  }
}

/** Generates the 2031 world for a master seed. Pure and deterministic. */
export function generateWorld(seed: string | number): World {
  const rng = createRng(seed);
  const cfg = balance;
  const calendar = buildCalendar(SEASON_YEAR);

  // --- garages ---
  const gRng = rng.stream('worldgen:garages');
  const sizes = garageSizes(gRng);
  const drakeIndex = sizes.findIndex((s) => s === 3);
  const usedNames = new Set<string>([DRAKE_MOTORSPORTS]);

  // --- drivers ---
  const dRng = rng.stream('worldgen:drivers');
  const drivers: Driver[] = Array.from({ length: cfg.entries }, (_, i) => makeDriver(dRng, i + 1));
  // Season 1 is the series' first year: nobody has a gold border, points or history yet.
  const garageOf = dealDrivers(dRng, drivers, sizes);

  // --- garage records ---
  const members = sizes.map((): Driver[] => []);
  drivers.forEach((d, i) => members[garageOf[i] as number]?.push(d));
  const garages: Garage[] = sizes.map((size, index) => {
    const isDrake = index === drakeIndex;
    const hostFlag = gRng.chance(cfg.garage.australianFlagShare);
    const flag = isDrake || hostFlag ? HOST_COUNTRY : pickNationality(gRng);
    const nationality = nameLists.byNationality[flag] ? flag : HOST_COUNTRY;
    const prestige = clamp(
      cfg.garage.prestigeBase + cfg.garage.prestigePerEntry * size + (isDrake ? 15 : 0),
      1,
      100,
    );
    const basePlaceId = isDrake ? 'au-brisbane' : placeIn(gRng, flag);
    const [primary, secondary] = isDrake ? ['#7f0000', '#ffd900'] : gRng.pick(COLOUR_PAIRS);
    const profile: AiProfile =
      size === 1 && gRng.chance(0.6)
        ? 'local'
        : gRng.weighted<AiProfile>(
            ['cautious', 'growth', 'star_chaser', 'local'],
            [0.3, 0.3, 0.15, 0.25],
          );
    return {
      id: index + 1,
      name: isDrake ? DRAKE_MOTORSPORTS : garageName(gRng, nationality, usedNames),
      flag,
      basePlaceId,
      homeState: (placeById.get(basePlaceId) as { region: string }).region,
      primaryColour: primary,
      secondaryColour: secondary,
      prestige,
      cash:
        Math.round(
          ((cfg.garage.cashBase + cfg.garage.cashPerPrestige * prestige) * gRng.float(0.7, 1.3)) /
            100,
        ) * 100,
      foundedYear: SEASON_YEAR - gRng.int(0, 25),
      isPlayer: false,
      aiProfile: profile,
      fans: 0,
    };
  });

  // --- race numbers: no earlier season exists to rank, so every number but #313 is open ---
  const nRng = rng.stream('worldgen:numbers');
  const openNumbers = nRng.shuffle(
    Array.from({ length: cfg.numberPool }, (_, i) => i + 1).filter((n) => n !== RESERVED_NUMBER),
  );
  const numberOf = new Map<number, number>();
  drivers.forEach((d, i) => numberOf.set(d.id, openNumbers[i] as number));

  // --- cars: exact type mix, supercars go to the most prestigious garages ---
  const cRng = rng.stream('worldgen:cars');
  const types = Object.keys(cfg.carTypeMix) as CarType[];
  const typeQuota = {} as Record<CarType, number>;
  let assigned = 0;
  types.forEach((type, i) => {
    typeQuota[type] =
      i === types.length - 1
        ? cfg.entries - assigned
        : Math.round(cfg.entries * cfg.carTypeMix[type]);
    assigned += typeQuota[type];
  });
  const garagePower = garages.map((g) => g.prestige + cRng.normal(0, 6));
  const slots = drivers
    .map((d) => ({ d, power: garagePower[garageOf[d.id - 1] as number] as number }))
    .sort((a, b) => b.power - a.power || a.d.id - b.d.id);
  const typeOfDriver = new Map<number, CarType>();
  // The most prestigious garages get the hypercars, then the supercars; the remaining
  // classes are dealt out at random to everyone else.
  slots.slice(0, typeQuota.hypercar).forEach(({ d }) => typeOfDriver.set(d.id, 'hypercar'));
  const afterHyper = typeQuota.hypercar + typeQuota.supercar;
  slots
    .slice(typeQuota.hypercar, afterHyper)
    .forEach(({ d }) => typeOfDriver.set(d.id, 'supercar'));
  const others = cRng.shuffle(
    (['jdm', 'sports', 'domestic', 'other'] as CarType[]).flatMap((type) =>
      Array.from({ length: typeQuota[type] }, () => type),
    ),
  );
  slots.slice(afterHyper).forEach(({ d }, i) => typeOfDriver.set(d.id, others[i] as CarType));

  const cars: Car[] = [];
  const entries: Entry[] = [];
  const driverCar = new Map<number, Car>();
  for (const d of drivers) {
    const garage = garages[garageOf[d.id - 1] as number] as Garage;
    const type = typeOfDriver.get(d.id) as CarType;
    const pool = carModels.filter(
      (m) => makerById.get(m.manufacturerId)?.type === type && m.id !== SPIRIT_R7,
    );
    const model = cRng.weighted(
      pool,
      pool.map((m) => tierWeight(m.tier, garage.prestige)),
    );
    const carCfg = cfg.cars;
    const age = cRng.int(0, carCfg.maxAgeYears[model.tier as keyof typeof carCfg.maxAgeYears]);
    const roadKm =
      Math.round(
        (age *
          cRng.float(carCfg.roadKmPerYear[0] as number, carCfg.roadKmPerYear[1] as number) *
          carCfg.usageFactor[model.tier as keyof typeof carCfg.usageFactor] +
          cRng.int(50, 500)) /
          10,
      ) * 10;
    const car: Car = {
      id: cars.length + 1,
      modelId: model.id,
      chassisNo: `LC-${model.id.split('-')[0]?.slice(0, 3).toUpperCase()}-${String(cars.length + 1).padStart(5, '0')}`,
      flag: (makerById.get(model.manufacturerId) as { homeCountry: string }).homeCountry,
      fans: 0,
      garageId: garage.id,
      modelYear: SEASON_YEAR - age,
      roadKm,
      raceKm: 0,
      wear: wearFromKm(roadKm, 0, model.tier),
      kerbKg: model.kerbKg,
      tyreWidthMm: model.maxTyreMm,
    };
    cars.push(car);
    driverCar.set(d.id, car);
  }
  // Drake Motorsports keeps its founder's car, which is not entered in the series.
  const spirit = modelById.get(SPIRIT_R7) as CarModelData;
  cars.push({
    id: cars.length + 1,
    modelId: spirit.id,
    chassisNo: 'LC-HOM-R7-0313',
    flag: 'JP',
    fans: 0,
    garageId: (garages[drakeIndex] as Garage).id,
    modelYear: 2022,
    roadKm: 24000,
    raceKm: 0,
    wear: wearFromKm(24000, 0, 'unique'),
    kerbKg: spirit.kerbKg,
    tyreWidthMm: spirit.maxTyreMm,
  });

  // --- entries ---
  for (const d of drivers) {
    entries.push({
      id: entries.length + 1,
      garageId: garages[garageOf[d.id - 1] as number]?.id as number,
      driverId: d.id,
      carId: (driverCar.get(d.id) as Car).id,
      raceNumber: numberOf.get(d.id) as number,
    });
  }

  // --- nicknames: some drivers have a handle that suits how they race ---
  const nickRng = rng.stream('worldgen:nicknames');
  const usedNicknames = new Set<string>();
  for (const d of drivers) {
    if (!nickRng.chance(nameLists.nicknameShare)) continue;
    d.nickname = nickname(
      nickRng,
      nicknameThemesFor({
        homeRoadType: d.homeRoadType,
        wetSkill: d.wetSkill,
        racecraft: d.racecraft,
        consistency: d.consistency,
        age: SEASON_YEAR - Number(d.birthDate.slice(0, 4)),
      }),
      usedNicknames,
    );
  }

  // --- reputation and fans ---
  const fRng = rng.stream('worldgen:fans');
  const f = cfg.fans;
  for (const d of drivers) {
    d.fans = Math.round(
      clamp(Math.exp(fRng.normal(Math.log(f.unknownMedian), 0.6)), f.unknownMin, f.unknownMax),
    );
    d.fame = Math.round(fameFromFans(d.fans) * 10) / 10;
    d.reputation = fRng.int(5, 35);
  }
  const garageDriverFans = garages.map(() => 0);
  drivers.forEach((d) => {
    garageDriverFans[garageOf[d.id - 1] as number] =
      (garageDriverFans[garageOf[d.id - 1] as number] as number) + d.fans;
  });
  garages.forEach((g, i) => {
    g.fans = Math.round(f.garageStart + f.garageShareOfDrivers * (garageDriverFans[i] as number));
  });
  for (const d of drivers)
    (driverCar.get(d.id) as Car).fans = Math.round(f.carShareOfDriver * d.fans);

  const flagTotals = new Map<string, number>();
  for (const [code, population] of Object.entries(populations)) {
    flagTotals.set(
      code,
      population * f.nationalBaseRate * (code === HOST_COUNTRY ? f.hostMultiplier : 1),
    );
  }
  const addToFlag = (code: string, fans: number) =>
    flagTotals.set(code, (flagTotals.get(code) ?? 0) + f.flagShare * fans);
  drivers.forEach((d) => addToFlag(d.flag, d.fans));
  garages.forEach((g) => addToFlag(g.flag, g.fans));
  const flagFans = [...flagTotals.entries()]
    .map(([flag, fans]) => ({ flag, fans: Math.round(fans) }))
    .sort((a, b) => a.flag.localeCompare(b.flag));

  // --- manufacturer lineups: first refresh is due 3-6 years in, then about every five ---
  const lRng = rng.stream('worldgen:lineups');
  const lineups = manufacturers.map((m) => ({
    manufacturerId: m.id,
    nextRefreshYear:
      SEASON_YEAR + lRng.int(cfg.lineups.firstRefreshMinYears, cfg.lineups.firstRefreshMaxYears),
  }));

  // --- contracts ---
  const kRng = rng.stream('worldgen:contracts');
  const contracts: Contract[] = [];
  garages.forEach((g, i) => {
    const staff = [...(members[i] as Driver[])].sort((a, b) => overallRating(b) - overallRating(a));
    staff.forEach((d, rank) => {
      const length = kRng.int(1, 3);
      const salary =
        Math.round((fairSalary(overallRating(d), false) * kRng.float(0.7, 1.1)) / 100) * 100;
      contracts.push({
        driverId: d.id,
        garageId: g.id,
        startYear: SEASON_YEAR,
        endYear: SEASON_YEAR + length - 1,
        salary,
        role: rank === 0 ? 'lead' : 'development',
        releaseFee: Math.round((cfg.contracts.releaseFeeShare * salary * length) / 100) * 100,
      });
    });
  });

  return {
    seed: String(seed),
    year: SEASON_YEAR,
    seriesFans: f.seriesStart,
    rounds: calendar,
    officials: [
      { name: 'Pyra Drake', role: 'chair', residencePlaceId: 'au-brisbane' },
      { name: 'Declan Marsh', role: 'technical', residencePlaceId: 'au-healesville' },
      { name: 'Odette Brandt', role: 'interpersonal', residencePlaceId: 'au-healesville' },
    ],
    garages,
    drivers,
    cars,
    entries,
    contracts,
    flagFans,
    lineups,
    loadouts: generateLoadouts(
      drivers,
      (id) => (garages[garageOf[id - 1] as number] as Garage).prestige,
      rng.stream('worldgen:gear'),
    ),
  };
}

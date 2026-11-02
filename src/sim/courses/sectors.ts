// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import outlinesJson from '../../../data/courses/outlines.json';
import { hashSeed } from '../rng';
import { courses } from '../worldgen/data';
import type { CourseData, RoadType } from '../worldgen/types';

/** One stretch of a course. Sectors are the unit the lap-time model works in. */
export interface Sector {
  courseId: string;
  order: number;
  startKm: number;
  lengthM: number;
  /** Quarter-turns of direction change per km. */
  cornerDensity: number;
  /** The longest nearly straight run in the sector, in metres. */
  straightM: number;
  elevationChangeM: number;
  widthM: number;
  overtakeSpot: boolean;
  roadType: RoadType;
  surface: 'sealed';
  /** The time a reference car and driver would take, in seconds. */
  refSeconds: number;
}

interface OutlinePoint extends Array<number> {
  0: number;
  1: number;
  2: number;
}
interface Outline {
  points: OutlinePoint[];
  lap_km: number;
}

const outlines = outlinesJson as unknown as Record<string, Outline>;

/** Target length of a sector. */
export const SECTOR_TARGET_KM = 2.5;
const WIDTH_BY_ROAD: Record<RoadType, number> = { mountain: 6, forest: 6.5, coast: 7, night: 6.5 };
const ELEVATION_NOTE = 'Elevation is a smooth synthetic profile until the courses are surveyed.';
export { ELEVATION_NOTE };

/**
 * The saved outlines are simplified (about 8 m tolerance, at most 300 points), so they hide
 * the small bends. Measured corner density is scaled up by this factor to approximate the
 * real road until the courses are surveyed.
 */
export const CORNER_DETAIL_FACTOR = 2.5;
/** Every course gets at least this many places to overtake. */
const MIN_OVERTAKE_SPOTS = 3;

const TAU = Math.PI * 2;
const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

/** A smooth, repeatable height profile (metres) for a course, by distance along the lap. */
function elevationAt(course: CourseData, km: number): number {
  const [a, b, c] = hashSeed(course.id);
  const phase = (n: number) => ((n % 1000) / 1000) * TAU;
  const amp = (course as unknown as { elevationAmplitudeM: number }).elevationAmplitudeM;
  const lap = course.lapKm;
  const t = (km / lap) * TAU;
  return (
    course.altitudeM +
    amp *
      (0.6 * Math.sin(t + phase(a)) +
        0.3 * Math.sin(2 * t + phase(b)) +
        0.1 * Math.sin(3 * t + phase(c)))
  );
}

/** Splits a course into sectors using its saved outline (see the GDD, "Course outlines"). */
export function buildSectors(course: CourseData): Sector[] {
  const outline = outlines[String(course.number)];
  if (!outline) throw new Error(`No outline for course ${course.id}`);
  const points = outline.points;
  const totalKm = course.lapKm;
  const count = Math.max(4, Math.round(totalKm / SECTOR_TARGET_KM));
  const lengthKm = totalKm / count;

  // Unit scale: outline units per km, measured from the polyline itself.
  let unitLength = 0;
  for (let i = 1; i < points.length; i++) {
    unitLength += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  const unitsPerKm = unitLength / (points[points.length - 1]![2] || totalKm);

  const sectors: Sector[] = [];
  for (let order = 0; order < count; order++) {
    const startKm = order * lengthKm;
    const endKm = startKm + lengthKm;
    const inside = points.filter((p) => {
      const km = (p[2] / (points[points.length - 1]![2] || totalKm)) * totalKm;
      return km >= startKm && km <= endKm;
    });
    let turning = 0;
    let longestStraightKm = 0;
    let run = 0;
    for (let i = 2; i < inside.length; i++) {
      const h1 = Math.atan2(
        inside[i - 1]![1] - inside[i - 2]![1],
        inside[i - 1]![0] - inside[i - 2]![0],
      );
      const h2 = Math.atan2(inside[i]![1] - inside[i - 1]![1], inside[i]![0] - inside[i - 1]![0]);
      const turn = Math.abs(angleDiff(h1, h2));
      turning += turn;
      const segKm =
        Math.hypot(inside[i]![0] - inside[i - 1]![0], inside[i]![1] - inside[i - 1]![1]) /
        unitsPerKm;
      if (turn < (15 * Math.PI) / 180) {
        run += segKm;
        longestStraightKm = Math.max(longestStraightKm, run);
      } else {
        run = 0;
      }
    }
    const cornerDensity = (CORNER_DETAIL_FACTOR * turning) / (Math.PI / 2) / lengthKm;
    const straightM = Math.round(longestStraightKm * 1000);
    const elevationChangeM = Math.round(
      Math.abs(elevationAt(course, endKm) - elevationAt(course, startKm)),
    );
    const [seed] = hashSeed(`${course.id}:${order}`);
    const widthM =
      Math.round((WIDTH_BY_ROAD[course.roadType] + ((seed % 1000) / 1000 - 0.5) * 1.2) * 10) / 10;
    const speedKmh = Math.min(110, Math.max(40, 120 - 10 * cornerDensity));
    sectors.push({
      courseId: course.id,
      order,
      startKm: Math.round(startKm * 1000) / 1000,
      lengthM: Math.round(lengthKm * 1000),
      cornerDensity: Math.round(cornerDensity * 100) / 100,
      straightM,
      elevationChangeM,
      widthM,
      overtakeSpot: straightM >= 250 && widthM >= 6.2,
      roadType: course.roadType,
      surface: 'sealed',
      refSeconds: Math.round((lengthKm / speedKmh) * 3600 * 100) / 100,
    });
  }
  // Every course needs a few places to pass: promote the straightest sectors if it has too few.
  const spots = sectors.filter((x) => x.overtakeSpot).length;
  if (spots < MIN_OVERTAKE_SPOTS) {
    const candidates = sectors
      .filter((x) => !x.overtakeSpot)
      .sort(
        (a, b) =>
          b.straightM - a.straightM || a.cornerDensity - b.cornerDensity || a.order - b.order,
      );
    for (const x of candidates.slice(0, MIN_OVERTAKE_SPOTS - spots)) x.overtakeSpot = true;
  }
  return sectors;
}

/** Sectors for every course, in course order. */
export function buildAllSectors(): Sector[] {
  return courses.flatMap((course) => buildSectors(course));
}

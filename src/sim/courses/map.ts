// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import outlinesJson from '../../../data/courses/outlines.json';

/** One point of an outline: x and y in the outline's box, and the distance along the lap in km. */
export type OutlinePoint = [x: number, y: number, km: number];

/** What a map of a course is drawn from (see the GDD, "Course outlines"). */
export interface MapOutline {
  /** minX, minY, width, height of the drawing. */
  viewBox: [number, number, number, number];
  /** The SVG path of the road. */
  path: string;
  points: OutlinePoint[];
  lapKm: number;
}

interface SavedOutline {
  viewBox: [number, number, number, number];
  path: string;
  points: OutlinePoint[];
  lap_km: number;
}

const saved = outlinesJson as unknown as Record<string, SavedOutline>;

/** The saved outline of a course by its number (1 to 6), or undefined. */
export function outlineOf(courseNumber: number): MapOutline | undefined {
  const o = saved[String(courseNumber)];
  return o ? { viewBox: o.viewBox, path: o.path, points: o.points, lapKm: o.lap_km } : undefined;
}

/**
 * Where a distance along the lap falls on the outline: between the two points either side of it,
 * and on the first or last point for a distance outside the lap.
 */
export function pointAtKm(points: readonly OutlinePoint[], km: number): { x: number; y: number } {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (km <= first[2]) return { x: first[0], y: first[1] };
  if (km >= last[2]) return { x: last[0], y: last[1] };
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]![2] <= km) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  const span = b[2] - a[2];
  const f = span > 0 ? (km - a[2]) / span : 0;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
}

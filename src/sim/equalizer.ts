// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { upgradeBalance } from './worldgen/data';
import type { Layout } from './worldgen/types';

/** The tyre width (mm) that a layout loses under the Equalizer: 4WD and mid-engine cars are handicapped. */
export function layoutHandicapMm(layout: Layout | undefined): number {
  if (!layout) return 0;
  return (upgradeBalance.handicapMm as Partial<Record<Layout, number>>)[layout] ?? 0;
}

/**
 * The Equalizer (see the GDD, "Technical regulations"): the widest legal tyre for a kerb weight,
 * kerb weight / 5 + 40 mm, less the handicap for a 4WD or mid-engine car.
 */
export function equalizerMm(kerbKg: number, layout?: Layout): number {
  return Math.round(kerbKg / 5 + 40) - layoutHandicapMm(layout);
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { juniorBalance } from './worldgen/data';

/** Power in kilowatts for a power in PS (metric horsepower). */
export const psToKw = (ps: number): number => ps * juniorBalance.kwPerPs;

/** Power in PS for a power in kilowatts. */
export const kwToPs = (kw: number): number => kw / juniorBalance.kwPerPs;

/** The Junior Series power cap, in kilowatts. */
export const JUNIOR_POWER_CAP_KW: number = juniorBalance.powerCapKw;

/** Whether a car may race in the Junior Series without an intake restrictor. */
export const isJuniorLegal = (ps: number): boolean => psToKw(ps) <= JUNIOR_POWER_CAP_KW;

/** The power a car makes once a restrictor limits it to the Junior cap, in PS. */
export const restrictedPs = (ps: number): number => Math.min(ps, kwToPs(JUNIOR_POWER_CAP_KW));

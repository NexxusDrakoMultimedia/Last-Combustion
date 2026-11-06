// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/**
 * Schema version 36: a car that passes the oldest age for its tier without ever scoring a point
 * retires. `retired_year` is the last season it was around; the car moves to the market garage with
 * no listing, so it drops out of every garage and market query but keeps its record.
 */
export const migration0036: Migration = {
  version: 36,
  name: 'car_retirement',
  sql: `
    ALTER TABLE car ADD COLUMN retired_year INTEGER;
  `,
};

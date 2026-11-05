// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';
import { migration0001 } from './0001_initial';
import { migration0002 } from './0002_world';
import { migration0003 } from './0003_prelims';
import { migration0004 } from './0004_final';
import { migration0005 } from './0005_economy';
import { migration0006 } from './0006_market';
import { migration0007 } from './0007_parts';
import { migration0008 } from './0008_auctions';
import { migration0009 } from './0009_negotiation';
import { migration0010 } from './0010_preferred_number';
import { migration0011 } from './0011_sponsors';
import { migration0012 } from './0012_deals';
import { migration0013 } from './0013_repairs';
import { migration0014 } from './0014_standings';
import { migration0015 } from './0015_almanac';
import { migration0016 } from './0016_titles';
import { migration0017 } from './0017_trophies';
import { migration0018 } from './0018_world_events';
import { migration0019 } from './0019_identity';
import { migration0020 } from './0020_easter_egg';
import { migration0021 } from './0021_owner';
import { migration0022 } from './0022_starter';
import { migration0023 } from './0023_prize_share';
import { migration0024 } from './0024_garage_finances';
import { migration0025 } from './0025_gear_wear';

/** Every migration, in order. Never edit a released migration: add a new one. */
export const migrations: readonly Migration[] = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
  migration0006,
  migration0007,
  migration0008,
  migration0009,
  migration0010,
  migration0011,
  migration0012,
  migration0013,
  migration0014,
  migration0015,
  migration0016,
  migration0017,
  migration0018,
  migration0019,
  migration0020,
  migration0021,
  migration0022,
  migration0023,
  migration0024,
  migration0025,
];

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
import { migration0026 } from './0026_training';
import { migration0027 } from './0027_plates';
import { migration0028 } from './0028_staff';
import { migration0029 } from './0029_executives';
import { migration0030 } from './0030_supply';
import { migration0031 } from './0031_awards';
import { migration0032 } from './0032_headquarters';
import { migration0033 } from './0033_daily_life';
import { migration0034 } from './0034_restorations';
import { migration0035 } from './0035_garage_champions';
import { migration0036 } from './0036_car_retirement';
import { migration0037 } from './0037_continental_tier';
import { migration0038 } from './0038_facilities';
import { migration0039 } from './0039_executive_departures';
import { migration0040 } from './0040_ledger_year';
import { migration0041 } from './0041_cap_table';
import { migration0042 } from './0042_share_events';
import { migration0043 } from './0043_board';
import { migration0044 } from './0044_investments';
import { migration0045 } from './0045_business';
import { migration0046 } from './0046_morale';
import { migration0047 } from './0047_conversations';
import { migration0048 } from './0048_press';
import { migration0049 } from './0049_conversations_auto';
import { migration0050 } from './0050_deaths';
import { migration0051 } from './0051_origins';
import { migration0052 } from './0052_job_market';
import { migration0053 } from './0053_company_breaks';
import { migration0054 } from './0054_rivalries';
import { migration0055 } from './0055_season_buzz';
import { migration0056 } from './0056_storylines';
import { migration0057 } from './0057_news';

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
  migration0026,
  migration0027,
  migration0028,
  migration0029,
  migration0030,
  migration0031,
  migration0032,
  migration0033,
  migration0034,
  migration0035,
  migration0036,
  migration0037,
  migration0038,
  migration0039,
  migration0040,
  migration0041,
  migration0042,
  migration0043,
  migration0044,
  migration0045,
  migration0046,
  migration0047,
  migration0048,
  migration0049,
  migration0050,
  migration0051,
  migration0052,
  migration0053,
  migration0054,
  migration0055,
  migration0056,
  migration0057,
];

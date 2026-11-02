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
];

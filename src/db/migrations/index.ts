// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';
import { migration0001 } from './0001_initial';
import { migration0002 } from './0002_world';
import { migration0003 } from './0003_prelims';

/** Every migration, in order. Never edit a released migration: add a new one. */
export const migrations: readonly Migration[] = [migration0001, migration0002, migration0003];

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

import type { Migration } from '../migrate';

/**
 * Schema version 49: a conversation the player missed. When a social occasion ends with conversations
 * unspent, they are held by themselves (a random manner with a random contact or a stranger), and the
 * conversation says so.
 */
export const migration0049: Migration = {
  version: 49,
  name: 'conversations_auto',
  sql: `
    ALTER TABLE conversation ADD COLUMN auto INTEGER NOT NULL DEFAULT 0 CHECK (auto IN (0, 1));
  `,
};

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { relationshipKinds } from './worldgen/data';

export type RelationshipKind = 'friend' | 'acquaintance' | 'rival' | 'enemy';

/** What a relationship score makes two parties to each other. */
export function relationshipKind(score: number): RelationshipKind {
  if (score >= relationshipKinds.friend) return 'friend';
  if (score <= relationshipKinds.enemy) return 'enemy';
  if (score <= relationshipKinds.rival) return 'rival';
  return 'acquaintance';
}

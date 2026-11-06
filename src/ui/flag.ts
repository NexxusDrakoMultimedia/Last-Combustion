// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { worldChangeData } from '../sim/worldchanges';
import { flagNames } from '../sim/worldgen/data';

/**
 * The CSS class of a flag's artwork. Flag codes are the ISO codes the game uses (`AU`) or the
 * lower-case region codes (`gb-eng`, `es-ct`); once Australia has become the Commonwealth of
 * Vyktory, its code draws Vyktory's own flag instead.
 */
export function flagClass(code: string, vyktory: boolean): string {
  if (vyktory && code === worldChangeData.vyktory.flag) return 'fi fi-vyktory';
  return `fi fi-${code.toLowerCase()}`;
}

/** The name a flag goes by, for its tooltip and its label. */
export function flagLabel(code: string, vyktory: boolean): string {
  if (vyktory && code === worldChangeData.vyktory.flag) return worldChangeData.vyktory.short;
  return flagNames[code]?.short ?? code;
}

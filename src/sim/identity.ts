// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Identity } from './worldgen/types';

/** The male sign, the female sign and the combined male and female sign. */
export const IDENTITY_SIGN: Record<Identity, string> = {
  masculine: '♂',
  feminine: '♀',
  non_binary: '⚥',
};

/** Locale keys for a driver's pronouns, so text is built with `t()` (see `locales/en.json`). */
export const pronounKeys = (identity: Identity) => ({
  subject: `pronoun.${identity}.subject`,
  object: `pronoun.${identity}.object`,
  possessive: `pronoun.${identity}.possessive`,
});

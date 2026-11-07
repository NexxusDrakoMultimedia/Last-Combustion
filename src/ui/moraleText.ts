// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import { moraleBand } from '../sim/morale';

/** A morale in words: "Morale 62, fair". */
export const moraleText = (morale: number): string =>
  t('morale.value', { value: morale, band: t(`morale.band.${moraleBand(morale)}` as never) });

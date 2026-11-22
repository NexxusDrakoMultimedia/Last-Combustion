// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import { PALPABLY_UNFAIR, type PenaltyType } from '../sim/penalties';

/** A penalty's name: its level and its type, as in Major Drone or Egregious Sportsmanship. */
export function penaltyName(level: string, type: PenaltyType): string {
  if (level === PALPABLY_UNFAIR) return t('penalty.palpably_unfair');
  return t('penalty.name', {
    level: t(`penalty.level.${level}` as never),
    type: t(`penalty.type.${type}` as never),
  });
}

/** The line of news for a penalty in a prelim or a final, and what it costs. Includes a ban when there is one. */
export function penaltyNews(p: {
  type: PenaltyType;
  level: string;
  raceNumber: number;
  driver: string;
  percent?: number | null;
  places?: number | null;
  banRaces?: number | null;
}): string {
  const base = {
    penalty: penaltyName(p.level, p.type),
    number: p.raceNumber,
    driver: p.driver,
    reason: t(`penalty.reason.${p.type}` as never),
  };
  if (p.level === PALPABLY_UNFAIR)
    return t('hub.penaltyUnfair', {
      ...base,
      ban: p.banRaces ? t('hub.penaltyBan', { races: p.banRaces }) : '',
    });
  if (p.percent !== null && p.percent !== undefined)
    return t('hub.penaltyPrelim', { ...base, percent: p.percent });
  return t('hub.penaltyFinal', { ...base, places: p.places ?? 0 });
}

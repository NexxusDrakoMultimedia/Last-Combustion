// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { IntlMessageFormat } from 'intl-messageformat';
import en from '../../locales/en.json';

/** All player-facing text lives in locales/en.json. Never write text in components. */
export type MessageKey = keyof typeof en;
export type MessageValues = Record<string, string | number | boolean | Date | null | undefined>;

type Catalogue = Record<string, string>;

const catalogues: Record<string, Catalogue> = { en };
/** Text language to number/date format locale. English text is formatted the Australian way. */
const FORMAT_LOCALES: Record<string, string> = { en: 'en-AU' };
const formatLocale = (): string => FORMAT_LOCALES[locale] ?? locale;

let locale = 'en';
const cache = new Map<string, IntlMessageFormat>();

export function setLocale(next: string): void {
  if (!catalogues[next]) throw new Error(`Unknown locale "${next}"`);
  locale = next;
}

export function getLocale(): string {
  return locale;
}

/** Looks up a message and fills in its values (ICU MessageFormat: plurals, numbers, dates). */
export function t(key: MessageKey, values?: MessageValues): string {
  const text = catalogues[locale]?.[key] ?? catalogues['en']?.[key];
  if (text === undefined) throw new Error(`Missing text for key "${key}"`);
  const cacheKey = `${locale}|${key}`;
  let format = cache.get(cacheKey);
  if (!format) {
    format = new IntlMessageFormat(text, formatLocale());
    cache.set(cacheKey, format);
  }
  return String(format.format(values));
}

/** Whether a message exists for a key that is only known at run time. */
export function hasText(key: string): key is MessageKey {
  return (catalogues[locale] ?? catalogues['en'])?.[key] !== undefined;
}

/** Formats a date in the current locale. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(formatLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

/**
 * Formats a time in milliseconds as minutes, seconds and thousandths (`58:27.123`), or with hours
 * once it passes an hour (`4:42:46.780`), since a final can take that long.
 */
export function formatLapTime(ms: number): string {
  const total = Math.round(ms);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = (total % 60_000) / 1000;
  const secs = seconds.toFixed(3).padStart(6, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/**
 * Formats a gap to the leader in milliseconds, such as `+1.234` seconds, or `+1:08.159` once it is
 * over a minute.
 */
export function formatGap(ms: number): string {
  return `+${ms >= 60_000 ? formatLapTime(ms) : (ms / 1000).toFixed(3)}`;
}

/** Formats an amount in Australian dollars. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(formatLocale(), {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

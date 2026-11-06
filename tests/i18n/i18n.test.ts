// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatGap,
  formatLapTime,
  formatMoney,
  formatPoints,
  hasText,
  t,
  type MessageKey,
} from '../../src/i18n';

describe('i18n', () => {
  it('has no key twice in the text file (a later one would silently win)', () => {
    const raw = readFileSync('locales/en.json', 'utf8');
    const keys = [...raw.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
    const seen = new Set<string>();
    const twice = keys.filter((k) => (seen.has(k!) ? true : (seen.add(k!), false)));
    expect(twice).toEqual([]);
  });

  it('looks up text', () => {
    expect(t('app.title')).toBe('Last Combustion');
  });

  it('fills in values and handles plurals', () => {
    expect(t('debug.slots', { count: 0 })).toBe('No save slots in use');
    expect(t('debug.slots', { count: 1 })).toBe('1 save slot in use');
    expect(t('debug.slots', { count: 3 })).toBe('3 save slots in use');
    expect(t('debug.schema', { version: 7 })).toBe('Database schema version: 7');
  });

  it('throws for a missing key instead of showing nothing', () => {
    expect(() => t('does.not.exist' as MessageKey)).toThrow(/Missing text/);
  });

  it('formats dates and money for Australia', () => {
    expect(formatDate('2031-03-31')).toBe('31 March 2031');
    expect(formatMoney(1500000)).toMatch(/1,500,000/);
    expect(formatPoints(145)).toBe('145.0');
    expect(formatPoints(98.5)).toBe('98.5');
    expect(formatPoints(0)).toBe('0.0');
  });

  it('formats lap times', () => {
    expect(formatLapTime(3_507_123)).toBe('58:27.123');
    expect(formatLapTime(65_040)).toBe('1:05.040');
    // Past an hour the time shows hours (a final can take almost five).
    expect(formatLapTime(16_966_780)).toBe('4:42:46.780');
    expect(formatLapTime(3_600_000)).toBe('1:00:00.000');
    expect(formatLapTime(3_599_999)).toBe('59:59.999');
    expect(formatGap(1234)).toBe('+1.234');
    expect(formatGap(68_159)).toBe('+1:08.159');
  });

  it('has no empty messages', () => {
    const catalogue = JSON.parse(readFileSync('locales/en.json', 'utf8')) as Record<string, string>;
    for (const [key, value] of Object.entries(catalogue)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('knows whether a key built at run time has text', () => {
    expect(hasText('money.cash')).toBe(true);
    expect(hasText('money.category.nonsense')).toBe(false);
  });
});

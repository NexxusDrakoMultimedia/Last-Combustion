// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatDate, formatLapTime, formatMoney, t, type MessageKey } from '../../src/i18n';

describe('i18n', () => {
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
  });

  it('formats lap times', () => {
    expect(formatLapTime(3_507_123)).toBe('58:27.123');
    expect(formatLapTime(65_040)).toBe('1:05.040');
  });

  it('has no empty messages', () => {
    const catalogue = JSON.parse(readFileSync('locales/en.json', 'utf8')) as Record<string, string>;
    for (const [key, value] of Object.entries(catalogue)) {
      expect(value.trim(), key).not.toBe('');
    }
  });
});

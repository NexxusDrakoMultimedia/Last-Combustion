// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { googleTagSnippet } from '../scripts/analytics';

describe('the Google tag', () => {
  it('is added for a valid measurement ID', () => {
    const snippet = googleTagSnippet('G-TEST1234AB');
    expect(snippet).toContain('https://www.googletagmanager.com/gtag/js?id=G-TEST1234AB');
    expect(snippet).toContain("gtag('config', 'G-TEST1234AB')");
  });

  it('is left out when there is no ID or the ID is not a measurement ID', () => {
    expect(googleTagSnippet(undefined)).toBe('');
    expect(googleTagSnippet('')).toBe('');
    expect(googleTagSnippet('G-1')).toBe('');
    expect(googleTagSnippet('"><script>alert(1)</script>')).toBe('');
  });
});

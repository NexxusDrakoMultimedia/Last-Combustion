// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { isTouchOnly } from '../../src/ui/mobile';

/** A browser whose media queries answer from a list of those that match. */
const browser = (...matching: string[]) => ({
  matchMedia: (query: string) => ({ matches: matching.includes(query) }),
});
const TOUCH_ONLY = '(pointer: coarse) and (hover: none)';

describe('the mobile notice', () => {
  it('shows on a touch-only device such as a phone or a tablet', () => {
    expect(isTouchOnly(browser(TOUCH_ONLY))).toBe(true);
  });

  it('does not show on a computer, including an upright monitor or a laptop with a touch screen', () => {
    // A mouse is the main pointer, so the touch-only query does not match whatever the screen shape.
    expect(isTouchOnly(browser())).toBe(false);
  });

  it('does not show when the browser cannot tell', () => {
    expect(isTouchOnly({})).toBe(false);
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { luminance, readableOn } from '../../src/sim/colour';

describe('colour', () => {
  it('measures luminance from black to white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#ff0000')).toBeLessThan(luminance('#00ff00'));
  });

  it('picks white digits on dark plates and black digits on light ones', () => {
    expect(readableOn('#7f0000')).toBe('#ffffff');
    expect(readableOn('#112233')).toBe('#ffffff');
    expect(readableOn('#ffd900')).toBe('#000000');
    expect(readableOn('#f1f3f5')).toBe('#000000');
  });

  it('treats a colour it cannot read as light', () => {
    expect(readableOn('blue')).toBe('#000000');
  });
});

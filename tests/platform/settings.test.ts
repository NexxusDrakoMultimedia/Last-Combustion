// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, saveSetting } from '../../src/platform/settings';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('the saved settings', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('start at the defaults: nothing stops and races are not watched', () => {
    expect(loadSettings()).toEqual(defaultSettings);
    expect(defaultSettings).toEqual({ stopEveryDay: false, watchRaces: false });
  });

  it('keep a change for next time, and each setting on its own', () => {
    saveSetting('watchRaces', true);
    expect(loadSettings()).toEqual({ stopEveryDay: false, watchRaces: true });
    saveSetting('stopEveryDay', true);
    expect(loadSettings()).toEqual({ stopEveryDay: true, watchRaces: true });
  });

  it('ignore a damaged or wrong-typed save and fall back to the defaults', () => {
    localStorage.setItem('lc.settings', '{not json');
    expect(loadSettings()).toEqual(defaultSettings);
    localStorage.setItem('lc.settings', JSON.stringify({ watchRaces: 'yes', stopEveryDay: 1 }));
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it('carry on with the defaults when the browser refuses storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadSettings()).toEqual(defaultSettings);
    expect(() => saveSetting('watchRaces', true)).not.toThrow();
  });
});

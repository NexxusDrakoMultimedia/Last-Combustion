// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/** The player's own preferences, kept on this device (not in a save, since they belong to the player and not the career). */
export interface Settings {
  /** Continue plays the prelims one day at a time instead of all seven. */
  stopEveryDay: boolean;
  /** Continue opens the Race screen when a race is due, instead of running it without watching. */
  watchRaces: boolean;
}

export const defaultSettings: Settings = { stopEveryDay: false, watchRaces: false };

const KEY = 'lc.settings';

/** The saved preferences, with a default for anything missing. A browser that refuses storage gets the defaults. */
export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return { ...defaultSettings };
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      stopEveryDay:
        typeof saved.stopEveryDay === 'boolean' ? saved.stopEveryDay : defaultSettings.stopEveryDay,
      watchRaces:
        typeof saved.watchRaces === 'boolean' ? saved.watchRaces : defaultSettings.watchRaces,
    };
  } catch {
    return { ...defaultSettings };
  }
}

/** Keeps a preference. A browser that refuses storage keeps it for the session only. */
export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...loadSettings(), [key]: value }));
  } catch {
    // The preference holds for this session through the store.
  }
}

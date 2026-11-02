// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  analyticsId,
  applyConsent,
  loadGoogleTag,
  readConsent,
  saveConsent,
  stopGoogleTag,
  type KeyValueStore,
  type ScriptHost,
  type TagWindow,
} from '../../src/platform/analytics';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function fakePage(cookie = ''): { doc: ScriptHost; win: TagWindow; scripts: { src: string }[] } {
  const scripts: { id: string; async: boolean; src: string }[] = [];
  const doc: ScriptHost = {
    getElementById: (id) => scripts.find((s) => s.id === id),
    createElement: () => ({ id: '', async: false, src: '' }),
    head: { appendChild: (node) => void scripts.push(node as never) },
    cookie,
  };
  return { doc, win: {}, scripts };
}

describe('the analytics ID', () => {
  it('is used only when it looks like a measurement ID', () => {
    expect(analyticsId('G-TEST1234AB')).toBe('G-TEST1234AB');
    expect(analyticsId(undefined)).toBeUndefined();
    expect(analyticsId('')).toBeUndefined();
    expect(analyticsId('G-1')).toBeUndefined();
    expect(analyticsId('"><script>alert(1)</script>')).toBeUndefined();
  });
});

describe('the saved choice', () => {
  it('is read back, and anything else counts as not chosen', () => {
    const store = memoryStore();
    expect(readConsent(store)).toBeUndefined();
    saveConsent('granted', store);
    expect(readConsent(store)).toBe('granted');
    saveConsent('denied', store);
    expect(readConsent(store)).toBe('denied');
    store.data.set('lc.analytics-consent', 'maybe');
    expect(readConsent(store)).toBeUndefined();
  });

  it('survives blocked storage', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readConsent(broken)).toBeUndefined();
    expect(() => saveConsent('granted', broken)).not.toThrow();
    expect(readConsent(undefined)).toBeUndefined();
  });
});

describe('loading and stopping the tag', () => {
  it('adds the Google script once, and only when asked', () => {
    const { doc, win, scripts } = fakePage();
    applyConsent(undefined, 'G-TEST1234AB', doc, win);
    applyConsent('denied', 'G-TEST1234AB', doc, win);
    expect(scripts).toHaveLength(0);
    loadGoogleTag('G-TEST1234AB', doc, win);
    loadGoogleTag('G-TEST1234AB', doc, win);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST1234AB');
    expect(win['ga-disable-G-TEST1234AB']).toBe(false);
    expect((win.dataLayer as unknown[]).length).toBe(2);
  });

  it('does nothing without an ID', () => {
    const { doc, win, scripts } = fakePage();
    applyConsent('granted', undefined, doc, win);
    expect(scripts).toHaveLength(0);
  });

  it('stops sending and clears the Google cookies when the choice is withdrawn', () => {
    const { doc, win } = fakePage('_ga=1; _ga_ABC=2; session=keep');
    const writes: string[] = [];
    Object.defineProperty(doc, 'cookie', {
      get: () => '_ga=1; _ga_ABC=2; session=keep',
      set: (v: string) => void writes.push(v),
    });
    stopGoogleTag('G-TEST1234AB', doc, win);
    expect(win['ga-disable-G-TEST1234AB']).toBe(true);
    expect(writes).toHaveLength(2);
    expect(writes.every((w) => w.startsWith('_ga'))).toBe(true);
  });
});

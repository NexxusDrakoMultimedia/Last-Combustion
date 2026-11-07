// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  betterStackToken,
  loadBetterStack,
  type BetterStackHost,
} from '../../src/platform/betterstack';
import { applyTelemetryConsent } from '../../src/platform/consent';

function fakePage() {
  const scripts: { id: string; async: boolean; crossOrigin: string | null; src: string }[] = [];
  const doc: BetterStackHost = {
    getElementById: (id) => scripts.find((s) => s.id === id),
    createElement: () => ({ id: '', async: false, crossOrigin: null, src: '' }),
    head: { appendChild: (node) => void scripts.push(node as never) },
  };
  const win: Record<string, unknown> = {};
  return { doc, win, scripts };
}

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2';

describe('the Better Stack script', () => {
  it('is only enabled by a well-formed token', () => {
    expect(betterStackToken(undefined)).toBeUndefined();
    expect(betterStackToken('')).toBeUndefined();
    expect(betterStackToken('short')).toBeUndefined();
    expect(betterStackToken('not a token with spaces!!')).toBeUndefined();
    expect(betterStackToken(TOKEN)).toBe(TOKEN);
  });

  it('is loaded as the vendor’s snippet is: a queue, the script, then init for production', () => {
    const { doc, win, scripts } = fakePage();
    loadBetterStack(TOKEN, doc, win);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      id: 'lc-betterstack',
      async: true,
      crossOrigin: 'anonymous',
      src: `https://betterstack.net/b.js?t=${TOKEN}`,
    });
    const queue = win.betterstack as { q: unknown[][]; l: number };
    expect(queue.q).toEqual([['init', { environment: 'production' }]]);
    expect(typeof queue.l).toBe('number');
  });

  it('is loaded once however often it is asked', () => {
    const { doc, win, scripts } = fakePage();
    loadBetterStack(TOKEN, doc, win);
    loadBetterStack(TOKEN, doc, win);
    expect(scripts).toHaveLength(1);
  });
});

describe('the visitor’s choice and Better Stack', () => {
  const ids = { betterStack: TOKEN };

  it('loads nothing before they have chosen, or when they decline', () => {
    for (const choice of [undefined, 'denied'] as const) {
      const { doc, win, scripts } = fakePage();
      applyTelemetryConsent(choice, { build: 'test', doc: doc as never, win: win as never }, ids);
      expect(scripts, String(choice)).toHaveLength(0);
    }
  });

  it('loads it when they accept, and not when this build has no token', () => {
    const a = fakePage();
    applyTelemetryConsent(
      'granted',
      { build: 'test', doc: a.doc as never, win: a.win as never },
      ids,
    );
    expect(a.scripts.map((s) => s.src)).toEqual([`https://betterstack.net/b.js?t=${TOKEN}`]);
    const b = fakePage();
    applyTelemetryConsent(
      'granted',
      { build: 'test', doc: b.doc as never, win: b.win as never },
      {},
    );
    expect(b.scripts).toHaveLength(0);
  });
});

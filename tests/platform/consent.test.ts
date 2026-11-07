// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterEach, describe, expect, it } from 'vitest';
import { createGoogleTagSink, type ScriptHost, type TagWindow } from '../../src/platform/analytics';
import {
  applyTelemetryConsent,
  effectiveConsent,
  telemetryConfigured,
} from '../../src/platform/consent';
import { resetGameAnalytics, type GameAnalyticsSdk } from '../../src/platform/gameanalytics';
import { clearSinks, trackDesign } from '../../src/platform/telemetry';

const KEYS = { gameKey: 'a'.repeat(32), secretKey: 'b'.repeat(40) };

function fakeSdk(): GameAnalyticsSdk & { calls: string[] } {
  const calls: string[] = [];
  const note = (name: string) => () => void calls.push(name);
  return {
    calls,
    setEnabledInfoLog: note('info'),
    configureBuild: note('build'),
    configureAvailableResourceCurrencies: note('currencies'),
    configureAvailableResourceItemTypes: note('itemTypes'),
    initialize: note('initialize'),
    setEnabledEventSubmission: (flag) => void calls.push(`submission:${flag}`),
    addDesignEvent: (id) => void calls.push(`design:${id}`),
    addProgressionEvent: note('progression'),
    addResourceEvent: note('resource'),
    addErrorEvent: note('error'),
  };
}

function fakePage() {
  const scripts: { id: string; src: string }[] = [];
  const doc: ScriptHost = {
    getElementById: (id) => scripts.find((s) => s.id === id),
    createElement: () => ({ id: '', async: false, src: '' }),
    head: { appendChild: (node) => void scripts.push(node as never) },
    cookie: '',
  };
  const win: TagWindow = {};
  return { doc, win, scripts };
}

afterEach(() => {
  clearSinks();
  resetGameAnalytics();
});

describe('opting out', () => {
  it('is the default: a visitor who has not chosen is counted until they opt out', () => {
    expect(effectiveConsent(undefined)).toBe('granted');
    expect(effectiveConsent('granted')).toBe('granted');
    expect(effectiveConsent('denied')).toBe('denied');
  });

  it('starts the tools on a first visit, and an opt-out is kept for the next visit', async () => {
    const sdk = fakeSdk();
    const first = fakePage();
    applyTelemetryConsent(
      effectiveConsent(undefined),
      { build: 'web', load: async () => sdk, ...first },
      { google: 'G-TEST1234', gameAnalytics: KEYS },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(first.scripts).toHaveLength(1);
    expect(sdk.calls).toContain('initialize');
    // They opt out; the saved choice is what the next visit applies, so nothing starts.
    clearSinks();
    resetGameAnalytics();
    const later = fakePage();
    const sdk2 = fakeSdk();
    applyTelemetryConsent(
      effectiveConsent('denied'),
      { build: 'web', load: async () => sdk2, ...later },
      { google: 'G-TEST1234', gameAnalytics: KEYS },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(later.scripts).toHaveLength(0);
    expect(sdk2.calls).not.toContain('initialize');
  });
});

describe('the visitor’s choice', () => {
  it('applies nothing for no choice at all (the default comes from effectiveConsent)', async () => {
    const sdk = fakeSdk();
    const page = fakePage();
    applyTelemetryConsent(
      undefined,
      { build: 'web', load: async () => sdk, ...page },
      {
        google: 'G-TEST1234',
        gameAnalytics: KEYS,
      },
    );
    trackDesign(undefined, 'Panel', 'Open', 'Money');
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls).toEqual([]);
    expect(page.scripts).toEqual([]);
  });

  it('on accept, starts GameAnalytics first and the Google tag too, and both get the events', async () => {
    const sdk = fakeSdk();
    const page = fakePage();
    applyTelemetryConsent(
      'granted',
      { build: 'web 1', load: async () => sdk, ...page },
      {
        google: 'G-TEST1234',
        gameAnalytics: KEYS,
      },
    );
    const sent: unknown[][] = [];
    page.win.gtag = (...args: unknown[]) => void sent.push(args);
    trackDesign(5, 'Panel', 'Open', 'Money');
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls).toContain('initialize');
    expect(sdk.calls).toContain('design:Panel:Open:Money');
    expect(page.scripts).toHaveLength(1);
    expect(sent).toContainEqual(['event', 'lc_design', { event_id: 'Panel:Open:Money', value: 5 }]);
  });

  it('on decline, stops both and sends nothing more', async () => {
    const sdk = fakeSdk();
    const page = fakePage();
    const ids = { google: 'G-TEST1234', gameAnalytics: KEYS };
    applyTelemetryConsent('granted', { build: 'web', load: async () => sdk, ...page }, ids);
    await new Promise((r) => setTimeout(r, 0));
    applyTelemetryConsent('denied', { build: 'web', load: async () => sdk, ...page }, ids);
    await new Promise((r) => setTimeout(r, 0));
    const before = sdk.calls.length;
    trackDesign(undefined, 'After', 'Decline');
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls).toHaveLength(before);
    expect(sdk.calls).toContain('submission:false');
    expect(page.win['ga-disable-G-TEST1234']).toBe(true);
  });

  it('works with only one tool configured', async () => {
    const sdk = fakeSdk();
    applyTelemetryConsent(
      'granted',
      { build: 'web', load: async () => sdk },
      {
        google: undefined,
        gameAnalytics: KEYS,
      },
    );
    trackDesign(undefined, 'Only', 'Primary');
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls).toContain('design:Only:Primary');
    const page = fakePage();
    clearSinks();
    applyTelemetryConsent(
      'granted',
      { build: 'web', ...page },
      {
        google: 'G-TEST1234',
        gameAnalytics: undefined,
      },
    );
    expect(page.scripts).toHaveLength(1);
  });

  it('asks only when the build has some telemetry, and there is none in a test build', () => {
    expect(telemetryConfigured()).toBe(false);
  });
});

describe('the Google tag sink', () => {
  it('uses four event names with the details as parameters', () => {
    const sent: unknown[][] = [];
    const win: TagWindow = { gtag: (...args: unknown[]) => void sent.push(args) };
    const sink = createGoogleTagSink(win);
    sink.send({ kind: 'design', id: 'A:B' });
    sink.send({ kind: 'progression', status: 'Start', path: ['Season', 'Y2031'], score: 3 });
    sink.send({ kind: 'resource', flow: 'Sink', itemType: 'Travel', amount: 1500 });
    sink.send({ kind: 'error', severity: 'Error', message: 'boom' });
    expect(sent.map((s) => s[1])).toEqual([
      'lc_design',
      'lc_progression',
      'lc_resource',
      'lc_error',
    ]);
    expect(sent[1]).toEqual([
      'event',
      'lc_progression',
      { status: 'Start', path: 'Season:Y2031', value: 3 },
    ]);
    expect(sent[2]).toEqual([
      'event',
      'lc_resource',
      { flow: 'Sink', item_type: 'Travel', value: 1500, currency: 'AUD' },
    ]);
  });

  it('does nothing when the tag is not loaded', () => {
    expect(() => createGoogleTagSink({}).send({ kind: 'design', id: 'X' })).not.toThrow();
  });
});

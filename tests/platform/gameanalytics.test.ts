// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGameAnalyticsSink,
  gameAnalyticsKeys,
  resetGameAnalytics,
  startGameAnalytics,
  stopGameAnalytics,
  type GameAnalyticsSdk,
} from '../../src/platform/gameanalytics';
import { RESOURCE_ITEM_TYPES } from '../../src/platform/telemetry';

// Made-up keys in the right shapes: the real ones are build secrets and are never written down here.
const KEY = 'a'.repeat(32);
const SECRET = 'b'.repeat(40);

function fakeSdk(): GameAnalyticsSdk & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  return {
    calls,
    setEnabledInfoLog: record('setEnabledInfoLog'),
    configureBuild: record('configureBuild'),
    configureAvailableResourceCurrencies: record('configureAvailableResourceCurrencies'),
    configureAvailableResourceItemTypes: record('configureAvailableResourceItemTypes'),
    initialize: record('initialize'),
    setEnabledEventSubmission: record('setEnabledEventSubmission'),
    addDesignEvent: record('addDesignEvent'),
    addProgressionEvent: record('addProgressionEvent'),
    addResourceEvent: record('addResourceEvent'),
    addErrorEvent: record('addErrorEvent'),
  };
}

afterEach(() => resetGameAnalytics());

describe('the GameAnalytics keys', () => {
  it('are used only when both look like a game key and a secret key', () => {
    expect(gameAnalyticsKeys(KEY, SECRET)).toEqual({ gameKey: KEY, secretKey: SECRET });
    expect(gameAnalyticsKeys(undefined, SECRET)).toBeUndefined();
    expect(gameAnalyticsKeys(KEY, undefined)).toBeUndefined();
    expect(gameAnalyticsKeys('', '')).toBeUndefined();
    expect(gameAnalyticsKeys('not a key', SECRET)).toBeUndefined();
    expect(gameAnalyticsKeys(KEY, 'short')).toBeUndefined();
    expect(gameAnalyticsKeys(1, 2)).toBeUndefined();
  });

  it('are not set in a test build, so nothing runs', () => {
    expect(gameAnalyticsKeys()).toBeUndefined();
  });
});

describe('the GameAnalytics sink', () => {
  it('sends design events with and without a value', () => {
    const sdk = fakeSdk();
    const sink = createGameAnalyticsSink(sdk);
    sink.send({ kind: 'design', id: 'Panel:Open:Money' });
    sink.send({ kind: 'design', id: 'Driver:Offer:accepted', value: 120000 });
    expect(sdk.calls).toEqual([
      ['addDesignEvent', 'Panel:Open:Money'],
      ['addDesignEvent', 'Driver:Offer:accepted', 120000],
    ]);
  });

  it('sends progression events with their parts in order, and fills them in when there is a score', () => {
    const sdk = fakeSdk();
    const sink = createGameAnalyticsSink(sdk);
    sink.send({ kind: 'progression', status: 'Start', path: ['Career'] });
    sink.send({ kind: 'progression', status: 'Complete', path: ['Season', 'Y2031'] });
    sink.send({ kind: 'progression', status: 'Fail', path: ['Season', 'Y2031', 'R3'] });
    sink.send({ kind: 'progression', status: 'Complete', path: ['Season'], score: 7 });
    expect(sdk.calls).toEqual([
      ['addProgressionEvent', 1, 'Career'],
      ['addProgressionEvent', 2, 'Season', 'Y2031'],
      ['addProgressionEvent', 3, 'Season', 'Y2031', 'R3'],
      ['addProgressionEvent', 2, 'Season', 'Season', 'Season', 7],
    ]);
  });

  it('sends money as sources and sinks of dollars, and skips an empty amount', () => {
    const sdk = fakeSdk();
    const sink = createGameAnalyticsSink(sdk);
    sink.send({ kind: 'resource', flow: 'Source', itemType: 'Prize', amount: 5000 });
    sink.send({ kind: 'resource', flow: 'Sink', itemType: 'Travel', amount: 1500 });
    sink.send({ kind: 'resource', flow: 'Sink', itemType: 'Travel', amount: 0 });
    expect(sdk.calls).toEqual([
      ['addResourceEvent', 1, 'Dollars', 5000, 'Prize', 'Prize'],
      ['addResourceEvent', 2, 'Dollars', 1500, 'Travel', 'Travel'],
    ]);
  });

  it('sends errors with a severity', () => {
    const sdk = fakeSdk();
    createGameAnalyticsSink(sdk).send({ kind: 'error', severity: 'Critical', message: 'boom' });
    expect(sdk.calls).toEqual([['addErrorEvent', 5, 'boom']]);
  });
});

describe('starting GameAnalytics', () => {
  it('configures the build and the allowed money values, then initialises with the keys', async () => {
    const sdk = fakeSdk();
    startGameAnalytics({ gameKey: KEY, secretKey: SECRET }, 'web 1.2.3', async () => sdk);
    await Promise.resolve();
    await Promise.resolve();
    expect(sdk.calls.map((c) => c[0])).toEqual([
      'configureBuild',
      'configureAvailableResourceCurrencies',
      'configureAvailableResourceItemTypes',
      'initialize',
    ]);
    expect(sdk.calls[0]).toEqual(['configureBuild', 'web 1.2.3']);
    expect(sdk.calls[1]).toEqual(['configureAvailableResourceCurrencies', ['Dollars']]);
    expect(sdk.calls[2]).toEqual(['configureAvailableResourceItemTypes', RESOURCE_ITEM_TYPES]);
    expect(sdk.calls[3]).toEqual(['initialize', KEY, SECRET]);
  });

  it('holds events sent before the SDK has loaded and sends them in order afterwards', async () => {
    const sdk = fakeSdk();
    let release: (s: GameAnalyticsSdk) => void = () => undefined;
    const sink = startGameAnalytics(
      { gameKey: KEY, secretKey: SECRET },
      'web',
      () => new Promise((resolve) => (release = resolve)),
    );
    sink.send({ kind: 'design', id: 'First' });
    sink.send({ kind: 'design', id: 'Second' });
    expect(sdk.calls).toEqual([]);
    release(sdk);
    await new Promise((r) => setTimeout(r, 0));
    const names = sdk.calls.filter((c) => c[0] === 'addDesignEvent').map((c) => c[1]);
    expect(names).toEqual(['First', 'Second']);
    expect(sdk.calls.findIndex((c) => c[0] === 'initialize')).toBeLessThan(
      sdk.calls.findIndex((c) => c[0] === 'addDesignEvent'),
    );
  });

  it('is started once however often it is asked, and can be stopped and resumed', async () => {
    const sdk = fakeSdk();
    let loads = 0;
    const load = async () => {
      loads += 1;
      return sdk;
    };
    const a = startGameAnalytics({ gameKey: KEY, secretKey: SECRET }, 'web', load);
    const b = startGameAnalytics({ gameKey: KEY, secretKey: SECRET }, 'web', load);
    expect(a).toBe(b);
    expect(loads).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    stopGameAnalytics();
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls.at(-1)).toEqual(['setEnabledEventSubmission', false]);
    startGameAnalytics({ gameKey: KEY, secretKey: SECRET }, 'web', load);
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.calls.at(-1)).toEqual(['setEnabledEventSubmission', true]);
    expect(sdk.calls.filter((c) => c[0] === 'initialize')).toHaveLength(1);
  });

  it('never throws into the game when the SDK cannot be fetched', async () => {
    const sink = startGameAnalytics({ gameKey: KEY, secretKey: SECRET }, 'web', async () => {
      throw new Error('offline');
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(() => sink.send({ kind: 'design', id: 'X' })).not.toThrow();
    expect(() => stopGameAnalytics()).not.toThrow();
  });
});

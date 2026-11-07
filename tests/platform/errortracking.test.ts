// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterEach, describe, expect, it } from 'vitest';
import { applyTelemetryConsent } from '../../src/platform/consent';
import {
  errorTrackingDsn,
  reportError,
  resetErrorTracking,
  scrubEvent,
  startErrorTracking,
  stopErrorTracking,
  type SentrySdk,
} from '../../src/platform/errortracking';
import { clearSinks } from '../../src/platform/telemetry';

const DSN = 'https://AbC123dEf456@s1234567.us-west-2a.betterstackdata.com/1234567';

function fakeSdk(): SentrySdk & {
  inits: Record<string, unknown>[];
  closed: number;
  errors: unknown[];
} {
  const sdk = {
    inits: [] as Record<string, unknown>[],
    closed: 0,
    errors: [] as unknown[],
    init(options: Record<string, unknown>) {
      sdk.inits.push(options);
    },
    async close() {
      sdk.closed++;
      return true;
    },
    captureException(error: unknown) {
      sdk.errors.push(error);
    },
  };
  return sdk;
}

afterEach(() => {
  resetErrorTracking();
  clearSinks();
});

describe('error tracking on Better Stack', () => {
  it('is only enabled by a well-formed DSN', () => {
    expect(errorTrackingDsn(undefined)).toBeUndefined();
    expect(errorTrackingDsn('')).toBeUndefined();
    expect(errorTrackingDsn('http://key@host/1')).toBeUndefined();
    expect(errorTrackingDsn('https://host/1')).toBeUndefined();
    expect(errorTrackingDsn(DSN)).toBe(DSN);
  });

  it('starts the SDK once, for production, with the game’s version, and nothing but errors', async () => {
    const sdk = fakeSdk();
    await startErrorTracking(DSN, 'web 0.2.0', async () => sdk);
    await startErrorTracking(DSN, 'web 0.2.0', async () => sdk);
    expect(sdk.inits).toHaveLength(1);
    const options = sdk.inits[0]!;
    expect(options).toMatchObject({
      dsn: DSN,
      release: 'web 0.2.0',
      environment: 'production',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
    });
    expect((options.beforeBreadcrumb as () => unknown)()).toBeNull();
  });

  it('keeps the visitor and their page out of an event', () => {
    const event = scrubEvent({
      message: 'boom',
      user: { id: 'x' },
      request: { url: 'https://example.test/?save=1' },
      breadcrumbs: [{ message: 'click' }],
    });
    expect(event).toEqual({ message: 'boom' });
  });

  it('reports a caught error only while it is running, and closes when stopped', async () => {
    const sdk = fakeSdk();
    reportError(new Error('before'));
    await startErrorTracking(DSN, 'build', async () => sdk);
    reportError(new Error('during'));
    stopErrorTracking();
    reportError(new Error('after'));
    expect(sdk.errors).toHaveLength(1);
    expect(sdk.closed).toBe(1);
  });

  it('leaves error tracking off when the SDK cannot be fetched', async () => {
    await startErrorTracking(DSN, 'build', async () => {
      throw new Error('offline');
    });
    expect(() => reportError(new Error('x'))).not.toThrow();
  });
});

describe('the visitor’s choice and error tracking', () => {
  const ids = { errorTracking: DSN };

  it('starts nothing before they choose or when they decline, and starts it when they accept', async () => {
    const sdk = fakeSdk();
    const options = { build: 'test', loadErrorTracking: async () => sdk };
    applyTelemetryConsent(undefined, options, ids);
    applyTelemetryConsent('denied', options, ids);
    await Promise.resolve();
    expect(sdk.inits).toHaveLength(0);
    applyTelemetryConsent('granted', options, ids);
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.inits).toHaveLength(1);
    // Declining afterwards closes it.
    applyTelemetryConsent('denied', options, ids);
    expect(sdk.closed).toBe(1);
  });

  it('does nothing when this build has no DSN', async () => {
    const sdk = fakeSdk();
    applyTelemetryConsent('granted', { build: 'test', loadErrorTracking: async () => sdk }, {});
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.inits).toHaveLength(0);
  });
});

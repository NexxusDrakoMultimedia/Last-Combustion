// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * Error tracking on Better Stack, through the Sentry SDK for React, used only on the hosted web build.
 * The DSN is given at build time as `VITE_SENTRY_DSN`; without it nothing here does anything. Like the
 * other telemetry tools, the SDK is only fetched (as a chunk of its own) and started unless the
 * visitor has opted out. It reports uncaught errors and unhandled promise rejections and nothing
 * else: no performance traces, no breadcrumbs (so no record of what was clicked or logged), no request
 * details, and no user.
 */

const DSN = /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+$/;

/** The parts of the SDK the game calls. */
export interface SentrySdk {
  init(options: Record<string, unknown>): unknown;
  close(timeout?: number): Promise<boolean>;
  captureException(error: unknown): unknown;
}

/** The DSN for this build, or undefined when error tracking is not enabled. */
export function errorTrackingDsn(
  raw: unknown = import.meta.env.VITE_SENTRY_DSN,
): string | undefined {
  return typeof raw === 'string' && DSN.test(raw) ? raw : undefined;
}

/** What is left of an event once nothing about the visitor or their page is in it. */
export function scrubEvent<T extends { user?: unknown; request?: unknown; breadcrumbs?: unknown }>(
  event: T,
): T {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  return event;
}

let sdk: SentrySdk | undefined;

/**
 * Fetches the SDK and starts it for the production environment, with the game's version as the
 * release. Safe to call more than once. A failure to fetch it (offline, blocked) just leaves error
 * tracking off.
 */
export async function startErrorTracking(
  dsn: string,
  build: string,
  load: () => Promise<SentrySdk> = () => import('@sentry/react') as unknown as Promise<SentrySdk>,
): Promise<void> {
  if (sdk) return;
  try {
    const loaded = await load();
    loaded.init({
      dsn,
      release: build,
      environment: 'production',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSend: scrubEvent,
    });
    sdk = loaded;
  } catch {
    sdk = undefined;
  }
}

/** Stops reporting. The SDK is closed, so nothing queued is sent after the visitor declines. */
export function stopErrorTracking(): void {
  const running = sdk;
  sdk = undefined;
  void running?.close(0);
}

/** Reports an error the game caught itself, if error tracking is running. */
export function reportError(error: unknown): void {
  sdk?.captureException(error);
}

/** Forgets the running SDK (for tests). */
export function resetErrorTracking(): void {
  sdk = undefined;
}

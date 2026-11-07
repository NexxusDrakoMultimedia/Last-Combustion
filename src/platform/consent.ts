// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import {
  analyticsId,
  applyConsent,
  createGoogleTagSink,
  type Consent,
  type ScriptHost,
  type TagWindow,
} from './analytics';
import {
  gameAnalyticsKeys,
  startGameAnalytics,
  stopGameAnalytics,
  type GameAnalyticsSdk,
} from './gameanalytics';
import { betterStackToken, loadBetterStack, type BetterStackHost } from './betterstack';
import {
  errorTrackingDsn,
  startErrorTracking,
  stopErrorTracking,
  type SentrySdk,
} from './errortracking';
import { addSink, clearSinks } from './telemetry';

/** Whether this build has any telemetry at all (so whether to ask the visitor). */
export function telemetryConfigured(): boolean {
  return (
    analyticsId() !== undefined ||
    gameAnalyticsKeys() !== undefined ||
    betterStackToken() !== undefined ||
    errorTrackingDsn() !== undefined
  );
}

/**
 * The choice that applies: the visitor's own, or, when they have not made one, **granted**. Telemetry is
 * opt-out: it runs from the first visit, with a notice and a button to opt out at once, and an opt-out
 * is kept and respected from then on.
 */
export function effectiveConsent(saved: Consent | undefined): Consent {
  return saved ?? 'granted';
}

export interface TelemetryOptions {
  /** The game's version, sent to GameAnalytics as the build. */
  build: string;
  /** Fetches the GameAnalytics SDK (a test supplies a fake one). */
  load?: () => Promise<GameAnalyticsSdk>;
  /** Fetches the error tracking SDK (a test supplies a fake one). */
  loadErrorTracking?: () => Promise<SentrySdk>;
  doc?: ScriptHost;
  win?: TagWindow;
}

/**
 * Applies the visitor's choice to every telemetry tool. On `granted`, GameAnalytics (primary) and
 * the Google tag (secondary) start and receive the game's events; on `denied` both stop and the
 * game stops sending events. This function does what it is told; the choice a visitor who has not
 * chosen is given is `effectiveConsent`.
 */
export function applyTelemetryConsent(
  value: Consent | undefined,
  options: TelemetryOptions,
  ids: {
    google?: string | undefined;
    gameAnalytics?: ReturnType<typeof gameAnalyticsKeys>;
    betterStack?: string | undefined;
    errorTracking?: string | undefined;
  } = {
    google: analyticsId(),
    gameAnalytics: gameAnalyticsKeys(),
    betterStack: betterStackToken(),
    errorTracking: errorTrackingDsn(),
  },
): void {
  applyConsent(value, ids.google, options.doc, options.win);
  if (value === 'granted' && ids.errorTracking)
    void startErrorTracking(ids.errorTracking, options.build, options.loadErrorTracking);
  if (value === 'denied') stopErrorTracking();
  if (value === 'granted' && ids.betterStack)
    loadBetterStack(
      ids.betterStack,
      options.doc as unknown as BetterStackHost | undefined,
      options.win,
    );
  if (value === 'granted') {
    clearSinks();
    if (ids.gameAnalytics)
      addSink(startGameAnalytics(ids.gameAnalytics, options.build, options.load));
    if (ids.google) addSink(createGoogleTagSink(options.win));
  } else {
    clearSinks();
    if (value === 'denied') stopGameAnalytics();
  }
}

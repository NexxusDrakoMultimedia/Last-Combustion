// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import {
  analyticsId,
  applyConsent,
  choiceFromConsent,
  createGoogleTagSink,
  REJECT_OPTIONAL,
  type Consent,
  type ConsentChoice,
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
 * The choice that applies: the visitor's own, or, when they have not made one, **nothing optional**.
 * Telemetry is opt-in: no tool loads until the visitor accepts it in the cookie settings, and the
 * choice, once made, is kept and respected from then on.
 */
export function effectiveChoice(saved: ConsentChoice | undefined): ConsentChoice {
  return saved ?? REJECT_OPTIONAL;
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
 * Applies the visitor's choice to every telemetry tool, each on its own. A tool that is allowed
 * starts (GameAnalytics and the Google tag also receive the game's events); one that is not allowed
 * stops. A plain `granted` or `denied` means every tool. With no choice at all nothing is changed:
 * what a visitor who has not chosen is given is `effectiveChoice`.
 */
export function applyTelemetryConsent(
  value: Consent | ConsentChoice | undefined,
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
  if (value === undefined) return;
  const choice = typeof value === 'string' ? choiceFromConsent(value) : value;
  applyConsent(choice.google ? 'granted' : 'denied', ids.google, options.doc, options.win);
  if (choice.monitoring) {
    if (ids.errorTracking)
      void startErrorTracking(ids.errorTracking, options.build, options.loadErrorTracking);
    if (ids.betterStack)
      loadBetterStack(
        ids.betterStack,
        options.doc as unknown as BetterStackHost | undefined,
        options.win,
      );
  } else {
    stopErrorTracking();
  }
  clearSinks();
  if (choice.gameAnalytics) {
    if (ids.gameAnalytics)
      addSink(startGameAnalytics(ids.gameAnalytics, options.build, options.load));
  } else {
    stopGameAnalytics();
  }
  if (choice.google && ids.google) addSink(createGoogleTagSink(options.win));
}

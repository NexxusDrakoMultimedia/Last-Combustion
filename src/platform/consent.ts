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
import { addSink, clearSinks } from './telemetry';

/** Whether this build has any telemetry at all (so whether to ask the visitor). */
export function telemetryConfigured(): boolean {
  return (
    analyticsId() !== undefined ||
    gameAnalyticsKeys() !== undefined ||
    betterStackToken() !== undefined
  );
}

export interface TelemetryOptions {
  /** The game's version, sent to GameAnalytics as the build. */
  build: string;
  /** Fetches the GameAnalytics SDK (a test supplies a fake one). */
  load?: () => Promise<GameAnalyticsSdk>;
  doc?: ScriptHost;
  win?: TagWindow;
}

/**
 * Applies the visitor's choice to every telemetry tool. On `granted`, GameAnalytics (primary) and
 * the Google tag (secondary) start and receive the game's events; on `denied` both stop and the
 * game stops sending events. Before the visitor has chosen, nothing runs.
 */
export function applyTelemetryConsent(
  value: Consent | undefined,
  options: TelemetryOptions,
  ids: {
    google?: string | undefined;
    gameAnalytics?: ReturnType<typeof gameAnalyticsKeys>;
    betterStack?: string | undefined;
  } = {
    google: analyticsId(),
    gameAnalytics: gameAnalyticsKeys(),
    betterStack: betterStackToken(),
  },
): void {
  applyConsent(value, ids.google, options.doc, options.win);
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

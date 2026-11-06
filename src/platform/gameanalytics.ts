// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { RESOURCE_CURRENCY, RESOURCE_ITEM_TYPES, type TelemetryEvent } from './telemetry';
import type { TelemetrySink } from './telemetry';

/**
 * GameAnalytics (the primary telemetry tool) through its open-source JavaScript SDK. The game
 * and secret keys are given at build time as `VITE_GA_GAME_KEY` and `VITE_GA_SECRET_KEY`; without
 * both nothing here does anything. The SDK is only fetched, and the keys only used, after the
 * visitor accepts.
 */

export interface GameAnalyticsKeys {
  gameKey: string;
  secretKey: string;
}

const KEY = /^[0-9a-f]{32}$/;
const SECRET = /^[0-9a-f]{40}$/;

/** The keys for this build, or undefined when GameAnalytics is not enabled. */
export function gameAnalyticsKeys(
  gameKey: unknown = import.meta.env.VITE_GA_GAME_KEY,
  secretKey: unknown = import.meta.env.VITE_GA_SECRET_KEY,
): GameAnalyticsKeys | undefined {
  return typeof gameKey === 'string' &&
    typeof secretKey === 'string' &&
    KEY.test(gameKey) &&
    SECRET.test(secretKey)
    ? { gameKey, secretKey }
    : undefined;
}

/** The parts of the SDK that the game calls (its enums are numbers: see the SDK's `GameAnalytics.d.ts`). */
export interface GameAnalyticsSdk {
  setEnabledInfoLog(flag: boolean): void;
  configureBuild(build: string): void;
  configureAvailableResourceCurrencies(list: string[]): void;
  configureAvailableResourceItemTypes(list: string[]): void;
  initialize(gameKey: string, secretKey: string): void;
  setEnabledEventSubmission(flag: boolean): void;
  addDesignEvent(id: string, value?: number): void;
  addProgressionEvent(status: number, p1: string, p2?: string, p3?: string, score?: number): void;
  addResourceEvent(
    flow: number,
    currency: string,
    amount: number,
    itemType: string,
    itemId: string,
  ): void;
  addErrorEvent(severity: number, message: string): void;
}

const PROGRESSION = { Start: 1, Complete: 2, Fail: 3 } as const;
const FLOW = { Source: 1, Sink: 2 } as const;
const SEVERITY = { Debug: 1, Info: 2, Warning: 3, Error: 4, Critical: 5 } as const;

/** Turns the game's events into SDK calls. */
export function createGameAnalyticsSink(sdk: GameAnalyticsSdk): TelemetrySink {
  return {
    send(event: TelemetryEvent) {
      switch (event.kind) {
        case 'design':
          if (event.value === undefined) sdk.addDesignEvent(event.id);
          else sdk.addDesignEvent(event.id, event.value);
          break;
        case 'progression': {
          const [p1, p2, p3] = event.path;
          if (p1 === undefined) return;
          // Parts must be given in order, and a score needs the parts before it.
          if (event.score !== undefined)
            sdk.addProgressionEvent(
              PROGRESSION[event.status],
              p1,
              p2 ?? p1,
              p3 ?? p2 ?? p1,
              event.score,
            );
          else if (p3 !== undefined) sdk.addProgressionEvent(PROGRESSION[event.status], p1, p2, p3);
          else if (p2 !== undefined) sdk.addProgressionEvent(PROGRESSION[event.status], p1, p2);
          else sdk.addProgressionEvent(PROGRESSION[event.status], p1);
          break;
        }
        case 'resource':
          if (event.amount > 0)
            sdk.addResourceEvent(
              FLOW[event.flow],
              RESOURCE_CURRENCY,
              event.amount,
              event.itemType,
              event.itemType,
            );
          break;
        case 'error':
          sdk.addErrorEvent(SEVERITY[event.severity], event.message);
          break;
      }
    },
  };
}

/** Fetches the SDK. It is a separate chunk, so it is not loaded unless the visitor accepts. */
async function importSdk(): Promise<GameAnalyticsSdk> {
  const module = (await import('gameanalytics')) as unknown as { GameAnalytics: GameAnalyticsSdk };
  return module.GameAnalytics;
}

let loaded: Promise<GameAnalyticsSdk> | undefined;
let sink: TelemetrySink | undefined;

/**
 * Starts GameAnalytics and returns a sink for it. Events sent before the SDK has loaded wait for
 * it, in order. Safe to call more than once.
 */
export function startGameAnalytics(
  keys: GameAnalyticsKeys,
  build: string,
  load: () => Promise<GameAnalyticsSdk> = importSdk,
): TelemetrySink {
  if (sink) {
    void loaded?.then((sdk) => sdk.setEnabledEventSubmission(true));
    return sink;
  }
  loaded = load().then((sdk) => {
    sdk.configureBuild(build);
    sdk.configureAvailableResourceCurrencies([RESOURCE_CURRENCY]);
    sdk.configureAvailableResourceItemTypes(RESOURCE_ITEM_TYPES);
    sdk.initialize(keys.gameKey, keys.secretKey);
    return sdk;
  });
  // If the SDK cannot be fetched (offline, or blocked), telemetry simply does not happen.
  loaded.catch(() => undefined);
  sink = {
    send(event) {
      void loaded?.then((sdk) => createGameAnalyticsSink(sdk).send(event)).catch(() => undefined);
    },
  };
  return sink;
}

/** Stops GameAnalytics from sending anything more. */
export function stopGameAnalytics(): void {
  void loaded?.then((sdk) => sdk.setEnabledEventSubmission(false)).catch(() => undefined);
}

/** Forgets the started SDK (for tests). */
export function resetGameAnalytics(): void {
  loaded = undefined;
  sink = undefined;
}

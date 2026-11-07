// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * Optional, consent-gated telemetry for the hosted web build (see the GDD, "Telemetry"). The game
 * describes what happened as a small, fixed set of events; sinks (GameAnalytics first, the Google
 * tag second) turn them into their own calls. Nothing here sends anything unless a sink has been
 * added, and sinks are added only after the visitor accepts. Events carry categories, counts and
 * amounts, never names, free text or save contents.
 */

export type ProgressionStatus = 'Start' | 'Complete' | 'Fail';
export type ErrorSeverity = 'Debug' | 'Info' | 'Warning' | 'Error' | 'Critical';

export type TelemetryEvent =
  /** Something the player did or saw, as a `:`-separated id of up to five short parts. */
  | { kind: 'design'; id: string; value?: number }
  /** Moving through the game: a career, a season, a round. */
  | {
      kind: 'progression';
      status: ProgressionStatus;
      /** One to three parts, from the widest (career) to the narrowest (round). */
      path: string[];
      score?: number;
    }
  /** Money coming into or going out of the player's garage. */
  | { kind: 'resource'; flow: 'Source' | 'Sink'; itemType: string; amount: number }
  /** Something went wrong in the game. */
  | { kind: 'error'; severity: ErrorSeverity; message: string };

export interface TelemetrySink {
  send(event: TelemetryEvent): void;
}

let sinks: TelemetrySink[] = [];

/** Starts sending events to a sink. */
export function addSink(sink: TelemetrySink): void {
  if (!sinks.includes(sink)) sinks = [...sinks, sink];
}

/** Stops sending events to a sink. */
export function removeSink(sink: TelemetrySink): void {
  sinks = sinks.filter((s) => s !== sink);
}

/** Stops sending events anywhere. */
export function clearSinks(): void {
  sinks = [];
}

/** Sends an event to every sink. A sink that fails never affects the game. */
export function track(event: TelemetryEvent): void {
  for (const sink of sinks) {
    try {
      sink.send(event);
    } catch {
      // Telemetry must never break the game.
    }
  }
}

const SEGMENT = /[^A-Za-z0-9_-]/g;

/**
 * Builds a design event id from its parts: each part is cleaned to letters, digits, `_` and `-`
 * and cut to 32 characters, empty parts are dropped, and at most five are kept.
 */
export function designId(...parts: (string | number)[]): string {
  const clean = parts
    .map((p) => String(p).replace(SEGMENT, '').slice(0, 32))
    .filter((p) => p.length > 0)
    .slice(0, 5);
  return clean.length > 0 ? clean.join(':') : 'Unknown';
}

/** Sends a design event. */
export function trackDesign(value: number | undefined, ...parts: (string | number)[]): void {
  track({ kind: 'design', id: designId(...parts), ...(value === undefined ? {} : { value }) });
}

/** The one currency money is counted in (the game's dollars). */
export const RESOURCE_CURRENCY = 'Dollars';

/** The name of a ledger category as a resource item type: letters only, such as `ChampionshipPrize`. */
export function resourceItemType(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/[^A-Za-z]/g, '');
}

/** Every ledger category the game writes (GameAnalytics wants the item types listed up front, at most 20). */
export const LEDGER_CATEGORIES = [
  'prize',
  'championship_prize',
  'bonuses',
  'sponsor',
  'merchandise',
  'entry_fee',
  'tyres',
  'servicing',
  'travel',
  'repairs',
  'release_fee',
  'gear',
  'training',
  'wages',
  'salaries',
  'facilities',
  'share_issue',
  'dividends',
  'buyback',
  'car_purchase',
  'car_sale',
  'parts',
  'restoration',
  'electricity',
  'water',
  'race_fuel',
  'delivery',
  'relocation',
] as const;

/** Categories reported together as one item type (GameAnalytics allows 20 item types). */
const ITEM_GROUP: Readonly<Record<string, string>> = {
  electricity: 'utilities',
  water: 'utilities',
  race_fuel: 'utilities',
  repairs: 'servicing',
  restoration: 'servicing',
  relocation: 'travel',
  facilities: 'utilities',
  share_issue: 'equity',
  dividends: 'equity',
  buyback: 'equity',
};

const groupOf = (category: string): string => ITEM_GROUP[category] ?? category;

export const RESOURCE_ITEM_TYPES: string[] = [...new Set(LEDGER_CATEGORIES.map(groupOf))].map(
  resourceItemType,
);

/**
 * The money events between two ledger totals (category to total): a category whose total went up
 * is a source, one that went down a sink, each by the whole dollars it moved. Categories that are
 * not in the list are ignored, so the item types stay within what was configured.
 */
export function ledgerDeltas(
  before: Readonly<Record<string, number>>,
  after: Readonly<Record<string, number>>,
): Extract<TelemetryEvent, { kind: 'resource' }>[] {
  const moves = new Map<string, number>();
  for (const category of LEDGER_CATEGORIES) {
    const moved = (after[category] ?? 0) - (before[category] ?? 0);
    moves.set(groupOf(category), (moves.get(groupOf(category)) ?? 0) + moved);
  }
  const out: Extract<TelemetryEvent, { kind: 'resource' }>[] = [];
  for (const [group, total] of moves) {
    const moved = Math.round(total);
    if (moved === 0) continue;
    out.push({
      kind: 'resource',
      flow: moved > 0 ? 'Source' : 'Sink',
      itemType: resourceItemType(group),
      amount: Math.abs(moved),
    });
  }
  return out;
}

/** An error message made safe to send: one line, no digits runs that could be ids, at most 100 characters. */
export function safeMessage(message: string): string {
  return message
    .replace(/\s+/g, ' ')
    .replace(/\d{4,}/g, '#')
    .slice(0, 100);
}

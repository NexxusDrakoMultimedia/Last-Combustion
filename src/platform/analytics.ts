// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * Optional web analytics (the Google tag), used only on the hosted web build. The measurement
 * ID is given at build time as `VITE_GTAG_ID`; without it nothing here does anything. The
 * Google script is loaded only after the visitor accepts, never before.
 */

const CONSENT_KEY = 'lc.analytics-consent';
const SCRIPT_ID = 'lc-google-tag';
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/;

export type Consent = 'granted' | 'denied';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The parts of `document` that loading the tag uses. */
export interface ScriptHost {
  getElementById(id: string): unknown;
  createElement(tag: 'script'): { id: string; async: boolean; src: string };
  head: { appendChild(node: never): unknown };
  cookie: string;
}

/** The parts of `window` that the tag uses. */
export type TagWindow = Record<string, unknown>;

/** The measurement ID for this build, or undefined when analytics is not enabled. */
export function analyticsId(raw: unknown = import.meta.env.VITE_GTAG_ID): string | undefined {
  return typeof raw === 'string' && MEASUREMENT_ID.test(raw) ? raw : undefined;
}

function defaultStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The visitor's saved choice, or undefined if they have not chosen (or storage is blocked). */
export function readConsent(
  store: KeyValueStore | undefined = defaultStore(),
): Consent | undefined {
  try {
    const value = store?.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Saves the visitor's choice. A blocked store just means they are asked again next time. */
export function saveConsent(
  value: Consent,
  store: KeyValueStore | undefined = defaultStore(),
): void {
  try {
    store?.setItem(CONSENT_KEY, value);
  } catch {
    // Storage is blocked: the choice lasts only for this visit.
  }
}

/** Loads the Google tag. Safe to call more than once. */
export function loadGoogleTag(
  id: string,
  doc: ScriptHost = document as unknown as ScriptHost,
  win: TagWindow = window as unknown as TagWindow,
): void {
  win[`ga-disable-${id}`] = false;
  if (doc.getElementById(SCRIPT_ID)) return;
  const layer = (win.dataLayer as unknown[] | undefined) ?? [];
  win.dataLayer = layer;
  win.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    layer.push(arguments);
  };
  const gtag = win.gtag as (...args: unknown[]) => void;
  gtag('js', new Date());
  gtag('config', id);
  const script = doc.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  doc.head.appendChild(script as never);
}

/** Stops the tag from sending anything and removes the cookies it set. */
export function stopGoogleTag(
  id: string,
  doc: ScriptHost = document as unknown as ScriptHost,
  win: TagWindow = window as unknown as TagWindow,
): void {
  win[`ga-disable-${id}`] = true;
  for (const part of doc.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name && (name === '_ga' || name.startsWith('_ga_') || name === '_gid')) {
      doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

/** Applies a choice: loads the tag on `granted`, stops it on `denied`. */
export function applyConsent(
  value: Consent | undefined,
  id: string | undefined,
  doc?: ScriptHost,
  win?: TagWindow,
): void {
  if (!id) return;
  if (value === 'granted') loadGoogleTag(id, doc, win);
  else if (value === 'denied') stopGoogleTag(id, doc, win);
}

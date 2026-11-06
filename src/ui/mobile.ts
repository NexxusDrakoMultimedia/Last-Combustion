// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
/** What the notice needs from the browser, so it can be tested without one. */
export interface MobileEnvironment {
  matchMedia?: (query: string) => { matches: boolean };
}

/**
 * Whether the device is a touch-only one, such as a phone or a tablet: its main pointer is coarse
 * and it cannot hover. A laptop with a touch screen, or a monitor turned upright, still has a mouse
 * and is not counted, because the game works there.
 */
export function isTouchOnly(env: MobileEnvironment = globalThis): boolean {
  return env.matchMedia?.('(pointer: coarse) and (hover: none)').matches === true;
}

const KEY = 'lc-mobile-notice';

/** Whether the visitor has already chosen to carry on without the notice. */
export function noticeDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/** Remembers that the visitor chose to carry on (kept only in this browser). */
export function dismissNotice(): void {
  try {
    globalThis.localStorage?.setItem(KEY, 'dismissed');
  } catch {
    // The choice is simply not remembered.
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { readConsent, saveConsent, type Consent } from '../platform/analytics';
import { applyTelemetryConsent, effectiveConsent, telemetryConfigured } from '../platform/consent';
import { APP_VERSION } from '../db/session';

/**
 * Tells a visitor to the web build how the game counts its use (GameAnalytics, the Google tag, Better
 * Stack and error reports) and lets them opt out. It appears only when the build has a telemetry key.
 * Telemetry is opt-out: it runs from the first visit until the visitor opts out, and an opt-out is
 * kept. The notice stays until the visitor has answered, and the choice can be reopened and changed.
 */
export function ConsentBanner() {
  const configured = telemetryConfigured();
  const [consent, setConsent] = useState<Consent | undefined>(() => readConsent());
  const [open, setOpen] = useState(() => readConsent() === undefined);

  useEffect(() => {
    applyTelemetryConsent(effectiveConsent(consent), { build: `web ${APP_VERSION}` });
  }, [consent]);

  if (!configured) return null;

  const choose = (value: Consent) => {
    saveConsent(value);
    setConsent(value);
    setOpen(false);
  };

  const button =
    'rounded px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400';

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-2 left-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-amber-400"
        onClick={() => setOpen(true)}
      >
        {t('consent.settings')}
      </button>
    );
  }

  return (
    <section
      aria-labelledby="consent-heading"
      className="fixed inset-x-0 bottom-0 border-t border-zinc-600 bg-zinc-900 p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1">
          <h2 id="consent-heading" className="font-semibold">
            {t('consent.title')}
          </h2>
          <p className="text-sm text-zinc-300">{t('consent.body')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${button} bg-red-700 text-white hover:bg-red-600`}
            onClick={() => choose('granted')}
          >
            {t('consent.accept')}
          </button>
          <button
            type="button"
            className={`${button} border border-zinc-500 text-zinc-100 hover:bg-zinc-800`}
            onClick={() => choose('denied')}
          >
            {t('consent.decline')}
          </button>
        </div>
      </div>
    </section>
  );
}

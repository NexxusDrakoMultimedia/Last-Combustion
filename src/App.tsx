// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from './i18n';
import { ConsentBanner } from './ui/ConsentBanner';
import { DebugPanel } from './ui/DebugPanel';

export function App() {
  return (
    <>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t('app.title')}</h1>
          <p className="text-zinc-300">{t('app.tagline')}</p>
          <p className="text-sm text-zinc-400">{t('app.status')}</p>
        </header>
        <DebugPanel />
      </main>
      <ConsentBanner />
    </>
  );
}

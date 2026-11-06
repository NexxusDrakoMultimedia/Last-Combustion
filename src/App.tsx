// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from './i18n';
import { useCareerStore } from './state/career.store';
import { About } from './ui/About';
import { ConsentBanner } from './ui/ConsentBanner';
import { Shell } from './ui/shell/Shell';
import { NewCareer } from './ui/NewCareer';

export function App() {
  const hasHub = useCareerStore((s) => s.hub !== undefined);
  return (
    <>
      {hasHub ? (
        <Shell />
      ) : (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
          <header className="space-y-1">
            <h1 className="lc-display text-3xl">{t('app.title')}</h1>
            <p className="text-lc-dim">{t('app.tagline')}</p>
          </header>
          <NewCareer />
          <details className="border border-lc-line bg-lc-panel p-3">
            <summary className="lc-display cursor-pointer text-sm">{t('about.title')}</summary>
            <div className="pt-3">
              <About />
            </div>
          </details>
        </main>
      )}
      <ConsentBanner />
    </>
  );
}

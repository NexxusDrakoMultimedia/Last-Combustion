// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from './i18n';
import { useCareerStore } from './state/career.store';
import { ConsentBanner } from './ui/ConsentBanner';
import { Hub } from './ui/Hub';
import { NewCareer } from './ui/NewCareer';

export function App() {
  const hasHub = useCareerStore((s) => s.hub !== undefined);
  return (
    <>
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t('app.title')}</h1>
          <p className="text-zinc-300">{t('app.tagline')}</p>
        </header>
        {hasHub ? <Hub /> : <NewCareer />}
      </main>
      <ConsentBanner />
    </>
  );
}

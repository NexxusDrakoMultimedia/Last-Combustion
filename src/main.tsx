// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSqlInBrowser } from './db/browser';
import { createWebPlatform } from './platform/web';
import { setServices } from './state/services';
// Bundled fonts (SIL Open Font Licence): Fira Sans for text, Fira Sans Condensed for headings.
import '@fontsource/fira-sans/latin-400.css';
import '@fontsource/fira-sans/latin-ext-400.css';
import '@fontsource/fira-sans/latin-500.css';
import '@fontsource/fira-sans/latin-ext-500.css';
import '@fontsource/fira-sans/latin-600.css';
import '@fontsource/fira-sans/latin-ext-600.css';
import '@fontsource/fira-sans/latin-700.css';
import '@fontsource/fira-sans/latin-ext-700.css';
import '@fontsource/fira-sans-condensed/latin-700.css';
import '@fontsource/fira-sans-condensed/latin-ext-700.css';
import './index.css';

setServices({ loadSql: loadSqlInBrowser, platform: createWebPlatform() });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSqlInBrowser } from './db/browser';
import { createWebPlatform } from './platform/web';
import { setServices } from './state/services';
// Bundled fonts (SIL Open Font Licence and Apache-2.0): the Roboto family. Roboto for text, Roboto
// Condensed for headings, Roboto Mono for numbers and plates, Roboto Slab for headlines, Roboto Serif
// for news text and Roboto Flex for in-game social media.
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-ext-700.css';
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/roboto-condensed/latin-ext-700.css';
import '@fontsource/roboto-mono/latin-400.css';
import '@fontsource/roboto-mono/latin-ext-400.css';
import '@fontsource/roboto-mono/latin-700.css';
import '@fontsource/roboto-mono/latin-ext-700.css';
import '@fontsource/roboto-slab/latin-700.css';
import '@fontsource/roboto-slab/latin-ext-700.css';
import '@fontsource/roboto-serif/latin-400.css';
import '@fontsource/roboto-serif/latin-ext-400.css';
import '@fontsource/roboto-serif/latin-700.css';
import '@fontsource/roboto-serif/latin-ext-700.css';
import '@fontsource/roboto-flex/latin-400.css';
import '@fontsource/roboto-flex/latin-ext-400.css';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';

setServices({ loadSql: loadSqlInBrowser, platform: createWebPlatform() });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

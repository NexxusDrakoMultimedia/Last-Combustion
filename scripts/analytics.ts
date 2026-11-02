// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Plugin } from 'vite';

/** A Google tag measurement ID, such as G-H0N9B01KRM. */
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/;

/** The Google tag snippet for a measurement ID, or an empty string if the ID is missing or invalid. */
export function googleTagSnippet(id: string | undefined): string {
  if (!id || !MEASUREMENT_ID.test(id)) return '';
  return `<!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', '${id}');
    </script>
  `;
}

/**
 * Adds the Google tag to the page when `GTAG_ID` is set at build time. Only the web build on
 * GitHub Pages sets it, so local, test and desktop builds carry no analytics.
 */
export function googleTag(id: string | undefined = process.env.GTAG_ID): Plugin {
  return {
    name: 'last-combustion:google-tag',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const snippet = googleTagSnippet(id);
        return snippet ? html.replace('</head>', `${snippet}</head>`) : html;
      },
    },
  };
}

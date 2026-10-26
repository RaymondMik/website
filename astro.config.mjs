// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

/**
 * Sitemap <lastmod> values, keyed by URL path. Posts use `updatedDate` or
 * `pubDate` from their frontmatter; the static pages (home, writing index,
 * about) use the newest post date, since that is when their content last
 * changed in a way that matters to crawlers.
 */
function postLastmods() {
  const dir = join(import.meta.dirname, 'src/content/writing');
  /** @type {Record<string, string>} */
  const byPath = {};
  let newest = '';
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const src = readFileSync(join(dir, file), 'utf8');
    const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    if (/^draft:\s*true/m.test(fm)) continue;
    const pick = (/** @type {string} */ key) => fm.match(new RegExp(`^${key}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
    const date = pick('updatedDate') ?? pick('pubDate');
    if (!date) continue;
    byPath[`/writing/${file.replace(/\.md$/, '')}/`] = date;
    if (date > newest) newest = date;
  }
  for (const p of ['/', '/writing/', '/about/']) byPath[p] = newest;
  return byPath;
}
const lastmods = postLastmods();

/**
 * github-light-default's comment colour (#6E7781) only reaches 4.24:1 on the
 * site's paper background (#f7f7f5), just under the WCAG AA minimum of 4.5:1.
 * Swap it for the site's muted ink (#5b6069, 5.89:1). Every other token in
 * both GitHub themes already meets AA on the light and dark backgrounds.
 */
/** @type {NonNullable<import('astro').ShikiConfig['transformers']>[number]} */
const aaCommentContrast = {
  name: 'aa-comment-contrast',
  span(node) {
    const style = node.properties.style;
    if (typeof style === 'string' && /color:#6e7781/i.test(style)) {
      node.properties.style = style.replace(/color:#6e7781/i, 'color:#5b6069');
    }
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://ramonmiklus.com',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    sitemap({
      serialize(item) {
        const path = new URL(item.url).pathname;
        const lastmod = lastmods[path];
        return lastmod ? { ...item, lastmod } : item;
      }
    })
  ],

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light-default',
        dark: 'github-dark-default'
      },
      transformers: [aaCommentContrast]
    }
  }
});

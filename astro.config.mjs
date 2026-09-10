// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

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

  integrations: [sitemap()],

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

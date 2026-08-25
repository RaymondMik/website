// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // TODO: replace with your real domain before deploying (used for sitemap, RSS, and canonical URLs)
  site: 'https://ramonmiklus.com',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()],

  markdown: {
    shikiConfig: {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark'
      }
    }
  }
});

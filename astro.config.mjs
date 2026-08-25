// @ts-check
import { defineConfig, envField } from 'astro/config';

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

  env: {
    schema: {
      // Server-only secret: read at build time, never shipped to the browser.
      // Set in .env locally and as an env var on the deploy host.
      NASA_API_KEY: envField.string({ context: 'server', access: 'secret', default: 'DEMO_KEY' })
    }
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark'
      }
    }
  }
});

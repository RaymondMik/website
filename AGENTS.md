# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm** (requires Node >= 22.12.0).

- `pnpm install` — install dependencies
- `pnpm build` — production build to `./dist/`
- `pnpm preview` — preview the production build locally
- `pnpm astro check` — type-check `.astro` and `.ts` files

There are no tests or linters configured.

### Dev server

When starting the dev server (serves at `localhost:4321`), use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Architecture

Personal/professional site (90% professional, 10% personal) for Ramón Miklus, centered on a software-engineering blog called **"Writing"**. Astro 7, static output, Tailwind v4 (via `@tailwindcss/vite`), no client-side JS.

- **Blog posts** live in `src/content/writing/*.md` as a content collection (schema in `src/content.config.ts`: title, description, pubDate, tags, draft). Adding a post = adding a Markdown file; `draft: true` excludes it everywhere.
- **Routes** (`src/pages/`): `/` (intro + latest posts), `/writing/` (ledger index grouped by year), `/writing/[id]` (post pages via `getStaticPaths` + `render()`), `/about/`, `/rss.xml` (via `@astrojs/rss`). Sitemap comes from `@astrojs/sitemap`.
- **Design system** is defined in `src/styles/global.css`: light/dark palettes as CSS vars on `:root` (switched by `prefers-color-scheme`), exposed as Tailwind utilities (`bg-paper`, `text-ink`, `text-muted`, `border-line`, `text-accent`) via `@theme inline`. Fonts are self-hosted Fontsource packages imported in `Layout.astro`: Archivo (display), Source Serif 4 (body prose), IBM Plex Mono (dates/tags/code/wordmark).
- **Code highlighting**: Shiki dual themes (vitesse-light/dark) configured in `astro.config.mjs`, with the dark-mode switch handled in `global.css`.
- `Layout.astro` is the single page shell (head/meta/OG tags, header nav, footer); article prose uses `@tailwindcss/typography` with token overrides in `global.css`.

The `site` URL in `astro.config.mjs` is a placeholder — it must be set to the real domain before deploying (affects canonical URLs, sitemap, RSS).

TypeScript uses Astro's `strict` preset. Note: `typescript` is pinned to 5.x in devDependencies because `astro check` is incompatible with TypeScript 7.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

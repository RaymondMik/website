# ramonmiklus.com

Personal site and software-engineering blog of Ramón Miklus, built with [Astro](https://astro.build) and Tailwind CSS, deployed to GitHub Pages.

## Commands

Requires Node >= 22.12 and pnpm.

| Command             | Action                                   |
| ------------------- | ---------------------------------------- |
| `pnpm install`      | Install dependencies                     |
| `pnpm dev`          | Start the dev server at `localhost:4321` |
| `pnpm build`        | Build the production site to `./dist/`   |
| `pnpm preview`      | Preview the production build locally     |
| `pnpm astro check`  | Type-check `.astro` and `.ts` files      |

## Writing a post

Add a Markdown file to `src/content/writing/` with `title`, `description`, `pubDate` and optional `tags`, `updatedDate` and `draft` frontmatter. Pushing to `main` builds and deploys the site.

See `AGENTS.md` for architecture notes.

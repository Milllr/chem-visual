# chem visual

my personal chemistry lab notebook with a built-in AI assistant. i wanted something that feels like a lab notebook but lives in the browser, with molecule visualization, camera capture, and AI chat that understands chemistry context.

live at [majogendron.com](https://majogendron.com)

## what it does

- **notebook-based projects** - each lab project gets its own colored notebook
- **block-based pages** - text, images (camera capture on mobile), molecule structures, AI responses
- **molecule visualizer** - type a formula, name, or SMILES notation and get a pencil-style structural drawing
- **per-notebook AI chat** - GPT for tutoring, Perplexity for research. pin responses into your pages
- **mobile-first** - designed for phone use at the bench
- **single-user auth** - password login with signed session cookies

## stack

**languages:** TypeScript, SQL

**frameworks:** SvelteKit 2, Svelte 5

**infra:** Cloudflare Pages, D1, R2. runs entirely on Cloudflare's free tier

**libraries & API's:** smiles-drawer, OpenAI, Perplexity

## local dev

```bash
npm install
npm run db:local
npm run dev
```

in dev mode, any password works on the login page.

## deploy

```bash
npx wrangler login
npx wrangler d1 create chem-journal     # copy database_id to wrangler.toml
npx wrangler r2 bucket create chem-journal-uploads
npm run db:remote
npm run deploy
```

secrets are set via `npx wrangler pages secret put <KEY>`, see `.env.example` for what's needed.

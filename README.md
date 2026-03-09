# 🧪 Chem Journal

Personal chemistry lab notebook & AI assistant — hosted at **majogendron.com**.

Built with SvelteKit + Cloudflare (Pages, D1, R2). 100% free hosting.

## Quick Start (Local Dev)

```bash
npm install
npm run db:local          # Initialize local D1 database
npm run dev               # Start dev server → http://localhost:5173
```

In dev mode, **any password** works on the login page (no `AUTH_PASSWORD_HASH` set).

## Deploy to Cloudflare

### 1. Create resources

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create chem-journal
# → Copy the database_id and paste it into wrangler.toml

# Create R2 bucket
npx wrangler r2 bucket create chem-journal-uploads

# Initialize remote schema
npm run db:remote
```

### 2. Set secrets

```bash
# Generate a password hash
echo -n "YOUR_PASSWORD" | shasum -a 256 | awk '{print $1}'

# Set secrets
npx wrangler pages secret put AUTH_PASSWORD_HASH
npx wrangler pages secret put AUTH_SECRET
npx wrangler pages secret put OPENAI_API_KEY
npx wrangler pages secret put PERPLEXITY_API_KEY
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Point domain

In Cloudflare Dashboard → Pages → your project → Custom domains → Add `majogendron.com`.

Make sure your domain's DNS is managed by Cloudflare (free plan).

## Architecture

| Layer | Tech | Free Tier |
|-------|------|-----------|
| Frontend | SvelteKit 2 + Svelte 5 | — |
| Hosting | Cloudflare Pages | 500 deploys/mo, unlimited bandwidth |
| Backend | CF Workers (via Pages Functions) | 100K req/day |
| Database | Cloudflare D1 (SQLite) | 5M reads/day, 5 GB |
| Storage | Cloudflare R2 | 10 GB, free egress |
| Molecules | smiles-drawer | — |
| AI Chat | OpenAI GPT-4o + Perplexity Sonar | Pay per use |
| Fonts | Virgil (Excalidraw) + System UI | OFL / System |

## Features

- **Notebook-based projects** — each lab project is a colored notebook
- **Block-based pages** — text, images (camera capture), molecule structures, AI responses
- **Molecule visualizer** — type a formula (C3H8), name (propane), or SMILES (CCC) and get a pencil-style structural drawing
- **Per-notebook AI chat** — GPT-4o for tutoring, Perplexity for research. Pin responses into your notebook pages
- **Mobile-first** — designed for phone use in the lab. Bottom action bar, large touch targets, camera capture
- **Single-user auth** — simple password login with signed session cookies

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run db:local` | Initialize local D1 schema |
| `npm run db:remote` | Initialize remote D1 schema |
| `npm run check` | TypeScript + Svelte type checking |

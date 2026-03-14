# Snorg Morgue

**Dungeon Crawl Stone Soup (DCSS) analytics and morgue tracking.** Upload your morgue files or sync from public game servers to track wins, achievements, species/background combos, and performance over time.

![Snorg](https://img.shields.io/badge/DCSS-v0.34-green)

## What it does

- **Performance analytics** — Species/background/god charts, level-at-death distribution, rune collection, fastest wins, top killers.
- **Official achievements** — Great Player, Grand Player, Polytheist, Tiamat, plus Greater/Devoted/Enthusiastic species goals with progress bars and rollover details.
- **Species–background combo grid** — See which combos you’ve won or attempted; impossible combos are greyed out. Row/column highlight on hover.
- **Morgue management** — Upload `.txt` morgue files, browse and search, refresh from raw text, download all. Optional **online import** from multiple DCSS servers (e.g. crawl.dcss.io, Akrasiac, Underhound) with per-server scan and configurable import limit.
- **Public profile** — Share your stats at `/{username}/analytics` (and `/morgues`, `/achievements`). Optional global averages and comparison.
- **Themes** — Tiles-style and ASCII-style themes.

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Supabase** — Auth (email + Google), Postgres, storage
- **Tailwind CSS 4**, Radix UI, Recharts
- **pnpm**

## Getting started

1. **Clone and install**

   ```bash
   git clone https://github.com/your-org/snorg-morgue.git
   cd snorg-morgue
   pnpm install
   ```

2. **Environment**

   Create `.env.local` with your Supabase project URL and keys (see Supabase dashboard). For online import from game servers you’ll need `SUPABASE_SERVICE_ROLE_KEY` set in the server environment.

3. **Run**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign up or sign in, then upload morgue files or use **Online Import** from the Morgues tab to pull games from public DCSS servers.

## Project structure

- `app/` — Routes: login, dashboard (`/dashboard`), user profiles (`/[username]/analytics`, `/[username]/morgues`, etc.), morgue detail pages.
- `components/dashboard/` — Dashboard UI: stat cards, goal progress, charts, species–background grid, upload dialog, online import dialog, uploads table.
- `lib/` — Morgue parsing, DB helpers, DCSS constants, online-import logic (scan/import from configured servers), Supabase client.
- `supabase/` — SQL migrations (e.g. `parsed_morgues` schema, global analysis RPC).

## License

Private / unlicensed unless otherwise stated.

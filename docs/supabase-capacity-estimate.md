# Supabase free tier – player capacity estimate

## Plan limits (free tier)

- **Database size:** 500 MB per project (hard limit; read-only if exceeded).
- Storage (bucket) and egress have separate quotas; this estimate focuses on **database** as the main constraint for morgue data.

## Data model (what uses database space)

1. **`morgue_files`** – one row per uploaded morgue:
   - `raw_text` (TEXT) – full morgue file content (dominant share of DB size).
   - `filename`, `user_id`, `id`, `created_at` – small overhead.

2. **`parsed_morgues`** – one row per morgue (parsed fields):
   - ~20 columns (ids, character_name, species, background, xl, place, turns, duration, god, runes, etc.).
   - Indexes on `user_id`, `short_id`, etc. add some overhead.

3. **`user_stats`** – one row per user:
   - Aggregates (totals, win rate, streaks, fastest win, etc.) plus JSONB (e.g. species_stats, background_stats, god_stats).
   - Small compared to morgue data.

## Assumptions

- **200 morgue files per user** (as specified).
- **Average size of `raw_text` per morgue:** 25 KB (typical DCSS morgue with inventory, skills, message history). In practice, files often sit in a **15–40 KB** range; 25 KB is a middle estimate.
- **`parsed_morgues`:** ~0.5–1 KB per row including index overhead → use **~1 KB per morgue**.
- **`user_stats`:** **~5 KB per user** (one row with aggregates + JSONB).

## Per-user database size (200 morgues)

| Component        | Calculation     | Size    |
|-----------------|-----------------|---------|
| morgue_files   | 200 × 25 KB     | 5.0 MB  |
| parsed_morgues | 200 × 1 KB      | 0.2 MB  |
| user_stats     | 1 × 5 KB        | 0.005 MB|
| **Total per user** |                | **~5.2 MB** |

## Estimated number of players

- **500 MB ÷ 5.2 MB ≈ 96 users** (with 200 morgues each at 25 KB average).

### Sensitivity to morgue size

| Avg morgue `raw_text` | Per user (200 morgues) | Players (500 MB) |
|----------------------|------------------------|------------------|
| 15 KB                | ~3.1 MB                | ~161             |
| 25 KB                | ~5.2 MB                | ~96              |
| 40 KB                | ~8.2 MB                | ~61              |

So a reasonable **planning range** is **about 60–160 players** at 200 morgues per user, depending on average morgue file size. Using **~25 KB** per file gives **~100 players** as a central estimate.

---

## Mixed scenario: 50% upload, 50% online sync (parsed-only for sync)

If **half of players** use **online server sync** and those morgues are **not** stored in full (only parsed data), storage per user drops sharply for that half.

**Current implementation note:** Today, online import does write full `raw_text` into `morgue_files` so the morgue browser and download work. The numbers below assume a “sync-only” mode where sync users have **no** `morgue_files` rows (only `parsed_morgues` + `user_stats`). That would require a code/schema change (e.g. optional `morgue_file_id`, no insert into `morgue_files` for sync).

### Per-user storage in the mixed scenario

| User type   | Share | morgue_files | parsed_morgues | user_stats | **Total per user** |
|------------|-------|--------------|----------------|------------|--------------------|
| Upload     | 50%   | 200 × 25 KB = 5.0 MB | 200 × 1 KB = 0.2 MB | ~5 KB | **~5.2 MB** |
| Sync-only  | 50%   | 0            | 200 × 1 KB = 0.2 MB | ~5 KB | **~0.2 MB**  |

**Weighted average per user:**  
0.5 × 5.2 + 0.5 × 0.2 = **2.7 MB per user**.

### Estimated number of players (50% sync-only)

- **500 MB ÷ 2.7 MB ≈ 185 users** (with 200 morgues each, 25 KB avg raw for upload users).

After reserving ~50–100 MB for auth and overhead: **~170–180 players** as a practical range.

So with half of players on sync (parsed-only), capacity is roughly **double** the all-upload case (~100 → ~180 users).

---

## Parsed data only (no saved morgues)

If we **remove `morgue_files` entirely** and keep only **parsed data** (`parsed_morgues` + `user_stats`), every user is effectively “parsed-only.” That implies:

- No raw morgue browser or “download morgue” from your DB (users could still view stats, charts, achievements; full morgue would need to come from elsewhere, e.g. fetched from the DCSS server on demand).
- Upload flow would parse on upload, insert into `parsed_morgues` only, and discard raw text (or not store it). Online sync already has the raw text in memory only; it would just stop writing to `morgue_files`.

### Per-user storage (parsed only, 200 morgues)

| Component        | Calculation     | Size    |
|-----------------|-----------------|---------|
| morgue_files   | 0               | 0       |
| parsed_morgues | 200 × 1 KB      | 0.2 MB  |
| user_stats     | 1 × 5 KB        | ~0.005 MB |
| **Total per user** |                | **~0.2 MB** |

### Estimated number of players (parsed only)

- **500 MB ÷ 0.2 MB ≈ 2,500 users** (with 200 morgues each).

After reserving ~50–100 MB for auth and overhead: **~2,000–2,200 players** as a practical range.

So with **no saved morgues**, capacity is about **20–25×** the all-upload case (~100 → ~2,000+ users). The tradeoff is losing in-app full morgue viewing/download unless you fetch from the game server on demand.

---

## Notes

- **Auth and system tables** (e.g. `auth.users`) use extra space; the above is for morgue-related data only. Leaving ~50–100 MB for auth and overhead is prudent.
- **Egress:** Free tier includes 5 GB/month; serving raw morgues and API responses will consume this. Sync-only users don’t need raw morgue served from your DB, so egress is lower for that segment.
- To support more users: reduce retention (e.g. cap morgues per user), add a sync-only path that skips `morgue_files`, or move large blobs out of the DB (e.g. store `raw_text` in Supabase Storage and keep only metadata in Postgres).

### Current behaviour vs server URL

Right now the **morgue details viewer** does **not** use the DCSS server URL. It always loads raw morgue text from our database (`morgue_files.raw_text`). The online servers do provide a stable URL for each morgue (e.g. `https://crawl.dcss.io/crawl/morgue/PlayerName/morgue-PlayerName-20240101-120000.txt`), which we use only during **import** to fetch the file. If we stop storing raw morgues for sync-imported games, we can have the viewer fetch from that URL when opening a morgue (we store `morgue_url` in `parsed_morgues` for sync-imported games so the client can do that). Manually uploaded morgues have no external URL, so they must continue to be read from our DB (or from Storage if we move blobs there).

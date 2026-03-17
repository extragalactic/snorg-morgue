---
name: skilling-analysis-spell-school-expansion
overview: Extend Skilling Analysis to include all spell schools in data gathering and three new ranked spell school lines (1st/2nd/3rd) based on per-game top spell schools, then update the planning document accordingly.
---

### Skilling Analysis Spell School Expansion

We will expand the existing Skilling Analysis design (global winners only, species/background filtered, using `skill_snapshots` + RPC) to incorporate all spell schools and three new ranked spell school aggregates, and then update the planning document to reflect this.

### 1. Clarify semantics for ranked spell school lines

- **Included skills**: Treat only the traditional spell schools as part of the ranking: Conjurations, Hexes, Summonings, Necromancy, Translocations, Transmutations, Fire Magic, Ice Magic, Air Magic, Earth Magic.
- **Spellcasting**: Keep `Spellcasting` as its own independent row (already part of the existing plan), **not** part of the 1st/2nd/3rd / Highest/Second/Third Spell School rankings.
- **Per-game, per-checkpoint ranking**:
  - For each **winning game** and each XL checkpoint (5, 10, 15, 20, 25), look at the levels of all tracked spell schools at that checkpoint.
  - Sort those spell school levels in descending order for that game and checkpoint.
  - Define:
    - **Highest Spell School** (stored as `Spell School 1`): The highest spell school level for that game at that checkpoint.
    - **Second Spell School** (stored as `Spell School 2`): The second-highest level (if it exists) at that checkpoint.
    - **Third Spell School** (stored as `Spell School 3`): The third-highest level (if it exists) at that checkpoint.
- **Handling games with <3 trained spell schools at a checkpoint**:
  - For the **Highest Spell School** line, every winning game that reached the checkpoint contributes (as long as it has at least one spell school with a sample there).
  - For the **Second Spell School** line, only games with **at least two** trained spell schools at that checkpoint contribute.
  - For the **Third Spell School** line, only games with **at least three** trained spell schools at that checkpoint contribute.
  - This matches the choice to **exclude games from the average for that rank** if they have fewer than the required number of trained spell schools at that checkpoint.

#### Checkpoints and scope

- We use fixed XL checkpoints: **5, 10, 15, 20, 25**.
  - We intentionally stop at XL 25 instead of 27, since many winning characters never reach XL 27; this avoids skew from a smaller subset of very high-XP games.
- Skilling Analysis is **global-only**:
  - All calculations are based on **all global winning games** that match the selected species/background filters.
  - The UI subtitle should describe “all global winners” and **must not** hard-code a specific analyzed user count.

### 2. Data gathering changes (skill history parsing & snapshots)

We keep the core architecture from the existing plan (per-game `skill_snapshots` table populated at import time) and extend it to capture spell schools and ranked aggregates.

- **Extend skill taxonomy** (in `[lib/dcss-skills.ts](lib/dcss-skills.ts)`):
  - Define a `SPELL_SCHOOLS` constant listing all traditional spell schools.
  - Ensure `NON_SPELL_SKILLS` remains for non-spell skills (including Spellcasting as a separate skill) and that all individual spell schools are also tracked where needed.
- **Include spell schools in snapshots** (in `[lib/skill-history.ts](lib/skill-history.ts)`):
  - When reconstructing per-skill levels at XL checkpoints, ensure we create `skill_snapshots` rows for each individual spell school in `SPELL_SCHOOLS` (per game, per checkpoint, with `skill_group` set to the specific school name or canonical key).
  - Keep existing behavior where all non-spell skills (including all weapon skills and Spellcasting) are already recorded per skill.
- **Compute ranked spell school aggregates during snapshot generation**:
  - After computing individual spell school levels for a game at a checkpoint, build a list of `(school, level)` entries for that checkpoint.
  - Sort by `level` descending, break ties deterministically if needed (e.g. by school name) but note that tie-breaking has negligible impact on averages.
  - For each rank 1–3 that exists for that game/checkpoint, emit an additional `skill_snapshots` row with:
    - `skill_group` values like `"Spell School 1"`, `"Spell School 2"`, `"Spell School 3"`.
    - `checkpoint_xl` equal to the checkpoint (5, 10, 15, 20, 25).
    - `level` equal to the corresponding ranked level (1st/2nd/3rd highest).
  - Do **not** emit a row for ranks that don’t exist for that game/checkpoint (e.g., no 3rd row if only two trained schools at that checkpoint).
  - This ensures the RPC can compute the correct averages for each ranked line using the same mechanism as other skill groups.

#### Skill coverage and storage

- The table includes at least the following **non-spell skills**:
  - Fighting, Primary Weapon (composite), Throwing
  - Armour, Dodging, **Stealth**, Shields
  - Spellcasting, Invocations, Evocations
- Internally, we **store every individual skill** in `skill_snapshots`, including:
  - All weapon skills (Short Blades, Long Blades, Axes, Maces & Flails, Polearms, Staves, Bows, Crossbows, Slings, Unarmed Combat)
  - All traditional spell schools (Conjurations, Hexes, Summonings, Necromancy, Translocations, Transmutations, Fire Magic, Ice Magic, Air Magic, Earth Magic)
  - Utility skills such as Stealth, Armour, Dodging, Shields, Spellcasting, Invocations, Evocations, Throwing, etc.
- Composite skills (like **Primary Weapon** or the ranked **spell school** lines) are **derived from this per-skill data**, so we can change or extend the aggregation rules later without altering the stored snapshots.

### 3. Database and RPC implications

- **`skill_snapshots` table** (already defined in `[supabase/add_skill_snapshots.sql](supabase/add_skill_snapshots.sql)`):
  - No schema change is required, since ranked spell schools fit into the generic `skill_group` text column.
  - We only need to ensure that:
    - The new `Spell School 1/2/3` values are documented as valid `skill_group` labels.
    - Spell school names used for individual rows (e.g. `Conjurations`, `Fire Magic`) are consistent between parser and UI/RPC.
- **RPC `get_skill_level_averages`** (in `[supabase/add_skill_level_averages_rpc.sql](supabase/add_skill_level_averages_rpc.sql)`):
  - The existing RPC logic (grouping by `skill_group` and `checkpoint_xl`, averaging `level`, with optional species/background filters) remains valid and does not need structural changes.
  - With the new data, queries will naturally include aggregates for `"Spell School 1"`, `"Spell School 2"`, and `"Spell School 3"` alongside the existing skill groups (Fighting, Weapon/Primary Weapon, Spellcasting, etc.).
  - We may optionally document that consumers should treat `Spell School 1/2/3` specially as ranked aggregates.

### 4. UI changes to Skilling Analysis chart

We update the Skilling Analysis UI plan in `[components/dashboard/skilling-analysis.tsx](components/dashboard/skilling-analysis.tsx)` to display the new ranked spell school lines using the existing RPC data.

- **New rows**:
  - Add three new rows to the desired display order:
    - `Highest Spell School`
    - `Second Spell School`
    - `Third Spell School`
  - These correspond to the `skill_group` values `"Spell School 1"`, `"Spell School 2"`, `"Spell School 3"` returned by the RPC.
- **Row ordering**:
  - Update the `desiredOrder` array used to order rows, for example:
    - Fighting
    - Primary Weapon*
    - Armour
    - Dodging
    - Stealth
    - Shields
    - Spellcasting
    - Highest Spell School
    - Second Spell School
    - Third Spell School
    - Throwing
    - Invocations
    - Evocations
  - This keeps spell-related information grouped together while preserving the existing structure.
- **Legend and explanatory text**:
  - Extend the footnote or add a short note under the table to explain what the Highest/Second/Third Spell School rows represent, e.g.:
    - “Highest/Second/Third Spell School show the average of the highest, second-highest, and third-highest trained spell schools by level at each XL checkpoint (only counting games with at least that many trained spell schools at that checkpoint).”
  - Keep the existing Primary Weapon asterisk and explanation unchanged.

#### Checkpoints and highlighting in the UI

- The skill table has columns for XL **5, 10, 15, 20, 25**.
  - These columns correspond directly to the snapshot checkpoints and the `checkpoint_xl` values returned by the `get_skill_level_averages` RPC.
- At the final checkpoint (XL **25**):
  - We compute, across all skills present in the table, which **three skills** have the highest **average level** at XL 25.
  - In the UI, those three rows are **highlighted via text color only** (for example, `text-primary` + slightly bolder font).
  - This is purely a **visual cue** in the table and does not change:
    - The underlying data model.
    - The SQL in `get_skill_level_averages`.
    - Which rows are included; it only changes styling.

### 5. Planning document updates

Finally, we update the existing planning document (the original "Skilling Analysis (Global Winners) – Implementation Plan" file) to incorporate these decisions so future work is guided by the new expectations.

- **Add a new subsection** under the data model / aggregation section describing:
  - Inclusion of all traditional spell schools in the snapshots.
  - The definition and purpose of the `Spell School 1/2/3` aggregate skill groups.
  - The rule to exclude games without enough trained spell schools from the averages for ranks 2 and 3 at a checkpoint.
- **Update the UI section** of the plan to:
  - List the three new table rows and their ordering.
  - Note that the UI consumes them via the existing RPC (`get_skill_level_averages`) just like other skill groups.
- **Leave completed implementation tasks intact** and clearly mark these spell school enhancements as an additional refinement stage, so they can be tracked separately from the already completed core Skilling Analysis work.


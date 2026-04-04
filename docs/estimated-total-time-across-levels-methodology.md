# Estimated total time spent across levels — calculation methodology

## In plain English

The chart is a **rough picture** of where your **total** DCSS play time probably sits across character levels (XL 1 through 26). The game does not tell us how many minutes you spent on each level, so we **infer** it from what each morgue file already includes: the level you died on and how long the run lasted.

We group runs by **death level** and look at **typical run length** for each group. If runs that end deeper tend to be longer, we treat part of that extra length as time “associated with” the levels in between. We then multiply by **how many of your runs reached** each level, so busy levels (lots of runs that got that far) contribute more to the total. When the pattern goes the wrong way for a stretch (averages dip), the calculation **spreads** the correction across several levels instead of showing nonsense negative time.

The line on the chart is **smoothed** so small jumps do not dominate the graph; it is meant to be easy to read, not a minute-by-minute truth. **This is not a stopwatch per level**—build choice, luck, and how you play at different depths all affect run length, so treat the curve as an **estimate**, not a direct log from the game.

---

The sections below describe **exactly** how the chart is computed in code, for reviewers who want definitions, formulas, and parity with the implementation. The source of truth is `components/dashboard/level-time-distribution-chart.tsx` (notably `buildTotalTimeSpentAtEachLevelData`, `fillValuesForTrendLine`, `movingAverageOnFilledSeries`, and `computeSmoothedTrendHours`).

---

## 1. Inputs

For each morgue / game record in the filtered set passed to the chart:

| Field | Role |
|-------|------|
| **Character level (XL)** | Integer-ish value `m.xl`; coerced with `Number`, must be finite. |
| **Run duration** | `m.durationSeconds`; used only if finite and **strictly positive**. |

Records with a non-finite XL after coercion are excluded from all aggregates below.

---

## 2. Definitions

### 2.1 Ending level

For a record with numeric XL, the **ending level** \(E\) is:

\[
E = \mathrm{clip}\bigl(\mathrm{round}(\texttt{xl}),\, 1,\, 27\bigr)
\]

So \(E \in \{1,\ldots,27\}\). The implementation uses `LEVEL_COUNT = 27`.

### 2.2 Scope of the chart (XL 1–26)

Per-level **output rows** exist only for **character levels** \(L = 1,\ldots,26\) (`CHART_LEVELS = 26`). XL **27** participates in **average-duration** arrays and in **adjacent differences** involving XL 26 → 27, but there is no separate plotted point for “level 27.”

### 2.3 Games ended at each XL

For each \(k \in \{1,\ldots,27\}\):

\[
N^{\mathrm{end}}_k = \#\{\text{runs with ending level } E = k\}.
\]

The chart row for level \(L\) exposes **games ended here** as \(N^{\mathrm{end}}_L\) for \(L \le 26\) only.

### 2.4 Runs that reached level \(L\) or higher

For each \(L \in \{1,\ldots,27\}\):

\[
R_L = \#\{\text{runs with } E \ge L\}.
\]

The chart row for level \(L \in \{1,\ldots,26\}\) exposes **games reached level \(L\)+** as \(R_L\).

**Note:** This is a count of runs whose **death** was at least \(L\), not independent knowledge of “visited” levels before death (the data model is morgue-at-death).

### 2.5 Average run duration at death, conditional on ending XL

Let \(D\) be run duration in **minutes** (\(D = \texttt{durationSeconds} / 60\) when duration is kept).

For each ending level \(k \in \{1,\ldots,27\}\), collect \(D\) over all runs with \(E = k\) and positive finite duration. If that set is non-empty, define:

\[
\bar{D}_k = \frac{1}{n_k} \sum_{\text{runs with } E=k} D
\]

If there are no such runs, \(\bar{D}_k\) is **undefined** (implemented as `null`).

So \(\bar{D}_k\) is the **sample mean duration**, in minutes, among runs that **ended** at XL \(k\), **excluding** runs without a usable positive duration.

---

## 3. Per-run time attributed to each level (minutes)

The implementation builds an estimate \(\hat{t}_L\) (minutes **per run**) for \(L = 1,\ldots,26\). Initial state: all \(\hat{t}_L\) are undefined.

A **stateful scan** walks \(L\) from 1 to 26. Let array indices use **0-based** for code alignment: index \(i = L - 1\) corresponds to \(\bar{D}_L\), but note \(\bar{D}\) is defined for \(L = 1,\ldots,27\).

### 3.1 Case A — adjacent averages both known, nonnegative gap

If \(\bar{D}_L\) and \(\bar{D}_{L+1}\) are both defined and

\[
\bar{D}_{L+1} - \bar{D}_L \ge 0,
\]

then

\[
\hat{t}_L = \bar{D}_{L+1} - \bar{D}_L.
\]

**Interpretation (informal):** Under a monotone-in-depth model, the extra average clock time from runs ending one level deeper is allocated to the **current** level \(L\).

### 3.2 Case B — adjacent averages both known, negative gap (“non-monotone” band)

If \(\bar{D}_L\) and \(\bar{D}_{L+1}\) are both defined and

\[
\bar{D}_{L+1} - \bar{D}_L < 0,
\]

the implementation **does not** assign \(\hat{t}_L\) from that raw difference. Instead:

1. Fix **start** \(s = L\) and \(\bar{D}_{\mathrm{start}} = \bar{D}_s\).
2. Search for the **smallest** integer **ending level** \(e \in \{L+2,\ldots,27\}\) such that \(\bar{D}_e\) is defined and \(\bar{D}_e > \bar{D}_{\mathrm{start}}\). If none exists, the scan advances without assigning \(\hat{t}_L\) from this rule (that position may remain undefined unless handled in a later iteration — the loop then does `L ← e` only when \(e\) is found).

When such an \(e\) **is** found:

\[
\Delta = \bar{D}_e - \bar{D}_{\mathrm{start}}, \qquad
\text{steps} = e - s,
\qquad
\text{shared} = \frac{\Delta}{\text{steps}}.
\]

Then for every integer level \(j\) with \(s \le j \le e - 1\) **and** \(j \le 26\):

\[
\hat{t}_j = \text{shared}.
\]

All those \(j\) are marked in metadata as a **merged block** ending at \(e\). The outer scan then sets **current \(L \leftarrow e\)** (skipping interior levels already filled).

**Interpretation (informal):** A **net duration gain** from \(s\) to \(e\) is split **evenly** across the first \(\text{steps} = e - s\) level indices in the inclusive-from-\(s\) sense (levels \(s, s+1, \ldots, e-1\)), correcting for dips in the sequence \(\bar{D}_k\) that would otherwise imply negative incremental time.

### 3.3 Case C — missing averages

If \(\bar{D}_L\) or \(\bar{D}_{L+1}\) is undefined, the scan advances with **no** assignment at \(L\) from Case A/B at that step.

### 3.4 Dependence on sample composition

Because \(\bar{D}_k\) are **conditional means** over runs ending at \(k\), \(\hat{t}_L\) is **not** an estimator derived from a single homogeneous cohort across depths. Mix shifts (e.g. faster playstyles more common at high XL) *can* move \(\bar{D}_k\) in ways that affect differences and merged bands.

---

## 4. Total estimated time at level \(L\) (before smoothing)

For each \(L \in \{1,\ldots,26\}\):

- If \(\hat{t}_L\) is defined:

\[
T^{\mathrm{min}}_L = \hat{t}_L \cdot R_L,
\qquad
T^{\mathrm{hr}}_L = \frac{T^{\mathrm{min}}_L}{60}.
\]

- If \(\hat{t}_L\) is undefined, \(T^{\mathrm{min}}_L\) and \(T^{\mathrm{hr}}_L\) are undefined (`null`).

**Interpretation (informal):** Each run counted in \(R_L\) is treated as contributing \(\hat{t}_L\) minutes **at level \(L\)** when \(\hat{t}_L\) is available. This **scales** the per-run increment by how many runs survived to at least \(L\).

---

## 5. Smoothed series shown on the chart (hours)

The plotted Y values are **not** raw \(T^{\mathrm{hr}}_L\). They are built in two steps from the vector \((T^{\mathrm{hr}}_1, \ldots, T^{\mathrm{hr}}_{26})\).

### 5.1 Gap filling (`fillValuesForTrendLine`)

Let \(h_L = T^{\mathrm{hr}}_L\). Entries may be missing.

1. If **no** finite \(h_L\) exists anywhere, the filled series is **all zeros**.
2. Otherwise, find the first and last indices with finite \(h\).
3. For missing values:
   positions **before** the first finite **carry** the first finite value;
   positions **after** the last finite **carry** the last finite value;
   **between** two finite known positions, use **linear interpolation** in index space.
4. Positions with finite \(h\) are copied unchanged.

This produces a fully defined length-26 vector \((\tilde{h}_1,\ldots,\tilde{h}_{26})\).

### 5.2 Moving average (`movingAverageOnFilledSeries`)

On \((\tilde{h}_1,\ldots,\tilde{h}_{26})\):

- \(L = 1\): smoothed\(_1\) = \((\tilde{h}_1 + \tilde{h}_2) / 2\).
- \(L = 26\): smoothed\(_{26}\) = \((\tilde{h}_{25} + \tilde{h}_{26}) / 2\).
- \(2 \le L \le 25\): smoothed\(_L\) = \((\tilde{h}_{L-1} + \tilde{h}_L + \tilde{h}_{L+1}) / 3\).

The chart line and tooltip **“Estimated total time”** use this **smoothed** value (hours), not \(T^{\mathrm{hr}}_L\) directly.

**Important:** Smoothing can **impute** a visually continuous path where some underlying \(T^{\mathrm{hr}}_L\) were missing; tooltips may note when there was no standalone model estimate at that XL but the trend still passes through via filling and averaging.

---

## 6. What this metric is and is not

**It is:**

- A **deterministic** function of the uploaded morgue summaries in scope (XL at death, duration when present).
- An **indirect** construction based on differences (and merged differences) of **average** run lengths by **death depth**, then scaled by **how many runs reached** each level.
- A **readability-smoothed** display of total implied hours per XL.

**It is not:**

- Exact per-level playtime from telemetry or turn-by-turn logs.
- A causal decomposition of time; \(\bar{D}_k\) mixes **all** runs ending at \(k\) (builds, outcomes, macro, idle time in real-time play, etc.).
- A modeled regression or mixed-effects fit; the only “model” is the discrete scan, non-negativity by merge, interpolation, and moving average described above.

---

## 7. Audit checklist (implementation parity)

When verifying against the source file:

1. `endingLevel` matches clipping and rounding in §2.1.
2. Duration inclusion requires **finite** and **`> 0`** seconds (§1).
3. `countEnded`, `durationsByLevelMin`, `reachedCount`, and `avgDuration` match §§2.3–2.5.
4. The `while` loop over `level` implements §3.1–3.2 exactly (including `level = end` after a merge).
5. `totalLevelTimeMinutes = perRun * reached` and hours = minutes / 60 (§4).
6. `computeSmoothedTrendHours` = fill (§5.1) then moving average (§5.2).
7. `Line` `dataKey` is `smoothedHours` (§5).

---

*Document generated to mirror the logic in `components/dashboard/level-time-distribution-chart.tsx`. If the code changes, update this file or regenerate it from the implementation.*

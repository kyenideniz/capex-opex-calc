# Planisware October 31, 2026 Actuals Integration & Project Carousel

Deliver the updated spend actuals ingestion from `CJI_export_01-11-2026.xlsx` (through October 31, 2026), dual-source delta comparison against `capex-export-CJI3.xlsx`, an in-modal project carousel ordered strictly by `export-809912-2109-20261101-191220.xlsx`, uncopyable SAP WBS column badges with orange past correction callouts, and combined September-October copy-paste support.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences from Phase 1 clarifications govern this implementation:
> 1. **Cutoff & Period Window**: The previous cutoff was August 31 / September 2026 (`2026-08` / `2026-09`). The user did not update Planisware in September and October. The system will display the baseline balance before September 1, 2026 in "Balance before this month", and combine September + October 2026 (through October 31, 2026) in "Add this month". Users can copy all project rows across the lifetime, but the informational text in the SAP WBS Element column is strictly stripped/cleared during clipboard operations so no warning text is copied into Planisware.
> 2. **Carousel Filtering**: Only projects with active differences between the old CJI3 file (`capex-export-CJI3.xlsx`) and the new CJI3 file (`CJI_export_01-11-2026.xlsx`) will be enrolled in the carousel navigation. If 12 projects have differences out of 100, the counter displays `1/12`, `2/12`, ..., `12/12`.
> 3. **Carousel Sequence**: The navigation order strictly matches row order from `export-809912-2109-20261101-191220.xlsx` (Sheet `'Kerem view'`).
> 4. **Past Corrections Detection**: If a past transaction was revised (amount decreased/increased compared to the old source), the SAP WBS Element column renders an uncopyable orange **`CORRECTION`** tag instead of the gray `PREVIOUS TOTAL` tag.

---

## 1. Overview & Core Concept

- **What It Does**: Integrates `CJI_export_01-11-2026.xlsx` as the primary active ledger snapshot through October 31, 2026 while retaining the legacy extract (`capex-export-CJI3.xlsx`) as the historical benchmark. A difference engine identifies all projects whose figures or postings changed, creates a sequential review queue matching the user's Planisware portfolio export, and provides next/previous navigation controls (`[< Prev]` `3/14` `[Next >]`) inside `PlaniswareView`.
- **Target Persona**: Project Managers and Financial Controllers maintaining CAPEX/OPEX external actuals manually in Planisware without double-entry errors or omitted past adjustments.
- **Key Value**: Eliminates manual scrolling through unaffected WBS elements, highlights revised past entries in high-visibility orange, combines missed September and October entries into clean batches, and guarantees that informational labels never contaminate the Planisware clipboard.

---

## 2. User Experience & Visual Design

### A. Layout Structure & Navigation Controls
- **Carousel Controls Bar**: Positioned directly underneath the Planisware data table and action toolbar in `PlaniswareView.tsx`:
  - **Left Arrow Button (`[< Prev]`)**: Disabled when on item 1.
  - **Sequential Progress Badge**: Clean tabular indicator e.g. `Project 3 of 14 requiring updates` with progress bar accent.
  - **Right Arrow Button (`[Next >]`)**: Transitions smoothly to the next modified project in the queue.
  - **Shortcut / Key Navigation**: Arrow keys (`ArrowLeft` / `ArrowRight`) trigger project switching when modal is active.
- **Queue Order**: Sorted 1:1 by row index in `export-809912-2109-20261101-191220.xlsx`.

### B. High-Fidelity Table & Uncopyable Warning Badges
- **SAP WBS Element Column (`sapWbsElement`)**:
  - For baseline entries (pre-September 2026): Renders a subtle slate badge `"Previous total"`.
  - For past corrections (entries prior to September 1, 2026 whose amounts changed in the new file): Renders a distinct orange badge `"CORRECTION"` (`bg-amber-100 text-amber-900 border border-amber-300 font-bold`).
  - For update entries (September 1 to October 31, 2026): Renders `"Add this period"` or the target WBS.
- **Clipboard Isolation**: When the user presses `Ctrl+C` or clicks the toolbar "Copy" icon, `copySelectionToClipboard` forcibly sets the `sapWbsElement` column to `""` (empty string) in both TSV and HTML clipboard tables. The user's Planisware paste receives blank text for that column, preventing accidental text contamination.

### C. Top Bar & Month Selector Restoration
- Restore `Navbar.tsx` which was temporarily truncated, ensuring the month selector includes `2026-10 (Through Oct 31)`, `2026-09`, and `2026-08`.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dual-Source Ledger Comparison Engine
- **Approach**: Keep `capex-export-CJI3.xlsx` registered as `baselineSnapshot` and parse `CJI_export_01-11-2026.xlsx` as `currentSnapshot`. Compare WBS vendor actual balances between the two files.
- **Why**: Allows instant detection of net new spending (Sept-Oct 2026) as well as retrospective adjustments made by accounting to earlier 2024–2025 or early 2026 ledger lines.

### Decision 2: Combined September + October Period Aggregation
- **Approach**: For the current reporting cycle, treat September 1 to October 31, 2026 as the active delta window (`addThisMonth` = spend between 2026-09-01 and 2026-10-31; `previousBalance` = cumulative balance as of 2026-08-31).
- **Why**: Directly satisfies the user's workflow constraint where September was skipped in Planisware and both months must be entered together.

### Decision 3: Strict Planisware Portfolio Row Ordering
- **Approach**: Extract the project ordering array directly from sheet `'Kerem view'` in `export-809912-2109-20261101-191220.xlsx`. The carousel filters down to projects with differences, but retains the exact relative order from this file.
- **Why**: Matches the user's sequential workflow in the Planisware application window, minimizing window-switching friction.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA EXTRACTION LAYER                           │
│                                                                        │
│  [capex-export-CJI3.xlsx]       [CJI_export_01-11-2026.xlsx]           │
│     (Baseline Ledger)                 (New Ledger through Oct 31)      │
│            │                                       │                   │
│            └───────────────────┬───────────────────┘                   │
│                                ▼                                       │
│                    [server/deltaEngine.ts]                             │
│                    • Baseline Cutoff: 2026-08-31                       │
│                    • Current Cutoff: 2026-10-31                        │
│                    • Detects Retrospective Corrections                │
│                                │                                       │
│                                ▼                                       │
│               [export-809912-2109-20261101-191220.xlsx]                │
│               (Extracts 'Kerem view' sequential project index)          │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND / CLIENT LAYER                           │
│                                                                        │
│  [PMScreen.tsx] ──────► [PlaniswareView.tsx Modal]                     │
│  • Filters projects     • Sequential Carousel: [< Prev] 2/14 [Next >]  │
│    with differences     • "sapWbsElement" column:                      │
│    vs baseline            - Baseline: "Previous total"                 │
│                           - Changed: "CORRECTION" (Amber/Orange)       │
│                         • Clipboard Interceptor:                       │
│                           - Strips info text -> outputs "" (Blank)     │
│                           - Copies all life-of-project rows            │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & File Changes
1. **`server/deltaEngine.ts` & `server/store.ts`**:
   - Ingest `CJI_export_01-11-2026.xlsx` as current committed snapshot.
   - Set baseline reference to pre-2026-09 transactions; calculate Sept+Oct additions.
   - Detect transactions prior to September 2026 that have value differences between old and new files; flag them with `isCorrection: true`.
2. **`server/planiswareSource.ts`**:
   - Extract ordered project WBS keys from `export-809912-2109-20261101-191220.xlsx` sheet `'Kerem view'`.
   - Expose endpoint or summary metadata for carousel sequence.
3. **`src/components/PlaniswareView.tsx`**:
   - Implement bottom carousel bar with `[< Prev]`, `X of Y`, and `[Next >]` buttons.
   - Order projects strictly by `export-809912-2109-20261101-191220.xlsx`.
   - Render uncopyable orange `CORRECTION` badges for past adjustments.
   - Update clipboard TSV/HTML generator to guarantee `sapWbsElement` is always copied as empty string `""`.
4. **`src/components/Navbar.tsx`**:
   - Restore the full navigation bar and add the `2026-10` reporting month selection.

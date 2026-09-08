# UX/UI Revamp — Design Spec

**Date:** 2026-09-08
**Status:** approved in brainstorming (direction B + C, one page, English copy)
**Scope:** `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`, `src/styles.scss`, `src/index.html`.
The converter (`src/app/converter/*`) only gains two additive result fields (see Interaction details).

## Goal

One centered page that takes a first-time visitor from "I have a Fitbod export" to "my history is in Hevy"
without reading documentation. Dark, gym-app feel with a single accent; the page itself is the
three-step guide and the progress indicator.

## Audience and context

- People migrating from Fitbod to Hevy, usually once, usually on a phone (the Fitbod export and the Hevy
  import both happen in the phone apps). Desktop drag-and-drop is a bonus, not the primary path.
- They do not know Hevy's import menu and do not know that Hevy allows one import per account.
- They must be able to check the result (set count, workout count, unmapped exercises) before importing.

## Page structure (single column, max-width 28rem, centered)

1. **Brand line** — small uppercase "Fitbod → Hevy" with an accent dot.
2. **Headline + lead** — `Bring your whole history with you.` /
   `From Fitbod to Hevy in three steps. Everything runs in your browser; nothing is uploaded.`
3. **Step rail** — three cards side by side (stacked on narrow screens):
   `1 Export` · `2 Convert` · `3 Import`. The rail is the progress indicator (see States).
4. **Work area** — shows the drop zone, the error card, or the receipt, in the same place, so the page
   does not jump.
5. **Next-step card** (only after a successful conversion) — `Step 3 · Import into Hevy` with the menu path
   and the one-import warning.
6. **Footer note** — the three conversion decisions in one line each: weights as logged (per dumbbell),
   warm-ups marked as warm-ups, 60-minute estimated duration because Fitbod exports no end time.

## States

| State | Rail | Work area |
|---|---|---|
| `idle` | 1 pending, **2 active**, 3 pending | Drop zone: icon, `Drop your WorkoutExport.csv here`, `or pick the file on your phone`, button `Choose file`. Trust line under it: `Stays on your device` · `Done in a second` · `Free, no account`. |
| `reading` | 1 done (`WorkoutExport.csv`), **2 active** (`Converting…`), 3 pending | Drop zone with the file name and a subtle progress pulse. Lasts milliseconds for normal files; exists so a 50 MB file does not look frozen. |
| `done` | 1 done, 2 done (`14 367 sets converted`), **3 active** (`Now in Hevy`) | **Receipt**: header `WorkoutExport.csv converted` with the date range of the workouts (`2023-10 → 2025-09`); three big numbers `sets` / `workouts` / `without mapping` (the last one in warning colour when > 0); a chip list of unmapped exercise names, first 6 visible + `+ N more` that expands in place; actions `Download again` (primary) and `Convert another file` (ghost). Headline changes to `Done. Check, then import.`; lead to `FitBodToHevyConvertedFile.csv has been downloaded.` |
| `error` | 1 done, **2 active**, 3 pending | Error card in the work area: the converter's message in plain words (e.g. `This does not look like a Fitbod export: missing column Weight(kg).`), a `Try another file` button that returns to `idle`. `role="alert"`. |

Transitions: `idle → reading` on file chosen or dropped; `reading → done | error`; `done → idle` via
`Convert another file` or by dropping a new file; `error → idle` via the button or a new file. A second file
dropped while in `done` simply starts a new conversion.

Rail semantics: a step is `done` when its outcome exists (1: a file was chosen; 2: a conversion result
exists), `active` when it is the next thing the user should do, otherwise `pending`. No timers; derived
from state with `computed()`.

## Visual system

- **Background** `#0b0d12`, surfaces `#12151c` / `#0f1218`, borders `#1f2430`, text `#eef0f4`, muted
  `#8b93a4`. A soft radial accent glow behind the headline (CSS only).
- **Accent** `#ff5a36` (orange-red) for the active step, primary button, headline emphasis, drag-over
  glow. Success `#2ecc71` for done steps and the receipt check. Warning `#ffb020` for "without mapping".
- **Type**: system UI stack (no external fonts). Headline 2rem/800/−0.02em; big numbers 1.75rem/800 with
  `font-variant-numeric: tabular-nums`; body 0.9rem; helper 0.75rem.
- **Shape**: 14px radius for the work area and receipt, 10px for step cards, 9px for buttons, pill chips.
- **Motion**: drag-over changes the border to accent and adds a glow (150 ms); switching the work area
  cross-fades (200 ms); rail state changes animate colour only. `prefers-reduced-motion` disables all.
- **Light mode**: not in scope. The page commits to the dark look and sets `color-scheme: dark` so form
  controls match.

## Interaction details

- The whole drop zone is the label of a hidden `<input type="file" accept=".csv,text/csv">`, so tapping
  anywhere on it opens the picker on phones. Keyboard: the `Choose file` button is a real `<button>` that
  triggers the input; the drop zone has `tabindex` and opens the picker on Enter/Space.
- Drag events are bound on the drop zone only (not `document`) so dropping elsewhere on the page does
  not navigate away; a `dragover` on the page body is prevented to avoid the browser opening the CSV.
- More than one file → error `Drop one file at a time: your Fitbod WorkoutExport.csv.`
- The download starts automatically on success (existing `saveFile` via object URL). `Download again`
  re-triggers it.
- The receipt's date range comes from the first and last workout timestamps (`YYYY-MM` each). The
  component cannot derive this from the CSV text, so `ConversionResult` gets two additive fields
  `firstWorkout: Date` and `lastWorkout: Date`. This is the only converter change, spec-covered.

## Copy (final, English)

- Title tag: `Fitbod to Hevy converter`
- Headline idle: `Bring your whole history with you.` — done: `Done. Check, then import.`
- Lead idle: `From Fitbod to Hevy in three steps. Everything runs in your browser; nothing is uploaded.`
  — done: `FitBodToHevyConvertedFile.csv has been downloaded.`
- Rail: `1 Export` `Fitbod → Log → ⋯ → Export Data` / `2 Convert` `Drop the file here` / `3 Import`
  `Hevy → Profile → Settings → Import data`
- Drop zone: `Drop your WorkoutExport.csv here` / `or pick the file on your phone` / `Choose file`
- Trust line: `Stays on your device` · `Done in a second` · `Free, no account`
- Receipt: `WorkoutExport.csv converted` · `sets` · `workouts` · `without mapping` ·
  `N exercises have no Hevy name and will be created as custom exercises:` · `+ N more` ·
  `Download again` · `Convert another file`
- Next-step card: `Step 3 · Import into Hevy` — `Open Hevy → Profile → Settings → Import data → Strong and
  pick the downloaded file. Hevy allows one import per account, so do this once the numbers above look right.`
- Error: `Conversion failed.` + converter message + `Try another file`
- Footer: `Weights are written as logged (per dumbbell). Warm-up sets are marked as warm-ups. Fitbod
  exports no end time, so every workout gets an estimated 60 minutes.`

## Accessibility

- Contrast ≥ 4.5:1 for all text on its surface (muted `#8b93a4` on `#12151c` is 5.6:1).
- Rail steps expose their state in text (`Step 2 of 3, current`) via visually hidden spans, not only colour.
- Status line `role="status"`, error `role="alert"`, receipt numbers in a `<dl>`.
- Focus rings visible on the accent (2px outline, offset 2px).

## Responsive

- ≥ 600px: rail three-across, receipt numbers three-across.
- < 600px: rail stacked (number + title on one line, hint below), numbers still three-across but smaller,
  chips wrap, buttons full width and stacked. The idle page fits an iPhone viewport without scrolling to
  reach `Choose file`.

## Testing

- Component specs (Vitest + TestBed, existing pattern): idle renders the drop zone and the rail with step 2
  active; success renders the receipt with the three numbers, the chip list (6 + more), the next-step card,
  and step 3 active; error renders the alert and the retry button; `Convert another file` returns to idle;
  two files → error; date range text for a fixture with two months.
- Converter spec addition: `firstWorkout`/`lastWorkout` on the result.
- Manual: drop the real export in the dev server (desktop), open on a phone-width viewport (375px) and
  check the idle page fits without scrolling.

## Non-goals

- Light theme, i18n, editing the exercise mappings in the UI, multiple files, persisting anything.

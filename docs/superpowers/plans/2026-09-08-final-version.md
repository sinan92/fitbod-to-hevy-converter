# Final Version Implementation Plan (Angular 22 upgrade + converter fixes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dependency-light, strict-mode Angular 22 app that converts a Fitbod `WorkoutExport.csv` into a Strong-format CSV that Hevy imports correctly (dates, warm-ups, weights, cardio), deployed over TLS, with the converter fully unit-tested.

**Architecture:** The converter is pure TypeScript with no Angular or DOM dependency (`src/app/converter/*`), tested with Vitest. One standalone, zoneless, signal-based `AppComponent` owns the drop zone, file reading and download. No moment, no file-saver, no ngx-file-drop, no Angular Material.

**Tech Stack:** Angular 22.1 (standalone, zoneless, signals), TypeScript strict, Vitest (Angular default test runner), Node 24 LTS, GitHub Actions + FTPS deploy to Strato.

## Global Constraints

- Node `^24.15.0` (Angular 22 engines). `.nvmrc` = `24`. CI uses `node-version: 24`.
- `tsconfig.json`: `strict: true`, `strictTemplates: true`.
- Runtime dependencies: `@angular/{core,common,compiler,platform-browser}`, `rxjs`, `tslib` only.
- Output CSV format stays the semicolon-separated Strong v2 layout the upstream author validated against Hevy:
  `Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration`
- Output file name stays `FitBodToHevyConvertedFile.csv`.
- No git commit/push without explicit user authorization (user CLAUDE.md).

## Decisions (evidence from /Users/sinan/Downloads/WorkoutExport.csv, 14 367 sets)

| # | Decision | Why |
|---|---|---|
| D1 | Drop `moment`; parse `YYYY-MM-DD HH:mm:ss ±HHMM` by hand into a `Date`, format in **local time**. | moment falls back to `new Date()` on this format (Safari/Firefox → Invalid date). Export is 100 % `+0000`; Strong/Hevy expect local wall-clock time. |
| D2 | Group a workout by the **full timestamp**, not the day. | Every Fitbod workout has exactly one timestamp; 68 days have two workouts that the old day-key merged. |
| D3 | **Do not multiply weight by `multiplier`.** Emit `Weight(kg)` as logged. | Fitbod's multiplier is a volume factor (2 = two dumbbells, 4 = two dumbbells × two legs, 0 = cardio/assisted). Hevy and Strong log per-dumbbell weight. Multiplying doubled every dumbbell set and zeroed Assisted Pull Up (18 kg → 0). |
| D4 | Warm-ups (`isWarmup=true`) get `Set Order` `W` and do not advance the working-set counter. | Strong's own convention, which the Hevy Strong importer consumes. 1 632 sets affected. |
| D5 | Map `Distance(m)` → `Distance` with `Distance Unit` `m`; `Duration(s)` → `Seconds`. | 242 elliptical/cycling sets carry distance today and lose it. |
| D6 | RFC-4180 line parsing (quoted fields, doubled quotes), header resolved **by name**, values trimmed, blank lines skipped, required columns validated. | Real file has leading spaces in numbers (` 10`, ` 1.0`) and 9 blank lines mid-file. Notes are free text. |
| D7 | CSV output escaping: quote when the field contains `;`, `"`, `\r` or `\n`; double inner quotes; `null` → empty; `0` stays `0`. | JSON.stringify escaping is not CSV; truthiness dropped zeros. |
| D8 | Replace `ngx-file-drop` (unmaintained since 2023) with a native drop zone + `<input type=file>`; replace `file-saver` with an `<a download>` + object URL. | Fewer dependencies = fewer future breakages. |
| D9 | Fresh `ng new` scaffold (Angular 22 defaults) and port the app, instead of eight sequential `ng update` hops. | 300 lines of app code; scaffold is the smaller diff. |
| D10 | Deploy over explicit FTPS (`protocol: ftps`, port 21). | Plain FTP sends the Strato password in cleartext. |

---

### Task 1: Scaffold Angular 22 and port the shell

**Files:**
- Replace: `package.json`, `package-lock.json`, `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `src/main.ts`, `src/index.html`, `src/styles.scss`
- Create: `src/app/app.config.ts`, `.nvmrc`
- Delete: `karma.conf.js`, `src/test.ts`, `src/polyfills.ts`, `src/environments/`, `.browserslistrc`, `src/app/app.module.ts`, `src/app/app-routing.module.ts`, `src/app/models/`

- [ ] Step 1: `ng new fitbod-to-hevy-converter --style=scss --routing=false --ssr=false --skip-git --skip-install --zoneless` in the scratchpad.
- [ ] Step 2: Copy scaffold config into the repo; keep `.editorconfig`, `.vscode`, `.claude`, `.github`, `README.md`, `docs/`.
- [ ] Step 3: `npm install`; `npx ng build` and `npx ng test` pass on the empty shell.

### Task 2: Fitbod CSV parser (`src/app/converter/fitbod-csv.ts`)

**Interfaces (Produces):**
```ts
export interface FitbodSet {
  date: Date;            // parsed from "YYYY-MM-DD HH:mm:ss ±HHMM"
  timestamp: string;     // raw Date column, used as workout key
  exercise: string;
  reps: number;
  weightKg: number;
  durationS: number;
  distanceM: number;
  isWarmup: boolean;
  note: string;
}
export class FitbodParseError extends Error {}
export function parseFitbodCsv(text: string): FitbodSet[]; // throws FitbodParseError
export function parseCsvLine(line: string, separator: string): string[]; // RFC-4180 aware
export function parseFitbodDate(raw: string): Date; // throws FitbodParseError on bad input
```
- [ ] Tests first (`fitbod-csv.spec.ts`): header by name in any order; leading-space numbers; blank lines; quoted note with comma; missing multiplier column is fine; missing `Weight(kg)` throws; `+0000` and `+0200` both produce the right instant; malformed date throws.
- [ ] Implement; run `npx ng test`.

### Task 3: Hevy rows + CSV writer (`src/app/converter/hevy-csv.ts`)

**Interfaces (Produces):**
```ts
export interface HevyRow { /* the 14 Strong v2 columns, typed */ }
export const HEVY_COLUMNS: readonly (keyof HevyRow)[];
export function toHevyRows(sets: FitbodSet[], mappings: Readonly<Record<string,string>>): HevyRow[];
export function serializeHevyCsv(rows: HevyRow[]): string;
export function formatLocalDateTime(d: Date): string; // "YYYY-MM-DD HH:mm:ss" local
```
- [ ] Tests first: set numbering resets per workout timestamp (two workouts same day stay separate); warm-up → `W`; weight not multiplied; distance/seconds mapped; zero weight stays `0`; field with `;` or `"` is quoted and doubled; local-time formatting (use a fixed `Date` and `toLocaleString`-independent expectation); CRLF row ending; `Workout Duration` = `60m`.
- [ ] Implement; run tests.

### Task 4: Exercise mappings + convert facade

**Files:** `src/app/converter/exercise-mappings.ts` (moved verbatim), `src/app/converter/convert.ts`
```ts
export interface ConversionResult {
  csv: string; setCount: number; workoutCount: number; warmupCount: number;
  unmappedExercises: string[]; // sorted, unique
}
export function convertFitbodExport(text: string): ConversionResult; // throws FitbodParseError
```
- [ ] Tests: end-to-end on a synthetic 12-row fixture mirroring the real file (spaces, blank lines, warm-ups, cardio, note); unmapped list; mapping-table sanity (trimmed, non-empty, no bare "Hip Thrust").
- [ ] Implement; run tests.

### Task 5: AppComponent (standalone, signals)

**Files:** `src/app/app.component.ts|html|scss`, `src/app/app.component.spec.ts`
- Signals: `status`, `error`, `result`, `fileName`, `dragging`.
- Native `dragover/dragleave/drop` handlers + hidden `<input type="file" accept=".csv,text/csv">`.
- `readFile(file: File): Promise<string>` via `file.text()`.
- `download()` creates an object URL, clicks an `<a download>`, revokes the URL.
- Only one file at a time; a second file replaces the first; folders/multiple files → error.
- Shows: set count, workout count, warm-up count, unmapped exercise names (collapsed list), "Download again".
- [ ] Component tests with TestBed (Vitest): success path renders counts and triggers download once; parse error renders `role=alert`; two files → error.

### Task 6: Real-file validation (evidence, not committed)

- [ ] Script in scratchpad runs `convertFitbodExport` over `/Users/sinan/Downloads/WorkoutExport.csv`; assert: 14 367 rows, no `NaN`, no `Invalid`, workout count == distinct timestamps, warm-up count 1 632, Assisted Pull Up keeps 18 kg, Elliptical keeps distance.

### Task 7: Deploy + docs

- [ ] `.github/workflows/deploy.yml`: node 24, `npx ng test` (Vitest, no browser flags), `protocol: ftps`, `port: 21`, output dir `dist/fitbod-to-hevy-converter/browser/`.
- [ ] README: what the app does, how to export from Fitbod, how to import into Hevy, the decisions table above (D1–D8), how to run/test/deploy.
- [ ] Remove `docs/superpowers` from nothing — keep this plan as the record.

### Task 8: Verification gate

- [ ] `npm ci && npx ng test && npx ng build` clean (no warnings), bundle < 500 kB budget.
- [ ] Browser check via preview: drop the real file, download starts, counts shown.

---

## Progress log (2026-09-08)

| Task | Status | Evidence |
|---|---|---|
| 1 Scaffold Angular 22 | done | `npx ng version` → CLI 22.1.7, Node 24.20.0; `ng build` 127 kB, 0 warnings |
| 2 Fitbod parser | done | `src/app/converter/fitbod-csv.spec.ts` (14 specs) |
| 3 Hevy writer | done | `src/app/converter/hevy-csv.spec.ts` |
| 4 Mappings + facade | done | `src/app/converter/convert.spec.ts`; 106 mappings ported verbatim |
| 5 App component | done | `src/app/app.spec.ts` (5 specs, TestBed + zoneless) |
| 6 Real-file validation | done | scratchpad `real-export.spec.ts` (not committed): 14 367 sets, 1 632 W, 222 unmapped, 429 rows with `m` distance, no NaN/Invalid, every row 14 columns |
| 7 Deploy + docs | done (not exercised) | `deploy.yml` → node from `.nvmrc`, Vitest, SFTP via lftp (taken from origin/main 5b9f6ac; this Strato package resets FTP/FTPS), `browser/` output dir; README rewritten |
| 8 Verification gate | `ng test` 58/58, `ng build` clean; browser check: see session |

**Not verified:** an actual Hevy import of the generated file (only the user can do that, once). The `m`
distance unit and the bare `W` set order follow Strong's conventions as documented by third-party tools,
not by a Hevy sample file.

**Rollback:** `git checkout -- . && git clean -fd` restores the committed Angular 14 tree; the pre-upgrade
working tree (with the earlier uncommitted session work) is in the session scratchpad as
`pre-upgrade-backup.tgz`.

**Next:** commit (not done: no authorization in this session), push to `main` → deploy runs; then the UX/UI
revamp with the `frontend-design` skill on `src/app/app.{ts,html,scss}` only — the converter needs no change.

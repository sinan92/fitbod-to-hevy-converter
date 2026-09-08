# Fitbod → Hevy converter

Converts a Fitbod `WorkoutExport.csv` into a Strong-format CSV that [Hevy](https://www.hevyapp.com/) imports.
Everything runs in the browser; no data leaves your machine.

## Use it

1. In Fitbod: **Log → ⋯ → Export Data**. You get `WorkoutExport.csv`.
2. Open the converter and drop the file. `FitBodToHevyConvertedFile.csv` downloads automatically.
3. In Hevy: **Profile → Settings → Import data → Strong** and pick the downloaded file.

Hevy allows one import per account, so check the converted file first. The converter shows the number of sets,
workouts and warm-ups it found and lists every exercise name that has no Hevy mapping (those are imported as
custom exercises).

## What the converter does

| Fitbod | Hevy (Strong format) | Notes |
|---|---|---|
| `Date` (`YYYY-MM-DD HH:mm:ss +0000`, one per workout) | `Date`, `Workout Name` | Converted to your local time. Two workouts on one day stay separate. |
| `Exercise` | `Exercise Name` | Mapped through `src/app/converter/exercise-mappings.ts`; unknown names pass through unchanged. |
| set sequence | `Set Order` | Working sets are numbered per exercise per workout. |
| `isWarmup` | `Set Order` = `W` | Warm-ups are marked as warm-ups and do not count as working sets. |
| `Weight(kg)` | `Weight` (`kg`) | **Written as logged.** Fitbod's `multiplier` column (2 for a pair of dumbbells, 4 for lunges, 0 for cardio/assisted) is a volume factor and is not applied: Hevy logs per-dumbbell weight. |
| `Reps` | `Reps` | |
| `Duration(s)` | `Seconds` | |
| `Distance(m)` | `Distance` (`m`) | Only written when > 0. |
| `Note` | `Notes` | |
| — | `Workout Duration` = `60m` | Fitbod exports no end time, so this is an estimate. |

Input handling: columns are looked up by header name, values are trimmed (Fitbod pads numbers with a space),
blank lines and a UTF-8 BOM are ignored, quoted fields with commas are supported. Anything that is not a Fitbod
export is rejected with a message that names the missing column or the bad row.

## Develop

Requires Node 24 (`.nvmrc`). Angular 22, standalone + zoneless, Vitest.

```bash
npm ci
npm start          # http://localhost:4200
npm test           # vitest, once
npm run build      # dist/fitbod-to-hevy-converter/browser
```

The converter itself (`src/app/converter/`) has no Angular or DOM dependency and is fully unit-tested;
`app.ts` only owns the drop zone, file reading and the download.

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds and uploads `dist/fitbod-to-hevy-converter/browser` to
Strato over FTPS on every push to `main`. Secrets: `STRATO_FTP_USERNAME`, `STRATO_FTP_PASSWORD`,
`STRATO_SERVER_PATH`; optional variable `BASE_HREF` when the app is not served from the web root.

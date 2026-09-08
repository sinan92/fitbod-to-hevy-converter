# Fitbod to Hevy converter

**Use it: https://sintaxcode.nl/fitbod-to-hevy-converter/** — runs in the browser, nothing is uploaded.

Hevy only imports CSV files in the Strong app's format. This converter turns a Fitbod `WorkoutExport.csv` into
that format so a Fitbod workout history can be imported into [Hevy](https://www.hevyapp.com/): every workout,
set, weight, rep, warm-up and note.

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

### Input formats

| Format | How you get it | Header |
|---|---|---|
| Fitbod app export | Fitbod → Log → ⋯ → Export Data (iOS) | `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier` |
| Fitbod support export | Android has no export; Fitbod support mails a database extract | `date,exercise_name,Reps,weight_kg,duration_seconds,distance_meters,Incline,Resistance,isWarmup` |
| Any other CSV | Map the columns yourself | The page asks which column is the date, exercise, reps and weight (plus optional duration, distance, warm-up flag, note) |

The support export has no time of day, so all sets of one day become one workout; weights are rounded to
0.01 kg and distances to 0.1 m because that export carries lb-to-kg conversion noise. Formats live in
`src/app/converter/column-mapping.ts`: a format is a named column mapping, and a manual mapping is the same
object filled in by the user.

## Develop

Requires Node 24 (`.nvmrc`). Angular 22, standalone + zoneless, Vitest.

```bash
npm ci
npm start          # http://localhost:4200
npm test           # vitest, once
npm run build      # dist/fitbod-to-hevy-converter/browser
```

The converter itself (`src/app/converter/`) has no Angular or DOM dependency and is fully unit-tested;
`app.ts` only owns the drop zone, file reading and the download. Errors that escape a handler are shown in a
banner (`visible-error-handler.ts`), never only in the console.

The build prerenders the single route at build time (`outputMode: "static"`, `src/main.server.ts`,
`src/app/app.config.server.ts`), so `browser/index.html` already contains the page text and the app hydrates
on load. There is no Node server; anything that touches `window`, `document` or `navigator` outside an event
handler must be guarded.

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds and uploads `dist/fitbod-to-hevy-converter/browser` to
Strato over SFTP (lftp) on every push to `main`. The runner image and the actions are pinned (image tag and
commit SHAs) so a deploy years from now runs the same steps; bump them deliberately. This Strato package only offers SFTP + SSH; plain FTP and
FTPS reset the connection. GitHub environment `STRATO` needs the secrets `STRATO_SFTP_SERVER`,
`STRATO_FTP_USERNAME`, `STRATO_FTP_PASSWORD`, `STRATO_SERVER_PATH` and the variables `BASE_HREF`
(`/fitbod-to-hevy-converter/` on the current host; defaults to `/`). `SITE_URL`
(`https://sintaxcode.nl/fitbod-to-hevy-converter/`) is the public URL the last workflow step curls to verify
that the deploy landed.

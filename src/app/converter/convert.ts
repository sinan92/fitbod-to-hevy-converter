import { EXERCISE_MAPPINGS } from './exercise-mappings';
import { FitbodParseError, parseFitbodCsv } from './fitbod-csv';
import { serializeHevyCsv, toHevyRows } from './hevy-csv';

export const OUTPUT_FILE_NAME = 'FitBodToHevyConvertedFile.csv';

export interface ConversionResult {
    /** The Strong-format CSV to import into Hevy. */
    csv: string;
    setCount: number;
    workoutCount: number;
    warmupCount: number;
    /** Fitbod exercise names with no Hevy mapping, sorted and unique. They are passed through as-is. */
    unmappedExercises: string[];
}

/** Converts the text of a Fitbod WorkoutExport.csv. Throws {@link FitbodParseError} on invalid input. */
export function convertFitbodExport(text: string): ConversionResult {
    const sets = parseFitbodCsv(text);
    if (sets.length === 0) {
        throw new FitbodParseError('The export contains no sets.');
    }
    const rows = toHevyRows(sets, EXERCISE_MAPPINGS);
    const unmapped = new Set(sets.filter((s) => !EXERCISE_MAPPINGS.has(s.exercise)).map((s) => s.exercise));
    return {
        csv: serializeHevyCsv(rows),
        setCount: sets.length,
        workoutCount: new Set(sets.map((s) => s.timestamp)).size,
        warmupCount: sets.filter((s) => s.isWarmup).length,
        unmappedExercises: [...unmapped].sort((a, b) => a.localeCompare(b)),
    };
}

import { EXERCISE_MAPPINGS } from './exercise-mappings';
import { ColumnMapping } from './column-mapping';
import { FitbodParseError, readFitbodCsv } from './fitbod-csv';
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
    /** Earliest workout start, for display. */
    firstWorkout: Date;
    /** Latest workout start, for display. */
    lastWorkout: Date;
    /** Which input format was recognised (e.g. "Fitbod app export"), or "Manual column mapping". */
    format: string;
}

/**
 * Converts the text of a Fitbod export. Known formats are recognised from the header; pass a manual
 * `mapping` for any other CSV. Throws {@link FitbodParseError} on invalid input; the subclass
 * {@link UnknownFormatError} carries the header and a suggested mapping when no format matches.
 */
export function convertFitbodExport(text: string, mapping?: ColumnMapping): ConversionResult {
    const { sets, format } = readFitbodCsv(text, mapping);
    if (sets.length === 0) {
        throw new FitbodParseError('The export contains no sets.');
    }
    const rows = toHevyRows(sets, EXERCISE_MAPPINGS);
    const unmapped = new Set(sets.filter((s) => !EXERCISE_MAPPINGS.has(s.exercise)).map((s) => s.exercise));
    // A loop, not Math.min(...times): spreading a long export as call arguments overflows the call stack.
    let first = sets[0].date.getTime();
    let last = first;
    for (const set of sets) {
        const time = set.date.getTime();
        first = Math.min(first, time);
        last = Math.max(last, time);
    }
    return {
        csv: serializeHevyCsv(rows),
        setCount: sets.length,
        workoutCount: new Set(sets.map((s) => s.timestamp)).size,
        warmupCount: sets.filter((s) => s.isWarmup).length,
        unmappedExercises: [...unmapped].sort((a, b) => a.localeCompare(b)),
        firstWorkout: new Date(first),
        lastWorkout: new Date(last),
        format,
    };
}

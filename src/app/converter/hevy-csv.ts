import { FitbodSet } from './fitbod-csv';

/**
 * One row of the Strong-format CSV that Hevy imports. Column names and order are Strong's
 * (semicolon separated, with unit columns); Hevy's importer expects exactly this layout.
 */
export interface HevyRow {
    Date: string;
    'Workout Name': string;
    'Exercise Name': string;
    /** 1-based working-set number within the exercise of one workout; 'W' marks a warm-up set. */
    'Set Order': number | 'W';
    Weight: number;
    'Weight Unit': 'kg';
    Reps: number;
    RPE: number | null;
    Distance: number | null;
    'Distance Unit': 'm' | null;
    Seconds: number;
    Notes: string;
    'Workout Notes': string;
    'Workout Duration': string;
}

export const HEVY_COLUMNS = [
    'Date',
    'Workout Name',
    'Exercise Name',
    'Set Order',
    'Weight',
    'Weight Unit',
    'Reps',
    'RPE',
    'Distance',
    'Distance Unit',
    'Seconds',
    'Notes',
    'Workout Notes',
    'Workout Duration',
] as const satisfies readonly (keyof HevyRow)[];

/** Columns that are always written quoted, like Strong does for free text. */
const QUOTED_COLUMNS: ReadonlySet<keyof HevyRow> = new Set(['Workout Name', 'Exercise Name', 'Notes', 'Workout Notes']);

export const CSV_SEPARATOR = ';';
export const CSV_LINE_ENDING = '\r\n';

/**
 * Fitbod's export carries only a start timestamp per workout and no end time, so the real
 * workout length cannot be derived. Hevy requires a value; this is an estimate.
 */
export const ESTIMATED_WORKOUT_DURATION = '60m';
export const WORKOUT_NAME_PREFIX = 'Workout on: ';

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in the local time zone. */
export function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD HH:mm:ss" in the local time zone, which is what Strong exports and Hevy reads. */
export function formatLocalDateTime(d: Date): string {
    return `${formatLocalDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Maps Fitbod sets to Hevy rows.
 * - Sets are grouped by Fitbod's workout timestamp, so two workouts on one day stay separate.
 * - Warm-up sets get Set Order "W" (Strong's convention) and do not advance the working-set count.
 * - Weight is written as logged. Fitbod's "multiplier" column is a volume factor (2 for a pair of
 *   dumbbells, 0 for cardio and assisted work) and must not be applied: Hevy logs per-dumbbell weight.
 */
export function toHevyRows(sets: readonly FitbodSet[], mappings: ReadonlyMap<string, string>): HevyRow[] {
    const workingSetCount = new Map<string, number>();
    return sets.map((set) => {
        let setOrder: number | 'W';
        if (set.isWarmup) {
            setOrder = 'W';
        } else {
            const key = `${set.timestamp} ${set.exercise}`;
            setOrder = (workingSetCount.get(key) ?? 0) + 1;
            workingSetCount.set(key, setOrder);
        }
        const hasDistance = set.distanceM > 0;
        return {
            Date: formatLocalDateTime(set.date),
            'Workout Name': WORKOUT_NAME_PREFIX + formatLocalDate(set.date),
            'Exercise Name': mappings.get(set.exercise) ?? set.exercise,
            'Set Order': setOrder,
            Weight: set.weightKg,
            'Weight Unit': 'kg',
            Reps: set.reps,
            RPE: null,
            Distance: hasDistance ? set.distanceM : null,
            'Distance Unit': hasDistance ? 'm' : null,
            Seconds: set.durationS,
            Notes: set.note,
            'Workout Notes': '',
            'Workout Duration': ESTIMATED_WORKOUT_DURATION,
        };
    });
}

/** Quotes a field when needed and doubles inner quotes (RFC 4180). `null` becomes an empty field. */
export function escapeCsvField(value: string | number | null, alwaysQuote = false): string {
    if (value === null) {
        return '';
    }
    const text = String(value);
    const needsQuotes = alwaysQuote || text.includes(CSV_SEPARATOR) || /["\r\n]/.test(text);
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialises rows to Strong-format CSV: semicolon separated, CRLF line endings, header first. */
export function serializeHevyCsv(rows: readonly HevyRow[]): string {
    const lines = [
        HEVY_COLUMNS.join(CSV_SEPARATOR),
        ...rows.map((row) => HEVY_COLUMNS.map((c) => escapeCsvField(row[c], QUOTED_COLUMNS.has(c))).join(CSV_SEPARATOR)),
    ];
    return lines.join(CSV_LINE_ENDING);
}

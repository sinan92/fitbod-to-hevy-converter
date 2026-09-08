/**
 * Which CSV column feeds which field of a set. Values are header names as they appear in the file
 * (matched case-insensitively). A known input format is just a named mapping; a manual mapping is
 * the same object built by the user.
 */
export interface ColumnMapping {
    date: string;
    exercise: string;
    reps: string;
    weight: string;
    duration?: string;
    distance?: string;
    warmup?: string;
    note?: string;
}

export type MappingField = keyof ColumnMapping;

export const REQUIRED_FIELDS = ['date', 'exercise', 'reps', 'weight'] as const;
export const OPTIONAL_FIELDS = ['duration', 'distance', 'warmup', 'note'] as const;
export const ALL_FIELDS: readonly MappingField[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

/** What to call each field when asking the user to map columns. */
export const FIELD_LABELS: Readonly<Record<MappingField, string>> = {
    date: 'Workout date',
    exercise: 'Exercise name',
    reps: 'Reps',
    weight: 'Weight in kg',
    duration: 'Duration in seconds',
    distance: 'Distance in meters',
    warmup: 'Warm-up flag',
    note: 'Note',
};

export interface InputFormat {
    id: string;
    /** Shown on the receipt, e.g. "Fitbod app export". */
    name: string;
    mapping: ColumnMapping;
}

/**
 * The input formats recognised automatically. Order matters: the first format whose required columns
 * are all present wins. Add a new source by adding an entry here plus a fixture in the specs.
 */
export const INPUT_FORMATS: readonly InputFormat[] = [
    {
        id: 'fitbod-app',
        name: 'Fitbod app export',
        mapping: {
            date: 'Date',
            exercise: 'Exercise',
            reps: 'Reps',
            weight: 'Weight(kg)',
            duration: 'Duration(s)',
            distance: 'Distance(m)',
            warmup: 'isWarmup',
            note: 'Note',
        },
    },
    {
        // Android has no in-app export; Fitbod support mails a database extract instead.
        // Date only (no time), snake_case names, empty cells for missing numbers, kg converted from lb.
        id: 'fitbod-support',
        name: 'Fitbod support export',
        mapping: {
            date: 'date',
            exercise: 'exercise_name',
            reps: 'Reps',
            weight: 'weight_kg',
            duration: 'duration_seconds',
            distance: 'distance_meters',
            warmup: 'isWarmup',
        },
    },
];

export const MANUAL_FORMAT_NAME = 'Manual column mapping';

const normalize = (name: string) => name.trim().toLowerCase();

/** The first known format whose required columns all occur in the header, or null. */
export function detectFormat(header: readonly string[]): InputFormat | null {
    const names = new Set(header.map(normalize));
    return INPUT_FORMATS.find((format) => REQUIRED_FIELDS.every((field) => names.has(normalize(format.mapping[field])))) ?? null;
}

/** Column index per field for this header; -1 for optional fields that are not mapped or not present. */
export function resolveColumns(header: readonly string[], mapping: ColumnMapping): Record<MappingField, number> {
    const indexOf = (name: string | undefined) => (name === undefined ? -1 : header.findIndex((h) => normalize(h) === normalize(name)));
    const columns = Object.fromEntries(ALL_FIELDS.map((field) => [field, indexOf(mapping[field])])) as Record<MappingField, number>;
    const missing = REQUIRED_FIELDS.filter((field) => columns[field] < 0).map((field) => mapping[field]);
    if (missing.length > 0) {
        throw new MissingColumnsError(missing);
    }
    return columns;
}

export class MissingColumnsError extends Error {
    constructor(readonly missing: readonly string[]) {
        super(`missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`);
        this.name = 'MissingColumnsError';
    }
}

const GUESS_RULES: readonly [MappingField, RegExp][] = [
    ['date', /date|^time$|timestamp|when|day/i],
    ['exercise', /exercise|movement|lift|name/i],
    ['reps', /rep/i],
    ['weight', /weight|kg|lbs?|load/i],
    ['duration', /duration|second|sec\b|elapsed/i],
    ['distance', /distance|meter|metre|km|mile/i],
    ['warmup', /warm/i],
    ['note', /note|comment|remark/i],
];

/**
 * Best guess at a mapping for an unknown header, to prefill the manual mapping form. Each header
 * column is used at most once; fields with no plausible column are left out.
 */
export function guessMapping(header: readonly string[]): Partial<ColumnMapping> {
    const guess: Partial<ColumnMapping> = {};
    const used = new Set<string>();
    for (const [field, pattern] of GUESS_RULES) {
        const column = header.find((h) => !used.has(h) && pattern.test(h));
        if (column !== undefined) {
            guess[field] = column;
            used.add(column);
        }
    }
    return guess;
}

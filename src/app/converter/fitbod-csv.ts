/** One logged set, as read from Fitbod's WorkoutExport.csv. */
export interface FitbodSet {
    /** Raw value of the Date column. Every set of one workout shares it, so it doubles as the workout key. */
    timestamp: string;
    /** The same instant as `timestamp`, parsed with its UTC offset applied. */
    date: Date;
    exercise: string;
    reps: number;
    weightKg: number;
    durationS: number;
    distanceM: number;
    isWarmup: boolean;
    note: string;
}

/** Thrown when the text is not a Fitbod export or a row cannot be read. The message is safe to show to the user. */
export class FitbodParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FitbodParseError';
    }
}

const REQUIRED_COLUMNS = ['Date', 'Exercise', 'Reps', 'Weight(kg)'] as const;

/**
 * Splits CSV text into rows of fields (RFC 4180): quoted fields may contain the separator,
 * doubled quotes and line breaks. Accepts LF, CRLF and CR line endings. Blank rows are dropped.
 */
export function parseCsv(text: string, separator = ','): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const endField = () => {
        row.push(field);
        field = '';
    };
    const endRow = () => {
        endField();
        if (row.some((f) => f.trim() !== '')) {
            rows.push(row);
        }
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === separator) {
            endField();
        } else if (ch === '\n') {
            endRow();
        } else if (ch === '\r') {
            if (text[i + 1] !== '\n') {
                endRow();
            }
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        endRow();
    }
    return rows;
}

const FITBOD_DATE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*([+-])(\d{2}):?(\d{2}))?$/;

/**
 * Parses Fitbod's "YYYY-MM-DD HH:mm:ss +HHMM" timestamp. Done by hand because the format is not
 * ISO 8601 and `new Date(string)` rejects it on Safari and Firefox. Without an offset the time is
 * taken as local.
 */
export function parseFitbodDate(raw: string): Date {
    const m = FITBOD_DATE.exec(raw.trim());
    if (!m) {
        throw new FitbodParseError(`Unrecognised date "${raw}" (expected "YYYY-MM-DD HH:mm:ss +HHMM").`);
    }
    const [, y, mo, d, h, mi, s, sign, oh, om] = m;
    const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
    let date: Date;
    if (sign === undefined) {
        date = new Date(year, month - 1, day, hour, minute, second);
    } else {
        const offsetMinutes = (sign === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om));
        date = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000);
    }
    if (Number.isNaN(date.getTime()) || month < 1 || month > 12 || day < 1 || day > 31) {
        throw new FitbodParseError(`Invalid date "${raw}".`);
    }
    return date;
}

function parseNumber(value: string, column: string, rowNumber: number): number {
    if (value === '') {
        return 0;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new FitbodParseError(`Row ${rowNumber}: "${value}" in column ${column} is not a number.`);
    }
    return n;
}

/**
 * Reads a Fitbod WorkoutExport.csv. Columns are resolved by header name, so their order does not
 * matter and optional columns (Duration(s), Distance(m), isWarmup, Note, multiplier) may be absent.
 * Values are trimmed because Fitbod pads numbers with a leading space.
 */
export function parseFitbodCsv(text: string): FitbodSet[] {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (rows.length === 0) {
        throw new FitbodParseError('The file is empty.');
    }
    const header = rows[0].map((h) => h.trim());
    const column = (name: string) => header.indexOf(name);
    const missing = REQUIRED_COLUMNS.filter((name) => column(name) < 0);
    if (missing.length > 0) {
        throw new FitbodParseError(
            `This does not look like a Fitbod export: missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}.`,
        );
    }
    const index = {
        date: column('Date'),
        exercise: column('Exercise'),
        reps: column('Reps'),
        weight: column('Weight(kg)'),
        duration: column('Duration(s)'),
        distance: column('Distance(m)'),
        warmup: column('isWarmup'),
        note: column('Note'),
    };

    const sets: FitbodSet[] = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cell = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '');
        const exercise = cell(index.exercise);
        if (exercise === '') {
            throw new FitbodParseError(`Row ${r}: missing exercise name.`);
        }
        const timestamp = cell(index.date);
        let date: Date;
        try {
            date = parseFitbodDate(timestamp);
        } catch (e) {
            throw new FitbodParseError(`Row ${r}: ${e instanceof Error ? e.message : String(e)}`);
        }
        sets.push({
            timestamp,
            date,
            exercise,
            reps: Math.round(parseNumber(cell(index.reps), 'Reps', r)),
            weightKg: parseNumber(cell(index.weight), 'Weight(kg)', r),
            durationS: parseNumber(cell(index.duration), 'Duration(s)', r),
            distanceM: parseNumber(cell(index.distance), 'Distance(m)', r),
            isWarmup: cell(index.warmup).toLowerCase() === 'true',
            note: cell(index.note),
        });
    }
    return sets;
}

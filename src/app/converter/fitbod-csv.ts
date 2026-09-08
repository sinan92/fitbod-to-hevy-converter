import {
    ColumnMapping,
    detectFormat,
    guessMapping,
    INPUT_FORMATS,
    MANUAL_FORMAT_NAME,
    MissingColumnsError,
    REQUIRED_FIELDS,
    resolveColumns,
} from './column-mapping';

/** One logged set, as read from a Fitbod export. */
export interface FitbodSet {
    /** Raw value of the date column. Every set of one workout shares it, so it doubles as the workout key. */
    timestamp: string;
    /** The same instant as `timestamp`, parsed with its UTC offset applied (local midnight when there is no time). */
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

/**
 * The header matches none of the known formats. Carries what the UI needs to offer a manual mapping:
 * the columns found and a best guess at which column is which.
 */
export class UnknownFormatError extends FitbodParseError {
    constructor(
        message: string,
        readonly header: readonly string[],
        readonly suggestion: Partial<ColumnMapping>,
    ) {
        super(message);
        this.name = 'UnknownFormatError';
    }
}

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

const FITBOD_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\s*([+-])(\d{2}):?(\d{2}))?)?$/;

/**
 * Parses Fitbod's "YYYY-MM-DD HH:mm:ss +HHMM" timestamp. Done by hand because the format is not
 * ISO 8601 and `new Date(string)` rejects it on Safari and Firefox. Without an offset the time is
 * taken as local; without a time (the support export) the date means local midnight.
 */
export function parseFitbodDate(raw: string): Date {
    const m = FITBOD_DATE.exec(raw.trim());
    if (!m) {
        throw new FitbodParseError(`Unrecognised date "${raw}" (expected "YYYY-MM-DD HH:mm:ss +HHMM" or "YYYY-MM-DD").`);
    }
    const [, y, mo, d, h = '0', mi = '0', s = '0', sign, oh, om] = m;
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

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;

export interface ParsedExport {
    sets: FitbodSet[];
    /** Name of the format that was recognised, or the manual-mapping label. Shown on the receipt. */
    format: string;
}

/**
 * Reads a Fitbod export of any known format, or of any CSV when a manual column mapping is given.
 * Columns are resolved by header name (case-insensitive), so their order does not matter and optional
 * columns may be absent. Values are trimmed because Fitbod pads numbers with a leading space; empty
 * numeric cells count as 0; weights are rounded to 0.01 kg and distances to 0.1 m because the support
 * export carries lb-to-kg conversion noise such as 31.751465900000003.
 */
export function readFitbodCsv(text: string, manualMapping?: ColumnMapping): ParsedExport {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (rows.length === 0) {
        throw new FitbodParseError('The file is empty.');
    }
    const header = rows[0].map((h) => h.trim());

    let mapping: ColumnMapping;
    let format: string;
    if (manualMapping) {
        mapping = manualMapping;
        format = MANUAL_FORMAT_NAME;
    } else {
        const detected = detectFormat(header);
        if (!detected) {
            // Phrase the error in terms of the app export, the format almost everyone has.
            const primary = INPUT_FORMATS[0].mapping;
            const names = new Set(header.map((h) => h.toLowerCase()));
            const missing = REQUIRED_FIELDS.map((field) => primary[field]).filter((name) => !names.has(name.toLowerCase()));
            throw new UnknownFormatError(
                `This does not look like a Fitbod export: missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}.`,
                header,
                guessMapping(header),
            );
        }
        mapping = detected.mapping;
        format = detected.name;
    }

    let columns;
    try {
        columns = resolveColumns(header, mapping);
    } catch (e) {
        if (e instanceof MissingColumnsError) {
            throw new UnknownFormatError(`The mapped columns are not in this file: ${e.missing.join(', ')}.`, header, guessMapping(header));
        }
        throw e;
    }
    const label = (field: keyof ColumnMapping) => mapping[field] ?? field;

    const sets: FitbodSet[] = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cell = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '');
        const exercise = cell(columns.exercise);
        if (exercise === '') {
            throw new FitbodParseError(`Row ${r}: missing exercise name.`);
        }
        const timestamp = cell(columns.date);
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
            reps: Math.round(parseNumber(cell(columns.reps), label('reps'), r)),
            weightKg: round(parseNumber(cell(columns.weight), label('weight'), r), 2),
            durationS: parseNumber(cell(columns.duration), label('duration'), r),
            distanceM: round(parseNumber(cell(columns.distance), label('distance'), r), 1),
            isWarmup: cell(columns.warmup).toLowerCase() === 'true',
            note: cell(columns.note),
        });
    }
    return { sets, format };
}

/** The sets of a Fitbod export. See {@link readFitbodCsv}; this is the same without the format name. */
export function parseFitbodCsv(text: string, manualMapping?: ColumnMapping): FitbodSet[] {
    return readFitbodCsv(text, manualMapping).sets;
}

import { FitbodSet } from './fitbod-csv';
import {
    ESTIMATED_WORKOUT_DURATION,
    escapeCsvField,
    formatLocalDateTime,
    HEVY_COLUMNS,
    serializeHevyCsv,
    toHevyRows,
} from './hevy-csv';

const MAPPINGS = new Map([['Back Squat', 'Squat (Barbell)']]);

function set(overrides: Partial<FitbodSet> = {}): FitbodSet {
    const timestamp = overrides.timestamp ?? '2025-01-19 09:37:32 +0000';
    return {
        timestamp,
        date: new Date(timestamp.replace(' ', 'T').replace(' +0000', 'Z')),
        exercise: 'Back Squat',
        reps: 5,
        weightKg: 100,
        durationS: 0,
        distanceM: 0,
        isWarmup: false,
        note: '',
        ...overrides,
    };
}

describe('toHevyRows', () => {
    it('maps a known exercise and passes an unknown one through', () => {
        const rows = toHevyRows([set(), set({ exercise: 'Some Custom Move' })], MAPPINGS);
        expect(rows.map((r) => r['Exercise Name'])).toEqual(['Squat (Barbell)', 'Some Custom Move']);
    });

    it('numbers working sets per exercise within one workout timestamp', () => {
        const morning = '2025-01-19 09:00:00 +0000';
        const evening = '2025-01-19 18:00:00 +0000';
        const rows = toHevyRows(
            [set({ timestamp: morning }), set({ timestamp: morning }), set({ timestamp: evening }), set({ timestamp: evening, exercise: 'Deadlift' })],
            MAPPINGS,
        );
        expect(rows.map((r) => r['Set Order'])).toEqual([1, 2, 1, 1]);
    });

    it('marks warm-ups with W and does not count them as working sets', () => {
        const rows = toHevyRows([set({ isWarmup: true }), set({ isWarmup: true }), set(), set()], MAPPINGS);
        expect(rows.map((r) => r['Set Order'])).toEqual(['W', 'W', 1, 2]);
    });

    it('writes the weight as logged, never multiplied', () => {
        const [row] = toHevyRows([set({ weightKg: 22.5 })], MAPPINGS);
        expect(row.Weight).toBe(22.5);
        expect(row['Weight Unit']).toBe('kg');
    });

    it('writes the timestamp and workout name in local time', () => {
        const [row] = toHevyRows([set()], MAPPINGS);
        const local = new Date('2025-01-19T09:37:32Z');
        expect(row.Date).toBe(formatLocalDateTime(local));
        expect(row['Workout Name']).toBe(`Workout on: ${formatLocalDateTime(local).slice(0, 10)}`);
        expect(row['Workout Duration']).toBe(ESTIMATED_WORKOUT_DURATION);
    });

    it('carries cardio distance and duration, and the note', () => {
        const [cardio, lift] = toHevyRows([set({ exercise: 'Elliptical', reps: 0, weightKg: 0, durationS: 360, distanceM: 500 }), set({ note: 'PR!' })], MAPPINGS);
        expect(cardio.Distance).toBe(500);
        expect(cardio['Distance Unit']).toBe('m');
        expect(cardio.Seconds).toBe(360);
        expect(lift.Distance).toBeNull();
        expect(lift['Distance Unit']).toBeNull();
        expect(lift.Notes).toBe('PR!');
    });
});

describe('formatLocalDateTime', () => {
    it('zero-pads every part', () => {
        expect(formatLocalDateTime(new Date(2025, 0, 5, 7, 3, 9))).toBe('2025-01-05 07:03:09');
    });
});

describe('escapeCsvField', () => {
    it('leaves plain values alone and writes null as empty', () => {
        expect(escapeCsvField('Squat (Barbell)')).toBe('Squat (Barbell)');
        expect(escapeCsvField(0)).toBe('0');
        expect(escapeCsvField(null)).toBe('');
    });

    it('quotes and doubles when the value contains the separator, a quote or a line break', () => {
        expect(escapeCsvField('a;b')).toBe('"a;b"');
        expect(escapeCsvField('5" Band Row')).toBe('"5"" Band Row"');
        expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
    });

    it('always quotes when asked, including empty text', () => {
        expect(escapeCsvField('', true)).toBe('""');
    });
});

describe('serializeHevyCsv', () => {
    it('writes the Strong header, semicolons, CRLF and quoted text columns', () => {
        const csv = serializeHevyCsv(toHevyRows([set({ isWarmup: true }), set({ weightKg: 0, note: 'say "hi"' })], MAPPINGS));
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe(HEVY_COLUMNS.join(';'));
        const [, warmup, working] = lines.map((l) => l.split(';'));
        expect(warmup[2]).toBe('"Squat (Barbell)"');
        expect(warmup[3]).toBe('W');
        expect(working[3]).toBe('1');
        expect(working[4]).toBe('0');
        expect(working[7]).toBe('');
        expect(working[8]).toBe('');
        expect(working[9]).toBe('');
        expect(working[11]).toBe('"say ""hi"""');
        expect(working[12]).toBe('""');
        expect(working[13]).toBe(ESTIMATED_WORKOUT_DURATION);
        expect(csv.endsWith('\r\n')).toBe(false);
    });
});

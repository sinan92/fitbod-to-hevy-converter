import { FitbodParseError, parseCsv, parseFitbodCsv, parseFitbodDate, readFitbodCsv, UnknownFormatError } from './fitbod-csv';

export const FITBOD_HEADER =
    'Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier';

describe('parseCsv', () => {
    it('splits fields and rows, accepting LF, CRLF and CR', () => {
        expect(parseCsv('a,b\r\nc,d\re,f\n')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
            ['e', 'f'],
        ]);
    });

    it('keeps separators, doubled quotes and line breaks inside quoted fields', () => {
        expect(parseCsv('"felt heavy, stop at 8","say ""hi""","two\nlines",x')).toEqual([
            ['felt heavy, stop at 8', 'say "hi"', 'two\nlines', 'x'],
        ]);
    });

    it('drops blank rows in the middle and at the end', () => {
        expect(parseCsv('a,b\n\n   \nc,d\n\n')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });
});

describe('parseFitbodDate', () => {
    it('applies the UTC offset', () => {
        expect(parseFitbodDate('2023-10-24 18:24:59 +0000').toISOString()).toBe('2023-10-24T18:24:59.000Z');
        expect(parseFitbodDate('2023-10-24 18:24:59 +0200').toISOString()).toBe('2023-10-24T16:24:59.000Z');
        expect(parseFitbodDate('2023-10-24 18:24:59 -0500').toISOString()).toBe('2023-10-24T23:24:59.000Z');
    });

    it('treats a date without time as local midnight (support export)', () => {
        const d = parseFitbodDate('2025-06-23');
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2025, 5, 23, 0, 0]);
    });

    it('treats a timestamp without offset as local time', () => {
        const d = parseFitbodDate('2023-10-24 18:24:59');
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2023, 9, 24, 18, 24]);
    });

    it('rejects anything else', () => {
        expect(() => parseFitbodDate('24/10/2023')).toThrow(FitbodParseError);
        expect(() => parseFitbodDate('2023-13-24 18:24:59 +0000')).toThrow(FitbodParseError);
        expect(() => parseFitbodDate('')).toThrow(FitbodParseError);
    });
});

describe('parseFitbodCsv', () => {
    const row = (fields: string) => `${FITBOD_HEADER}\n${fields}\n`;

    it('reads a real-looking row, trimming the spaces Fitbod puts in front of numbers', () => {
        const [set] = parseFitbodCsv(row('2023-10-24 18:24:59 +0000,Barbell Incline Bench Press, 10,20.0,0.0,0.0,0.0,0.0,true,, 1.0'));
        expect(set).toEqual({
            timestamp: '2023-10-24 18:24:59 +0000',
            date: new Date('2023-10-24T18:24:59Z'),
            exercise: 'Barbell Incline Bench Press',
            reps: 10,
            weightKg: 20,
            durationS: 0,
            distanceM: 0,
            isWarmup: true,
            note: '',
        });
    });

    it('resolves columns by name, so order does not matter and optional columns may be missing', () => {
        const sets = parseFitbodCsv('Exercise,Weight(kg),Reps,Date\nBack Squat,100,5,2025-01-19 09:37:32 +0000\n');
        expect(sets).toHaveLength(1);
        expect(sets[0].exercise).toBe('Back Squat');
        expect(sets[0].weightKg).toBe(100);
        expect(sets[0].reps).toBe(5);
        expect(sets[0].isWarmup).toBe(false);
        expect(sets[0].distanceM).toBe(0);
    });

    it('keeps a quoted note that contains a comma', () => {
        const [set] = parseFitbodCsv(row('2023-10-24 18:24:59 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,"felt heavy, stop at 8", 1.0'));
        expect(set.note).toBe('felt heavy, stop at 8');
        expect(set.weightKg).toBe(100);
    });

    it('ignores a UTF-8 BOM, CRLF line endings and blank lines inside the file', () => {
        const text = `\uFEFF${FITBOD_HEADER}\r\n2023-10-24 18:24:59 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\r\n\r\n2023-10-24 18:24:59 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\r\n`;
        expect(parseFitbodCsv(text)).toHaveLength(2);
    });

    it('reads cardio rows with distance and duration', () => {
        const [set] = parseFitbodCsv(row('2023-10-24 18:24:59 +0000,Elliptical, 0,0.0,360.0,500.0,0.0,0.0,false,, 0.0'));
        expect(set.durationS).toBe(360);
        expect(set.distanceM).toBe(500);
    });

    it('rejects a file that is not a Fitbod export', () => {
        expect(() => parseFitbodCsv('hello,world\n1,2\n')).toThrow(/does not look like a Fitbod export: missing columns Date, Exercise, Reps, Weight\(kg\)/);
        expect(() => parseFitbodCsv('')).toThrow(/empty/);
    });

    it('names the row when a number or date cannot be read', () => {
        expect(() => parseFitbodCsv(row('2023-10-24 18:24:59 +0000,Back Squat,five,100,0,0,0,0,false,,1'))).toThrow(/Row 1: "five" in column Reps/);
        expect(() => parseFitbodCsv(row('yesterday,Back Squat,5,100,0,0,0,0,false,,1'))).toThrow(/Row 1: Unrecognised date "yesterday"/);
    });
});

/** Header of the database extract Fitbod support mails to Android users (no in-app export there). */
export const SUPPORT_HEADER = 'date,exercise_name,Reps,weight_kg,duration_seconds,distance_meters,Incline,Resistance,isWarmup';

describe('parseFitbodCsv with the Fitbod support export', () => {
    const rows = (...lines: string[]) => `${SUPPORT_HEADER}\n${lines.join('\n')}\n`;

    it('reads a strength row: date only, empty cells, lb-to-kg noise rounded to 0.01 kg', () => {
        const [set] = parseFitbodCsv(rows('2025-06-23,Seated Leg Curl,5,31.751465900000003,,,,,false'));
        expect(set.timestamp).toBe('2025-06-23');
        expect([set.date.getFullYear(), set.date.getMonth(), set.date.getDate(), set.date.getHours()]).toEqual([2025, 5, 23, 0]);
        expect(set.exercise).toBe('Seated Leg Curl');
        expect(set.reps).toBe(5);
        expect(set.weightKg).toBe(31.75);
        expect(set.durationS).toBe(0);
        expect(set.distanceM).toBe(0);
        expect(set.isWarmup).toBe(false);
        expect(set.note).toBe('');
    });

    it('reads a cardio row: no reps or weight, duration and distance rounded to 0.1 m', () => {
        const [set] = parseFitbodCsv(rows('2025-06-16,Elliptical,,,600.0,804.67224894628168,,1.0,false'));
        expect(set.reps).toBe(0);
        expect(set.weightKg).toBe(0);
        expect(set.durationS).toBe(600);
        expect(set.distanceM).toBe(804.7);
    });

    it('keeps an apostrophe in an exercise name and a loaded carry with distance', () => {
        const [set] = parseFitbodCsv(rows("2025-07-09,Farmer's Walk,,20.41165665,,18.288,,,false"));
        expect(set.exercise).toBe("Farmer's Walk");
        expect(set.weightKg).toBe(20.41);
        expect(set.distanceM).toBe(18.3);
    });

    it('groups sets by day, because the support export has no time of day', () => {
        const sets = parseFitbodCsv(rows('2025-06-23,Back Squat,5,100,,,,,false', '2025-06-30,Back Squat,5,100,,,,,false', '2025-06-23,Back Squat,5,100,,,,,false'));
        expect(sets.map((s) => s.timestamp)).toEqual(['2025-06-23', '2025-06-30', '2025-06-23']);
    });
});

describe('readFitbodCsv', () => {
    it('names the format it recognised', () => {
        expect(readFitbodCsv(`${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\n`).format).toBe('Fitbod app export');
        expect(readFitbodCsv(`${SUPPORT_HEADER}\n2025-06-23,Back Squat,5,100,,,,,false\n`).format).toBe('Fitbod support export');
    });

    it('rejects an unknown header with the columns it found and a suggested mapping', () => {
        const text = 'When,Movement,Repetitions,Load (kg)\n2025-06-23,Back Squat,5,100\n';
        expect(() => readFitbodCsv(text)).toThrow(UnknownFormatError);
        try {
            readFitbodCsv(text);
        } catch (e) {
            const error = e as UnknownFormatError;
            expect(error.message).toBe('This does not look like a Fitbod export: missing columns Date, Exercise, Reps, Weight(kg).');
            expect(error.header).toEqual(['When', 'Movement', 'Repetitions', 'Load (kg)']);
            expect(error.suggestion).toEqual({ date: 'When', exercise: 'Movement', reps: 'Repetitions', weight: 'Load (kg)' });
        }
    });

    it('reads any CSV with a manual column mapping', () => {
        const text = 'When,Movement,Repetitions,Load (kg),Warm\n2025-06-23 10:00:00,Back Squat,5,100,yes\n';
        const { sets, format } = readFitbodCsv(text, { date: 'When', exercise: 'Movement', reps: 'Repetitions', weight: 'Load (kg)', warmup: 'Warm' });
        expect(format).toBe('Manual column mapping');
        expect(sets).toHaveLength(1);
        expect(sets[0].exercise).toBe('Back Squat');
        expect(sets[0].weightKg).toBe(100);
        expect(sets[0].isWarmup).toBe(false); // only the literal "true" counts as a warm-up
    });

    it('rejects a manual mapping that names columns the file does not have', () => {
        const text = 'When,Movement\n2025-06-23,Back Squat\n';
        expect(() => readFitbodCsv(text, { date: 'When', exercise: 'Movement', reps: 'Reps', weight: 'Weight' })).toThrow(
            /mapped columns are not in this file: Reps, Weight/,
        );
    });
});

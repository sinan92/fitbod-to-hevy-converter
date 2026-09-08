import { FitbodParseError, parseCsv, parseFitbodCsv, parseFitbodDate } from './fitbod-csv';

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

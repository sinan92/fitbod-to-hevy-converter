import { detectFormat, guessMapping, INPUT_FORMATS, MissingColumnsError, REQUIRED_FIELDS, resolveColumns } from './column-mapping';

const APP_HEADER = ['Date', 'Exercise', 'Reps', 'Weight(kg)', 'Duration(s)', 'Distance(m)', 'Incline', 'Resistance', 'isWarmup', 'Note', 'multiplier'];
const SUPPORT_HEADER = ['date', 'exercise_name', 'Reps', 'weight_kg', 'duration_seconds', 'distance_meters', 'Incline', 'Resistance', 'isWarmup'];

describe('INPUT_FORMATS', () => {
    it('lists the app export first, so its wording is used for errors', () => {
        expect(INPUT_FORMATS.map((f) => f.id)).toEqual(['fitbod-app', 'fitbod-support']);
    });

    it('maps every required field in every format', () => {
        for (const format of INPUT_FORMATS) {
            for (const field of REQUIRED_FIELDS) {
                expect(format.mapping[field], `${format.id}.${field}`).toBeTruthy();
            }
        }
    });
});

describe('detectFormat', () => {
    it('recognises the Fitbod app export', () => {
        expect(detectFormat(APP_HEADER)?.id).toBe('fitbod-app');
    });

    it('recognises the Fitbod support export (the database extract Android users get by mail)', () => {
        expect(detectFormat(SUPPORT_HEADER)?.id).toBe('fitbod-support');
    });

    it('ignores case and surrounding whitespace', () => {
        expect(detectFormat([' DATE ', 'EXERCISE', 'reps', 'weight(KG)'])?.id).toBe('fitbod-app');
    });

    it('returns null for anything else', () => {
        expect(detectFormat(['hello', 'world'])).toBeNull();
        expect(detectFormat(['Date', 'Exercise', 'Reps'])).toBeNull();
    });
});

describe('resolveColumns', () => {
    it('finds the index of every mapped column and -1 for optional columns that are absent', () => {
        const columns = resolveColumns(['exercise_name', 'weight_kg', 'date', 'Reps'], INPUT_FORMATS[1].mapping);
        expect(columns).toEqual({ date: 2, exercise: 0, reps: 3, weight: 1, duration: -1, distance: -1, warmup: -1, note: -1 });
    });

    it('names the missing required columns', () => {
        expect(() => resolveColumns(['Date', 'Exercise'], INPUT_FORMATS[0].mapping)).toThrow(MissingColumnsError);
        try {
            resolveColumns(['Date', 'Exercise'], INPUT_FORMATS[0].mapping);
        } catch (e) {
            expect((e as MissingColumnsError).missing).toEqual(['Reps', 'Weight(kg)']);
        }
    });
});

describe('guessMapping', () => {
    it('prefills a manual mapping from column names it has never seen', () => {
        expect(guessMapping(['When', 'Movement', 'Repetitions', 'Load (kg)', 'Seconds', 'Meters', 'Warmup?', 'Comment'])).toEqual({
            date: 'When',
            exercise: 'Movement',
            reps: 'Repetitions',
            weight: 'Load (kg)',
            duration: 'Seconds',
            distance: 'Meters',
            warmup: 'Warmup?',
            note: 'Comment',
        });
    });

    it('uses each column at most once and leaves unknown fields out', () => {
        const guess = guessMapping(['Date', 'Exercise', 'Reps']);
        expect(guess).toEqual({ date: 'Date', exercise: 'Exercise', reps: 'Reps' });
        expect(Object.keys(guess)).not.toContain('weight');
    });

    it('guesses the support export correctly without knowing it', () => {
        const guess = guessMapping(SUPPORT_HEADER);
        expect(guess.date).toBe('date');
        expect(guess.exercise).toBe('exercise_name');
        expect(guess.reps).toBe('Reps');
        expect(guess.weight).toBe('weight_kg');
        expect(guess.duration).toBe('duration_seconds');
        expect(guess.distance).toBe('distance_meters');
        expect(guess.warmup).toBe('isWarmup');
    });
});

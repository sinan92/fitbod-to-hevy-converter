import { convertFitbodExport } from './convert';
import { EXERCISE_MAPPINGS } from './exercise-mappings';
import { FitbodParseError, UnknownFormatError } from './fitbod-csv';
import { FITBOD_HEADER } from './fitbod-csv.spec';

/** Mirrors the structure of a real export: padded numbers, blank lines, warm-ups, two workouts on one day, cardio, a note. */
const REAL_LOOKING_EXPORT = [
    FITBOD_HEADER,
    '2023-10-24 18:24:59 +0000,Barbell Incline Bench Press, 10,20.0,0.0,0.0,0.0,0.0,true,, 1.0',
    '2023-10-24 18:24:59 +0000,Barbell Incline Bench Press, 8,60.0,0.0,0.0,0.0,0.0,false,, 1.0',
    '2023-10-24 18:24:59 +0000,Barbell Incline Bench Press, 8,60.0,0.0,0.0,0.0,0.0,false,, 1.0',
    '',
    '2023-10-24 18:24:59 +0000,Dumbbell Bicep Curl, 12,12.5,0.0,0.0,0.0,0.0,false,Superset athlean x seated then standing curl, 2.0',
    '2023-10-24 18:24:59 +0000,Assisted Pull Up, 8,18.0,0.0,0.0,0.0,0.0,false,, 0.0',
    '2023-10-24 07:10:00 +0000,Elliptical, 0,0.0,360.0,500.0,0.0,0.0,false,, 0.0',
    '2023-10-25 17:00:00 +0000,Dumbbell Lunge, 10,10.0,0.0,0.0,0.0,0.0,false,, 4.0',
    '',
].join('\r\n');

describe('convertFitbodExport', () => {
    it('converts a real-looking export end to end', () => {
        const result = convertFitbodExport(REAL_LOOKING_EXPORT);
        expect(result.setCount).toBe(7);
        expect(result.workoutCount).toBe(3);
        expect(result.warmupCount).toBe(1);
        expect(result.unmappedExercises).toEqual(['Assisted Pull Up', 'Elliptical']);

        const lines = result.csv.split('\r\n');
        expect(lines).toHaveLength(8);
        expect(lines[1]).toContain('"Incline Bench Press (Barbell)";W;20;kg;10;');
        expect(lines[2]).toContain('"Incline Bench Press (Barbell)";1;60;kg;8;');
        expect(lines[3]).toContain('"Incline Bench Press (Barbell)";2;60;kg;8;');
        expect(lines[4]).toContain('"Bicep Curl (Dumbbell)";1;12.5;kg;12;;;;0;"Superset athlean x seated then standing curl";"";60m');
        expect(lines[5]).toContain('"Assisted Pull Up";1;18;kg;8;');
        expect(lines[6]).toContain('"Elliptical";1;0;kg;0;;500;m;360;');
        expect(lines[7]).toContain('"Lunge (Dumbbell)";1;10;kg;10;');
        expect(result.csv).not.toMatch(/NaN|Invalid|undefined/);
    });

    it('reports the first and last workout date', () => {
        const result = convertFitbodExport(REAL_LOOKING_EXPORT);
        expect(result.firstWorkout.toISOString()).toBe('2023-10-24T07:10:00.000Z');
        expect(result.lastWorkout.toISOString()).toBe('2023-10-25T17:00:00.000Z');
    });

    it('handles an export with more sets than a JavaScript engine accepts as call arguments', () => {
        // Math.min(...array) throws "Maximum call stack size exceeded" around 125k arguments.
        const rows = Array.from({ length: 130_000 }, (_, i) => {
            const day = new Date(Date.UTC(2015, 0, 1) + i * 2 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
            return `${day} +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0`;
        });
        const result = convertFitbodExport([FITBOD_HEADER, ...rows].join('\n'));
        expect(result.setCount).toBe(130_000);
        expect(result.firstWorkout.toISOString()).toBe('2015-01-01T00:00:00.000Z');
        expect(result.lastWorkout.getTime()).toBe(Date.UTC(2015, 0, 1) + 129_999 * 2 * 3_600_000);
    });

    it('rejects an export without sets', () => {
        expect(() => convertFitbodExport(`${FITBOD_HEADER}\n`)).toThrow(FitbodParseError);
        expect(() => convertFitbodExport(`${FITBOD_HEADER}\n`)).toThrow(/contains no sets/);
    });
});

describe('EXERCISE_MAPPINGS', () => {
    it('has trimmed, non-empty Hevy names that always carry the equipment suffix where Hevy does', () => {
        for (const [from, to] of EXERCISE_MAPPINGS) {
            expect(to.trim(), from).toBe(to);
            expect(to.length, from).toBeGreaterThan(0);
        }
        // Bare "Hip Thrust" is not a Hevy catalog name; Hevy always suffixes the equipment.
        expect([...EXERCISE_MAPPINGS.values()]).not.toContain('Hip Thrust');
    });
});

describe('convertFitbodExport with the Fitbod support export', () => {
    /** Mirrors the mailed extract: shuffled rows, date only, empty cells, lb-to-kg noise, cardio with resistance/incline. */
    const SUPPORT_EXPORT = [
        'date,exercise_name,Reps,weight_kg,duration_seconds,distance_meters,Incline,Resistance,isWarmup',
        '2025-06-23,Seated Leg Curl,5,31.751465900000003,,,,,false',
        '2025-07-07,Barbell Bench Press,5,56.69904625,,,,,false',
        '2025-06-16,Elliptical,,,600.0,804.67224894628168,,1.0,false',
        '2025-06-23,Seated Leg Curl,4,34.019427750000006,,,,,false',
        "2025-07-09,Farmer's Walk,,20.41165665,,18.288,,,false",
        '2025-06-23,Walking - Treadmill,,,600.0,531.08368430454584,15.0,,false',
        '',
    ].join('\n');

    it('converts it end to end and names the format', () => {
        const result = convertFitbodExport(SUPPORT_EXPORT);
        expect(result.format).toBe('Fitbod support export');
        expect(result.setCount).toBe(6);
        expect(result.workoutCount).toBe(4);
        expect(result.warmupCount).toBe(0);
        expect(result.unmappedExercises).toEqual(['Elliptical', "Farmer's Walk", 'Walking - Treadmill']);
        expect(result.firstWorkout.getMonth()).toBe(5);
        expect(result.lastWorkout.getDate()).toBe(9);

        const lines = result.csv.split('\r\n');
        expect(lines).toHaveLength(7);
        expect(lines[1]).toBe('2025-06-23 00:00:00;"Workout on: 2025-06-23";"Seated Leg Curl (Machine)";1;31.75;kg;5;;;;0;"";"";60m');
        expect(lines[2]).toContain('"Bench Press (Barbell)";1;56.7;kg;5;');
        expect(lines[3]).toContain('"Elliptical";1;0;kg;0;;804.7;m;600;');
        expect(lines[4]).toContain('"Seated Leg Curl (Machine)";2;34.02;kg;4;');
        expect(lines[5]).toContain(`"Farmer's Walk";1;20.41;kg;0;;18.3;m;0;`);
        expect(result.csv).not.toMatch(/NaN|Invalid|undefined/);
    });

    it('still converts the app export exactly as before, so both formats work side by side', () => {
        const app = convertFitbodExport(REAL_LOOKING_EXPORT);
        expect(app.format).toBe('Fitbod app export');
        expect(app.setCount).toBe(7);
        expect(app.csv.split('\r\n')[1]).toContain('"Incline Bench Press (Barbell)";W;20;kg;10;');
    });

    it('converts an unknown CSV once the user maps the columns', () => {
        const text = 'When,Movement,Repetitions,Load (kg)\n2025-06-23,Back Squat,5,100\n';
        expect(() => convertFitbodExport(text)).toThrow(UnknownFormatError);
        const result = convertFitbodExport(text, { date: 'When', exercise: 'Movement', reps: 'Repetitions', weight: 'Load (kg)' });
        expect(result.format).toBe('Manual column mapping');
        expect(result.csv.split('\r\n')[1]).toContain('"Squat (Barbell)";1;100;kg;5;');
    });
});

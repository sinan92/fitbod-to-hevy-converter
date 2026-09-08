import { convertFitbodExport } from './convert';
import { EXERCISE_MAPPINGS } from './exercise-mappings';
import { FitbodParseError } from './fitbod-csv';
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

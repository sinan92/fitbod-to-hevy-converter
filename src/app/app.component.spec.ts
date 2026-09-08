import { NgZone } from '@angular/core';
import { AppComponent, EXERCISE_MAPPINGS, ESTIMATED_WORKOUT_DURATION } from './app.component';
import { Fitbod } from './models/fitbod';

const FITBOD_HEADER = 'Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier';

function fitbodRow(overrides: Partial<Fitbod>): Fitbod {
    return { ...new Fitbod(), Date: '2025-01-19 09:37:32 +0000', Reps: '10', 'Weight(kg)': '20', 'Duration(s)': '0', multiplier: '1', ...overrides };
}

describe('AppComponent converter', () => {
    let app: AppComponent;

    beforeEach(() => {
        app = new AppComponent(new NgZone({}));
        spyOn(console, 'log');
        spyOn(console, 'error');
        spyOn(app, 'triggerDownload');
    });

    it('maps a known Fitbod exercise to its Hevy name', () => {
        const [row] = app.fitBodToHevy([fitbodRow({ Exercise: 'Dumbbell Shoulder Press' })]);
        expect(row['Exercise Name']).toBe('Shoulder Press (Dumbbell)');
    });

    it('passes unmapped exercise names through unchanged', () => {
        const [row] = app.fitBodToHevy([fitbodRow({ Exercise: 'Some Custom Move' })]);
        expect(row['Exercise Name']).toBe('Some Custom Move');
    });

    it('keeps the Fitbod set duration as Seconds', () => {
        const [row] = app.fitBodToHevy([fitbodRow({ Exercise: 'Scissor Kick', Reps: '0', 'Weight(kg)': '0', 'Duration(s)': '45' })]);
        expect(row['Exercise Name']).toBe('Ab Scissors');
        expect(row.Seconds).toBe(45);
        expect(row['Workout Duration']).toBe(ESTIMATED_WORKOUT_DURATION);
    });

    it('numbers sets per exercise and date', () => {
        const rows = app.fitBodToHevy([
            fitbodRow({ Exercise: 'Back Squat' }),
            fitbodRow({ Exercise: 'Back Squat' }),
            fitbodRow({ Exercise: 'Back Squat', Date: '2025-01-20 09:00:00 +0000' }),
        ]);
        expect(rows.map((r) => r['Set Order'])).toEqual([1, 2, 1]);
    });

    it('multiplies weight by the Fitbod multiplier', () => {
        const [row] = app.fitBodToHevy([fitbodRow({ Exercise: 'Dumbbell Bench Press', 'Weight(kg)': '22.5', multiplier: '2' })]);
        expect(row.Weight).toBe(45);
    });

    it('ignores a trailing newline and CRLF line endings when parsing the CSV', () => {
        const csv = `${FITBOD_HEADER}\r\n2025-01-19 09:37:32 +0000,Back Squat,5,100,0,0,0,0,false,,1\r\n`;
        const parsed = app.csvJSON(csv);
        expect(parsed.length).toBe(1);
        expect(parsed[0].Exercise).toBe('Back Squat');
        expect(parsed[0].multiplier).toBe('1');
    });

    it('produces one CSV line per set plus a header, end to end', () => {
        const csv = `${FITBOD_HEADER}\n` +
            '2025-01-19 09:37:32 +0000,Air Squats,15,0,0,0,0,0,false,,1\n' +
            '2025-01-19 09:37:32 +0000,Air Squats,15,0,0,0,0,0,false,,1\n';
        const out = app.JSONtoCSV(app.fitBodToHevy(app.csvJSON(csv))).split('\r\n');
        expect(out.length).toBe(3);
        expect(out[0].split(';')[0]).toBe('Date');
        expect(out[1]).toContain('"Squat (Bodyweight)"');
        expect(out).not.toContain(jasmine.stringMatching(/Invalid date/));
    });

    it('has mapping targets that look like Hevy catalog names', () => {
        for (const [from, to] of Object.entries(EXERCISE_MAPPINGS)) {
            expect(to.trim()).withContext(from).toBe(to);
            expect(to.length).withContext(from).toBeGreaterThan(0);
        }
        // Bare "Hip Thrust" is not a Hevy catalog name; Hevy always suffixes the equipment.
        expect(Object.values(EXERCISE_MAPPINGS)).not.toContain('Hip Thrust');
    });
    it('reports success in the status line and starts the download', () => {
        const csv = `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat,5,100,0,0,0,0,false,,1\n`;
        app.convertText('WorkoutExport.csv', csv);
        expect(app.error).toBe('');
        expect(app.status).toContain('Converted 1 sets from WorkoutExport.csv');
        expect(app.lastConverted?.name).toBe('FitBodToHevyConvertedFile.csv');
        expect(app.triggerDownload).toHaveBeenCalledTimes(1);
    });

    it('rejects a file that is not a Fitbod export', () => {
        expect(() => app.convertText('notes.txt', 'hello,world\n1,2\n')).toThrowError(/does not look like a Fitbod export/);
        expect(app.lastConverted).toBeNull();
        expect(app.triggerDownload).not.toHaveBeenCalled();
    });

    it('rejects an export without sets', () => {
        expect(() => app.convertText('WorkoutExport.csv', `${FITBOD_HEADER}\n`)).toThrowError(/contains no sets/);
    });

    it('shows an error for a dropped folder', () => {
        app.dropped([{ relativePath: 'folder', fileEntry: { isFile: false, isDirectory: true } } as any]);
        expect(app.error).toContain('Folders are not supported');
        expect(app.status).toBe('');
    });

    it('re-downloads the last converted file on request', () => {
        app.download();
        expect(app.triggerDownload).not.toHaveBeenCalled();
        app.convertText('WorkoutExport.csv', `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat,5,100,0,0,0,0,false,,1\n`);
        app.download();
        expect(app.triggerDownload).toHaveBeenCalledTimes(2);
    });
});

import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { OUTPUT_FILE_NAME } from './converter/convert';
import { FITBOD_HEADER } from './converter/fitbod-csv.spec';

const VALID_EXPORT = `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\n`;

describe('App', () => {
    let app: App;
    let saveFile: ReturnType<typeof vi.spyOn>;
    let element: HTMLElement;
    let fixture: ReturnType<typeof TestBed.createComponent<App>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
        fixture = TestBed.createComponent(App);
        app = fixture.componentInstance;
        element = fixture.nativeElement as HTMLElement;
        saveFile = vi.spyOn(app, 'saveFile').mockImplementation(() => undefined);
        await fixture.whenStable();
    });

    async function drop(...files: File[]): Promise<void> {
        await app.handleFiles(files);
        await fixture.whenStable();
    }

    it('converts a valid export, reports the counts and starts the download once', async () => {
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv', { type: 'text/csv' }));

        expect(app.error()).toBe('');
        expect(element.querySelector('[role=status]')?.textContent).toContain('Converted 1 sets across 1 workouts from WorkoutExport.csv');
        expect(element.querySelector('.result dl')?.textContent).toContain('Sets');
        expect(saveFile).toHaveBeenCalledTimes(1);
        const file = saveFile.mock.calls[0][0] as File;
        expect(file.name).toBe(OUTPUT_FILE_NAME);
        expect(file.type).toBe('text/csv');
    });

    it('re-downloads the last conversion on request', async () => {
        app.download();
        expect(saveFile).not.toHaveBeenCalled();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        app.download();
        expect(saveFile).toHaveBeenCalledTimes(2);
    });

    it('shows the parse error for a file that is not a Fitbod export', async () => {
        await drop(new File(['hello,world\n1,2\n'], 'notes.csv'));

        expect(element.querySelector('[role=alert]')?.textContent).toContain('does not look like a Fitbod export');
        expect(app.result()).toBeNull();
        expect(saveFile).not.toHaveBeenCalled();
    });

    it('refuses more than one file at a time', async () => {
        await drop(new File([VALID_EXPORT], 'a.csv'), new File([VALID_EXPORT], 'b.csv'));

        expect(app.error()).toContain('one file at a time');
        expect(saveFile).not.toHaveBeenCalled();
    });

    it('clears a previous error when a new file is dropped', async () => {
        await drop(new File(['nope'], 'x.csv'));
        expect(app.error()).not.toBe('');
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        expect(app.error()).toBe('');
        expect(app.result()?.setCount).toBe(1);
    });
});

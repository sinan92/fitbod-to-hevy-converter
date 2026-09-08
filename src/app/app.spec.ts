import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { OUTPUT_FILE_NAME } from './converter/convert';
import { FITBOD_HEADER } from './converter/fitbod-csv.spec';

const VALID_EXPORT = `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\n`;

/** Eight unmapped exercises across two months, so the receipt shows "+ 2 more" and a date range. */
const RICH_EXPORT =
    `${FITBOD_HEADER}\n` +
    ['Ab Rollout', 'Burpee', 'Chin Up', 'Front Squat', 'Hack Squat', 'Pull Up', 'Push Up', 'Sit Up']
        .map((name, i) => `2025-0${i < 4 ? 1 : 3}-19 09:37:32 +0000,${name}, 5,0.0,0.0,0.0,0.0,0.0,false,, 1.0`)
        .join('\n') +
    '\n';

describe('App', () => {
    let app: App;
    let saveFile: ReturnType<typeof vi.spyOn>;
    let element: HTMLElement;
    let fixture: ReturnType<typeof TestBed.createComponent<App>>;

    const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    const railStates = () =>
        [...element.querySelectorAll('.rail__step')].map((li) =>
            li.classList.contains('rail__step--done') ? 'done' : li.classList.contains('rail__step--active') ? 'active' : 'pending',
        );

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

    it('opens with the drop zone and step 2 active', () => {
        expect(text('.headline')).toBe('Bring your whole history with you.');
        expect(element.querySelector('.drop')).not.toBeNull();
        expect(element.querySelector('input[type=file]')).not.toBeNull();
        expect(railStates()).toEqual(['pending', 'active', 'pending']);
        expect(element.querySelector('.next')).toBeNull();
    });

    it('converts a valid export into a receipt and starts the download once', async () => {
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv', { type: 'text/csv' }));

        expect(app.phase()).toBe('done');
        expect(text('.headline')).toBe('Done. Check, then import.');
        expect(text('.lead')).toBe(`${OUTPUT_FILE_NAME} has been downloaded.`);
        expect(text('.receipt__file')).toBe('WorkoutExport.csv converted');
        expect(text('.receipt__range')).toBe('2025-01 → 2025-01');
        expect([...element.querySelectorAll('.receipt__number dd')].map((dd) => dd.textContent?.trim())).toEqual(['1', '1', '0']);
        expect(railStates()).toEqual(['done', 'done', 'active']);
        expect(text('.rail__step--done:nth-child(2) .rail__hint')).toBe('1 set');
        expect(text('.next__eyebrow')).toBe('Step 3 · Import into Hevy');
        expect(saveFile).toHaveBeenCalledTimes(1);
        const file = saveFile.mock.calls[0][0] as File;
        expect(file.name).toBe(OUTPUT_FILE_NAME);
        expect(file.type).toBe('text/csv');
    });

    it('previews six unmapped exercises and expands the rest on request', async () => {
        await drop(new File([RICH_EXPORT], 'WorkoutExport.csv'));

        expect(text('.receipt__range')).toBe('2025-01 → 2025-03');
        expect(element.querySelectorAll('li.chip')).toHaveLength(6);
        expect(text('.chip--more')).toBe('+ 2 more');

        (element.querySelector('.chip--more') as HTMLButtonElement).click();
        await fixture.whenStable();

        expect(element.querySelectorAll('li.chip')).toHaveLength(8);
        expect(element.querySelector('.chip--more')).toBeNull();
    });

    it('re-downloads the last conversion on request', async () => {
        app.download();
        expect(saveFile).not.toHaveBeenCalled();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        (element.querySelector('.receipt__actions .btn') as HTMLButtonElement).click();
        expect(saveFile).toHaveBeenCalledTimes(2);
    });

    it('returns to the empty page from the receipt', async () => {
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        (element.querySelector('.btn--ghost') as HTMLButtonElement).click();
        await fixture.whenStable();

        expect(app.phase()).toBe('idle');
        expect(element.querySelector('.drop')).not.toBeNull();
        expect(railStates()).toEqual(['pending', 'active', 'pending']);
    });

    it('shows the converter message for a file that is not a Fitbod export, with a way back', async () => {
        await drop(new File(['hello,world\n1,2\n'], 'notes.csv'));

        expect(app.phase()).toBe('error');
        expect(text('[role=alert]')).toContain('Conversion failed.');
        expect(text('.error__message')).toContain('does not look like a Fitbod export');
        expect(railStates()).toEqual(['done', 'active', 'pending']);
        expect(saveFile).not.toHaveBeenCalled();

        (element.querySelector('[role=alert] .btn') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(app.phase()).toBe('idle');
    });

    it('refuses more than one file at a time', async () => {
        await drop(new File([VALID_EXPORT], 'a.csv'), new File([VALID_EXPORT], 'b.csv'));

        expect(text('.error__message')).toBe('Drop one file at a time: your Fitbod WorkoutExport.csv.');
        expect(saveFile).not.toHaveBeenCalled();
    });

    it('starts a fresh conversion when a new file arrives after an error', async () => {
        await drop(new File(['nope'], 'x.csv'));
        expect(app.phase()).toBe('error');
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        expect(app.phase()).toBe('done');
        expect(app.errorMessage()).toBe('');
    });
});

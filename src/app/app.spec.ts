import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';
import { OUTPUT_FILE_NAME } from './converter/convert';
import { FITBOD_HEADER } from './converter/fitbod-csv.spec';

const VALID_EXPORT = `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\n`;

/** One warm-up and one working set of the same exercise. */
const WARMUP_EXPORT =
    `${FITBOD_HEADER}\n` +
    '2025-01-19 09:37:32 +0000,Back Squat, 5,60.0,0.0,0.0,0.0,0.0,true,, 1.0\n' +
    '2025-01-19 09:37:32 +0000,Back Squat, 5,100.0,0.0,0.0,0.0,0.0,false,, 1.0\n';

/** Eight unmapped exercises across two months, so the receipt shows "+ 2 more" and a date range. */
const RICH_EXPORT =
    `${FITBOD_HEADER}\n` +
    ['Ab Rollout', 'Burpee', 'Chin Up', 'Front Squat', 'Hack Squat', 'Pull Up', 'Push Up', 'Sit Up']
        .map((name, i) => `2025-0${i < 4 ? 1 : 3}-19 09:37:32 +0000,${name}, 5,0.0,0.0,0.0,0.0,0.0,false,, 1.0`)
        .join('\n') +
    '\n';

const ONE_UNMAPPED_EXPORT = `${FITBOD_HEADER}\n2025-01-19 09:37:32 +0000,Ab Rollout, 5,0.0,0.0,0.0,0.0,0.0,false,, 1.0\n`;

/** Pretends the browser has (or lacks) a share sheet for files and a touch screen. */
function fakeBrowser(options: { canShare?: boolean; share?: (data: ShareData) => Promise<void>; coarsePointer?: boolean }): void {
    Object.defineProperty(navigator, 'canShare', { value: options.canShare ? () => true : undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: options.share, configurable: true });
    Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({ matches: query === '(pointer: coarse)' && options.coarsePointer === true }),
        configurable: true,
    });
}

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
    const receiptNumbers = () => [...element.querySelectorAll('.receipt__number dd')].map((dd) => dd.textContent?.trim());
    const actionLabels = () => [...element.querySelectorAll('.receipt__actions .btn')].map((b) => b.textContent?.trim());

    function createApp(): void {
        fixture = TestBed.createComponent(App);
        app = fixture.componentInstance;
        element = fixture.nativeElement as HTMLElement;
        saveFile = vi.spyOn(app, 'saveFile').mockImplementation(() => undefined);
    }

    beforeEach(async () => {
        fakeBrowser({});
        await TestBed.configureTestingModule({ imports: [App], providers: appConfig.providers }).compileComponents();
        createApp();
        await fixture.whenStable();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        expect(text('.lead')).toBe(`${OUTPUT_FILE_NAME} is downloading. Not there? Use Download again below.`);
        expect(text('.receipt__file')).toBe('WorkoutExport.csv converted');
        expect(text('.receipt__range')).toBe('2025-01 → 2025-01');
        expect(receiptNumbers()).toEqual(['1', '1', '0', '0']);
        expect(railStates()).toEqual(['done', 'done', 'active']);
        expect(text('.rail__step--done:nth-child(2) .rail__hint')).toBe('1 set');
        expect(text('.next__eyebrow')).toBe('Step 3 · Import into Hevy');
        expect(saveFile).toHaveBeenCalledTimes(1);
        const file = saveFile.mock.calls[0][0] as File;
        expect(file.name).toBe(OUTPUT_FILE_NAME);
        expect(file.type).toBe('text/csv');
    });

    it('counts warm-ups on the receipt', async () => {
        await drop(new File([WARMUP_EXPORT], 'WorkoutExport.csv'));

        expect([...element.querySelectorAll('.receipt__number dt')].map((dt) => dt.textContent?.trim())).toEqual([
            'sets',
            'workouts',
            'warm-ups',
            'without mapping',
        ]);
        expect(receiptNumbers()).toEqual(['2', '1', '1', '0']);
    });

    it('previews six unmapped exercises and expands the rest on request', async () => {
        await drop(new File([RICH_EXPORT], 'WorkoutExport.csv'));

        expect(text('.receipt__range')).toBe('2025-01 → 2025-03');
        expect(text('.receipt__unmapped p')).toBe('8 exercises have no Hevy name and will be created as custom exercises:');
        expect(element.querySelectorAll('li.chip')).toHaveLength(6);
        expect(text('.chip--more')).toBe('+ 2 more');

        (element.querySelector('.chip--more') as HTMLButtonElement).click();
        await fixture.whenStable();

        expect(element.querySelectorAll('li.chip')).toHaveLength(8);
        expect(element.querySelector('.chip--more')).toBeNull();
    });

    it('uses the singular for one unmapped exercise', async () => {
        await drop(new File([ONE_UNMAPPED_EXPORT], 'WorkoutExport.csv'));

        expect(text('.receipt__unmapped p')).toBe('1 exercise has no Hevy name and will be created as a custom exercise:');
    });

    it('re-downloads the last conversion on request', async () => {
        app.download();
        expect(saveFile).not.toHaveBeenCalled();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        (element.querySelector('.receipt__actions .btn') as HTMLButtonElement).click();
        expect(saveFile).toHaveBeenCalledTimes(2);
    });

    it('downloads through an anchor that is attached to the page, and removes it afterwards', () => {
        saveFile.mockRestore();
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
        const clicks: { connected: boolean; download: string; href: string }[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            clicks.push({ connected: this.isConnected, download: this.download, href: this.href });
        });
        try {
            app.saveFile(new File(['a;b'], 'out.csv', { type: 'text/csv' }));
        } finally {
            vi.unstubAllGlobals();
        }

        expect(clicks).toEqual([{ connected: true, download: 'out.csv', href: 'blob:test' }]);
        expect(document.querySelector('a[download]')).toBeNull();
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

    it('says so when what was dropped is not a file', async () => {
        await drop();

        expect(app.phase()).toBe('error');
        expect(text('.error__message')).toBe('That was not a file. Drop your Fitbod WorkoutExport.csv.');
    });

    it('reports a file the browser cannot read, such as a folder', async () => {
        vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
            this.dispatchEvent(new Event('error'));
        });

        await drop(new File([''], 'Downloads'));

        expect(app.phase()).toBe('error');
        expect(text('.error__message')).toBe('Could not read Downloads. Is it a file, not a folder?');
    });

    it('highlights the drop zone while a file is dragged over it and takes the drop', async () => {
        const zone = element.querySelector('.drop') as HTMLElement;
        const dragover = new Event('dragover', { bubbles: true, cancelable: true });
        zone.dispatchEvent(dragover);
        await fixture.whenStable();
        expect(dragover.defaultPrevented).toBe(true);
        expect(zone.classList.contains('drop--dragging')).toBe(true);

        zone.dispatchEvent(new Event('dragleave', { bubbles: true }));
        await fixture.whenStable();
        expect(zone.classList.contains('drop--dragging')).toBe(false);

        const drop = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File([VALID_EXPORT], 'WorkoutExport.csv')] } });
        zone.dispatchEvent(drop);
        await fixture.whenStable();
        await vi.waitFor(() => expect(app.phase()).toBe('done'));
        expect(drop.defaultPrevented).toBe(true);
        expect(saveFile).toHaveBeenCalledTimes(1);
    });

    it('stops the browser from opening a file dropped outside the zone', () => {
        for (const type of ['dragover', 'drop']) {
            const event = new Event(type, { bubbles: true, cancelable: true });
            document.dispatchEvent(event);
            expect(event.defaultPrevented, type).toBe(true);
        }
    });

    it('offers Download again only, where the browser cannot share files', async () => {
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        expect(actionLabels()).toEqual(['Download again', 'Convert another file']);
        expect(element.querySelector('.receipt__hint')).toBeNull();
    });

    it('keeps Download again first on a desktop browser that can share files', async () => {
        fakeBrowser({ canShare: true, share: vi.fn(), coarsePointer: false });
        createApp();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));

        expect(actionLabels()).toEqual(['Download again', 'Convert another file']);
        expect(element.querySelector('.receipt__hint')).toBeNull();
    });

    it('offers Save file first on a touch device with a file share sheet', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        fakeBrowser({ canShare: true, share, coarsePointer: true });
        createApp();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));

        expect(actionLabels()).toEqual(['Save file', 'Download again', 'Convert another file']);
        expect(text('.receipt__hint')).toContain('Save file');

        (element.querySelector('.receipt__actions .btn') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(share).toHaveBeenCalledTimes(1);
        const shared = share.mock.calls[0][0] as { files: File[] };
        expect(shared.files[0].name).toBe(OUTPUT_FILE_NAME);
        expect(app.phase()).toBe('done');
    });

    it('keeps the receipt when the user cancels the share sheet', async () => {
        fakeBrowser({ canShare: true, share: () => Promise.reject(new DOMException('cancelled', 'AbortError')), coarsePointer: true });
        createApp();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        await app.shareFile();

        expect(app.phase()).toBe('done');
        expect(app.errorMessage()).toBe('');
    });

    it('explains when the share sheet fails for another reason', async () => {
        fakeBrowser({ canShare: true, share: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), coarsePointer: true });
        createApp();
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        await app.shareFile();
        await fixture.whenStable();

        expect(app.phase()).toBe('error');
        expect(text('.error__message')).toBe('Sharing did not work on this device. Use "Download again" instead.');
    });

    it('starts a fresh conversion when a new file arrives after an error', async () => {
        await drop(new File(['nope'], 'x.csv'));
        expect(app.phase()).toBe('error');
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));
        expect(app.phase()).toBe('done');
        expect(app.errorMessage()).toBe('');
    });

    it('shows an unexpected error on the page instead of only in the console', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await drop(new File([VALID_EXPORT], 'WorkoutExport.csv'));

        TestBed.inject(ErrorHandler).handleError(new Error('boom'));
        await fixture.whenStable();

        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(text('.error--unexpected')).toContain('Something went wrong.');
        expect(text('.error--unexpected')).toContain('boom');
        expect(element.querySelector('.error--unexpected .btn')?.textContent?.trim()).toBe('Reload the page');
        // The receipt stays available underneath.
        expect(element.querySelector('.receipt')).not.toBeNull();
    });
});

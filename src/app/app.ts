import { DecimalPipe } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { ConversionResult, convertFitbodExport, OUTPUT_FILE_NAME } from './converter/convert';
import { formatLocalDate } from './converter/hevy-csv';
import { VisibleErrorHandler } from './visible-error-handler';

/** What the page is doing. Everything shown is derived from this plus the file name and the result. */
export type Phase = 'idle' | 'reading' | 'done' | 'error';
export type StepState = 'pending' | 'active' | 'done';

export interface Step {
    number: 1 | 2 | 3;
    title: string;
    hint: string;
    state: StepState;
}

/** How many unmapped exercise names the receipt shows before "+ N more". */
export const UNMAPPED_PREVIEW = 6;

/** "2023-10": the month of a date, in local time like the CSV. */
const formatMonth = (d: Date) => formatLocalDate(d).slice(0, 7);

@Component({
    selector: 'app-root',
    imports: [DecimalPipe],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    readonly outputFileName = OUTPUT_FILE_NAME;
    /** Errors that escaped every handler. Shown in a banner so that nothing can fail silently. */
    readonly unexpected = inject(VisibleErrorHandler);

    readonly phase = signal<Phase>('idle');
    readonly fileName = signal('');
    readonly result = signal<ConversionResult | null>(null);
    /** The converter's message, already phrased for the user. Empty unless phase is 'error'. */
    readonly errorMessage = signal('');
    readonly dragging = signal(false);
    readonly showAllUnmapped = signal(false);
    /** True on phones and tablets whose browser can hand a file to the share sheet (iOS: "Save to Files"). */
    readonly canShareFile = signal(detectFileSharing());

    /** The three-step rail doubles as the progress indicator. */
    readonly steps = computed<Step[]>(() => {
        const phase = this.phase();
        const fileName = this.fileName();
        const result = this.result();
        const convertHint =
            phase === 'reading' ? 'Converting…' : result ? `${result.setCount.toLocaleString('en-US')} ${result.setCount === 1 ? 'set' : 'sets'}` : 'Drop the file here';
        return [
            { number: 1, title: 'Export', hint: fileName || 'Fitbod → Log → ⋯ → Export Data', state: fileName ? 'done' : 'pending' },
            { number: 2, title: 'Convert', hint: convertHint, state: phase === 'done' ? 'done' : 'active' },
            { number: 3, title: 'Import', hint: phase === 'done' ? 'Now in Hevy' : 'Hevy → Profile → Settings → Import data', state: phase === 'done' ? 'active' : 'pending' },
        ];
    });

    /** "2023-10 → 2025-09": the months of the first and last workout. */
    readonly dateRange = computed(() => {
        const r = this.result();
        return r ? `${formatMonth(r.firstWorkout)} → ${formatMonth(r.lastWorkout)}` : '';
    });

    readonly unmappedCount = computed(() => this.result()?.unmappedExercises.length ?? 0);
    readonly visibleUnmapped = computed(() => {
        const names = this.result()?.unmappedExercises ?? [];
        return this.showAllUnmapped() ? names : names.slice(0, UNMAPPED_PREVIEW);
    });
    readonly hiddenUnmappedCount = computed(() => this.unmappedCount() - this.visibleUnmapped().length);

    /** Dropping a file outside the drop zone must not make the browser open the CSV. */
    @HostListener('document:dragover', ['$event'])
    @HostListener('document:drop', ['$event'])
    preventBrowserFileOpen(event: DragEvent): void {
        event.preventDefault();
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragging.set(true);
    }

    onDragLeave(): void {
        this.dragging.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragging.set(false);
        void this.handleFiles(event.dataTransfer?.files ?? null);
    }

    onFileInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        void this.handleFiles(input.files);
        // Allow picking the same file again.
        input.value = '';
    }

    /** Converts the single dropped or picked file and starts the download. */
    async handleFiles(files: ArrayLike<File> | null): Promise<void> {
        this.reset();
        if (!files || files.length === 0) {
            // Dragged text, a link or an image from another page: the drop carries no file.
            this.fail('That was not a file. Drop your Fitbod WorkoutExport.csv.');
            return;
        }
        if (files.length > 1) {
            this.fail('Drop one file at a time: your Fitbod WorkoutExport.csv.');
            return;
        }
        const file = files[0];
        this.fileName.set(file.name);
        this.phase.set('reading');
        try {
            const text = await readFileAsText(file);
            const result = convertFitbodExport(text);
            this.result.set(result);
            this.phase.set('done');
            this.download();
        } catch (e) {
            this.fail(e instanceof Error ? e.message : String(e));
        }
    }

    /** Back to the empty page, ready for another file. */
    reset(): void {
        this.phase.set('idle');
        this.fileName.set('');
        this.result.set(null);
        this.errorMessage.set('');
        this.showAllUnmapped.set(false);
    }

    /** Starts (or restarts) the download of the last conversion. */
    download(): void {
        const file = this.outputFile();
        if (file) {
            this.saveFile(file);
        }
    }

    /**
     * Hands the file to the system share sheet. On iOS this is the reliable way to get it into the Files app,
     * where Hevy can pick it up; a blob download may open the CSV as text instead. Cancelling is not an error.
     */
    async shareFile(): Promise<void> {
        const file = this.outputFile();
        if (!file) {
            return;
        }
        try {
            await navigator.share({ files: [file], title: 'Fitbod to Hevy' });
        } catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
                this.fail('Sharing did not work on this device. Use "Download again" instead.');
            }
        }
    }

    /** The only way out after an unexpected error: start over with a clean page. */
    reload(): void {
        location.reload();
    }

    /** Separate so tests can stub the browser download. */
    saveFile(file: File): void {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        // Attached to the document while clicked: some web views ignore a click on a detached anchor.
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        // Revoke later: some browsers start the download asynchronously.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    /** The converted CSV as a file, or null before a conversion. */
    private outputFile(): File | null {
        const result = this.result();
        return result ? new File([result.csv], OUTPUT_FILE_NAME, { type: 'text/csv' }) : null;
    }

    private fail(message: string): void {
        this.errorMessage.set(message);
        this.phase.set('error');
    }
}

/**
 * Web Share with files exists on iOS 15+, Android, but also on Chrome for Windows/ChromeOS and Safari
 * for macOS. Only phones and tablets need it (there a blob download may open the CSV as text), so it is
 * offered on touch-first devices only; desktop browsers keep the plain download.
 */
function detectFileSharing(): boolean {
    try {
        return (
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches &&
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: [new File([''], 'probe.csv', { type: 'text/csv' })] })
        );
    } catch {
        return false;
    }
}

/** FileReader rather than File.text(): supported everywhere, including the test DOM. */
function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Could not read ${file.name}. Is it a file, not a folder?`));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
}

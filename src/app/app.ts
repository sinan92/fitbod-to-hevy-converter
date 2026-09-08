import { DecimalPipe } from '@angular/common';
import { Component, computed, HostListener, signal } from '@angular/core';
import { ConversionResult, convertFitbodExport, OUTPUT_FILE_NAME } from './converter/convert';

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

const formatMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

@Component({
    selector: 'app-root',
    imports: [DecimalPipe],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    readonly outputFileName = OUTPUT_FILE_NAME;

    readonly phase = signal<Phase>('idle');
    readonly fileName = signal('');
    readonly result = signal<ConversionResult | null>(null);
    /** The converter's message, already phrased for the user. Empty unless phase is 'error'. */
    readonly errorMessage = signal('');
    readonly dragging = signal(false);
    readonly showAllUnmapped = signal(false);

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
        const result = this.result();
        if (result) {
            this.saveFile(new File([result.csv], OUTPUT_FILE_NAME, { type: 'text/csv' }));
        }
    }

    /** Separate so tests can stub the browser download. */
    saveFile(file: File): void {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        // Revoke later: some browsers start the download asynchronously.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    private fail(message: string): void {
        this.errorMessage.set(message);
        this.phase.set('error');
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

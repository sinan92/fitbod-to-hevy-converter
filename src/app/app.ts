import { Component, computed, signal } from '@angular/core';
import { ConversionResult, convertFitbodExport, OUTPUT_FILE_NAME } from './converter/convert';

@Component({
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    readonly fileName = signal('');
    /** Progress or result of the last conversion, shown to the user. */
    readonly status = signal('');
    /** Why the last conversion failed, shown to the user. Empty when there is no error. */
    readonly error = signal('');
    readonly result = signal<ConversionResult | null>(null);
    readonly dragging = signal(false);
    readonly unmappedCount = computed(() => this.result()?.unmappedExercises.length ?? 0);

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
        this.status.set(`Reading ${file.name}…`);
        try {
            const text = await readFileAsText(file);
            const result = convertFitbodExport(text);
            this.result.set(result);
            this.status.set(
                `Converted ${result.setCount} sets across ${result.workoutCount} workouts from ${file.name}. ` +
                    'The download should start now; if it does not, use the button below.',
            );
            this.download();
        } catch (e) {
            this.fail(e instanceof Error ? e.message : String(e));
        }
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

    private reset(): void {
        this.fileName.set('');
        this.status.set('');
        this.error.set('');
        this.result.set(null);
    }

    private fail(message: string): void {
        this.status.set('');
        this.error.set(`Conversion failed: ${message}`);
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

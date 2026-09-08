import { ErrorHandler, Injectable, signal } from '@angular/core';

/**
 * Angular's default handler only writes to the console. That is how the first version of this page
 * could fail without the user noticing anything. This one also keeps the message so the page can
 * show it; every error that escapes a handler ends up on screen.
 */
@Injectable({ providedIn: 'root' })
export class VisibleErrorHandler implements ErrorHandler {
    /** Message of the last unexpected error; empty while nothing has gone wrong. */
    readonly message = signal('');

    handleError(error: unknown): void {
        console.error(error);
        this.message.set(error instanceof Error ? error.message || error.name : String(error));
    }
}

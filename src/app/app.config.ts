import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { VisibleErrorHandler } from './visible-error-handler';

export const appConfig: ApplicationConfig = {
    providers: [
        // Route window "error" and "unhandledrejection" events through the ErrorHandler below.
        provideBrowserGlobalErrorListeners(),
        { provide: ErrorHandler, useExisting: VisibleErrorHandler },
    ],
};

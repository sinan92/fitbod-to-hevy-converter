import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { VisibleErrorHandler } from './visible-error-handler';

export const appConfig: ApplicationConfig = {
    providers: [
        // Route window "error" and "unhandledrejection" events through the ErrorHandler below.
        provideBrowserGlobalErrorListeners(),
        { provide: ErrorHandler, useExisting: VisibleErrorHandler },
        provideClientHydration(),
    ],
};

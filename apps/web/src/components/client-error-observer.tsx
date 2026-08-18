import { useEffect } from 'react';

import { loggerFactory } from '@~/lib/logging/logger';

const clientErrorLogger = loggerFactory.getLogger('browser');

export function ClientErrorObserver() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const context = {
        ...(event.filename ? { filename: event.filename.slice(0, 2_000) } : {}),
        ...(event.lineno ? { lineNumber: event.lineno } : {}),
        ...(event.colno ? { columnNumber: event.colno } : {}),
      };
      const error = event.error ?? new Error(event.message || 'Unhandled browser error');

      clientErrorLogger.error('Unhandled browser error', error, context);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      clientErrorLogger.error('Unhandled browser promise rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}

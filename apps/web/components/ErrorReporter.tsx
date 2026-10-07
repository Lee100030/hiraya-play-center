'use client';

import { createErrorReport, reportClientError } from '@hiraya/utils';
import { useEffect } from 'react';

export function ErrorReporter({ platform }: { platform: 'web' | 'desktop' }) {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError(
        createErrorReport({
          platform,
          environment: process.env.NODE_ENV,
          route: typeof location !== 'undefined' ? location.pathname : undefined,
          feature: 'window.onerror',
          type: 'frontend',
          message: event.message,
        }),
      );
    }
    function onRejected(event: PromiseRejectionEvent) {
      reportClientError(
        createErrorReport({
          platform,
          environment: process.env.NODE_ENV,
          route: typeof location !== 'undefined' ? location.pathname : undefined,
          feature: 'unhandledrejection',
          type: 'frontend',
          message: event.reason instanceof Error ? event.reason.message : String(event.reason || ''),
        }),
      );
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejected);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejected);
    };
  }, [platform]);
  return null;
}

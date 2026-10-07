export type HirayaErrorReport = {
  timestamp: string;
  platform: 'web' | 'desktop' | 'mobile' | 'api' | 'unknown';
  environment?: string;
  route?: string;
  feature?: string;
  type: string;
  message: string;
  requestId?: string;
  userId?: string;
};

const SENSITIVE = /password|token|secret|authorization|session|smtp|connection string/i;

export function sanitizeErrorMessage(value?: string) {
  const text = (value || '').trim();
  if (!text) return 'An unexpected error occurred.';
  if (SENSITIVE.test(text)) return 'An unexpected error occurred.';
  return text.slice(0, 500);
}

export function createErrorReport(
  input: Omit<HirayaErrorReport, 'timestamp' | 'message'> & { message?: string },
): HirayaErrorReport {
  return {
    timestamp: new Date().toISOString(),
    platform: input.platform,
    environment: input.environment,
    route: input.route,
    feature: input.feature,
    type: input.type,
    message: sanitizeErrorMessage(input.message),
    requestId: input.requestId,
    userId: input.userId,
  };
}

export function reportClientError(report: HirayaErrorReport) {
  if (typeof console !== 'undefined') {
    console.error('[hiraya]', report.type, report.route || report.feature || '', report.message);
  }
}

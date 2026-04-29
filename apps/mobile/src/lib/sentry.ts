import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const IS_PROD = process.env.EXPO_PUBLIC_APP_ENV === 'production';

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PROD ? 'production' : 'development',
    // Only send errors in production — avoid noise from dev
    enabled: IS_PROD,
    // Capture 20% of transactions for performance monitoring
    tracesSampleRate: IS_PROD ? 0.2 : 0,
    // Scrub PII from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Strip any query params that might contain tokens
      if (breadcrumb.data?.url) {
        try {
          const url = new URL(breadcrumb.data.url);
          url.search = '';
          breadcrumb.data.url = url.toString();
        } catch {}
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // Strip user email from error events (HIPAA-adjacent caution)
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

export { Sentry };

// Sentry for the Quote form (ADR-0007, packages/browser-monitoring), started
// as the form loads and only when the build has PUBLIC_SENTRY_DSN: then it
// comes in a chunk of its own, so the page waits for none of it. Dev and
// test builds have no DSN, so send nothing and carry none of it.
export const startQuoteFormMonitoring = (apiUrl: string) => {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  void import("@empire-cleaning/browser-monitoring").then(
    ({ startMonitoring }) =>
      startMonitoring({
        dsn,
        environment: import.meta.env.PUBLIC_APP_MODE ?? "dev",
        apiUrl,
      }),
  );
};

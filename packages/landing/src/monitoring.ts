import { apiUrl } from "./api-url.ts";

// Sentry for the landing site (ADR-0007, packages/browser-monitoring), started
// by every page (layouts/Page.astro) once the browser is idle, and only when
// the build has PUBLIC_SENTRY_DSN: then it comes in a chunk of its own, so the
// page waits for none of it. It reports the Quote form's errors, and on the
// test site carries the feedback button (ADR-0020), whose code and look other
// builds leave out. Dev and test builds have no DSN, so send nothing and carry
// none of it.
export const startLandingMonitoring = () => {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // read here, not as site-mode.ts's isTestSite: known within this module at
  // build time, the button's branch is dropped before the build splits its
  // files, so other builds don't even publish them
  const mode = import.meta.env.PUBLIC_APP_MODE ?? "dev";
  const start = async () => {
    const [{ startMonitoring }, feedback] = await Promise.all([
      import("@empire-cleaning/browser-monitoring"),
      mode === "test"
        ? import("./feedback.ts").then((test) => test.feedbackButton())
        : undefined,
    ]);
    startMonitoring({
      dsn,
      environment: mode,
      apiUrl,
      feedback,
    });
  };
  // as the Quote form waits to load (client:idle); Safari has no
  // requestIdleCallback
  const later = () => void start();
  if ("requestIdleCallback" in window) requestIdleCallback(later);
  else setTimeout(later, 200);
};

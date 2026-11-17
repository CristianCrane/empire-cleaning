import { sentryVitePlugin } from "@sentry/vite-plugin";
import type { PluginOption } from "vite";
import { APPLICATION_KEY } from "./application-key.ts";

// The build's part (ADR-0007), for the web app's and the landing site's Vite:
// the release is the git commit Render builds (RENDER_GIT_COMMIT), the same
// as the server's. Every build marks its code with APPLICATION_KEY, so the
// browser can tell errors in it from others' (./index.ts): without the mark,
// every uncaught error would count as someone else's. With SENTRY_AUTH_TOKEN
// (and SENTRY_ORG), source maps are made, uploaded to `project` and
// deleted, so they're never published; without it (dev, tests, CI) there are
// none, and no release is made in Sentry.
export const monitoringBuild = (project: string): PluginOption[] => {
  const release = process.env.RENDER_GIT_COMMIT;
  const upload = Boolean(process.env.SENTRY_AUTH_TOKEN);
  return [
    {
      name: "monitoring-release",
      config: () => ({
        define: { __RELEASE__: JSON.stringify(release ?? null) },
        ...(upload ? { build: { sourcemap: "hidden" } } : {}),
      }),
    },
    sentryVitePlugin({
      project,
      applicationKey: APPLICATION_KEY,
      // without a token, an empty release name, so the plugin neither makes a
      // release nor warns that it can't (left out, it finds the commit itself)
      release: { name: upload ? release : "", inject: false },
      sourcemaps: upload
        ? { filesToDeleteAfterUpload: ["dist/**/*.map"] }
        : { disable: true },
      telemetry: false,
    }),
  ];
};

// where the browser sends events, for a page's Content-Security-Policy
// (connect-src): the origin of the build's DSN, or none without one
export const monitoringOrigins = (dsn: string | undefined): string[] =>
  dsn ? [new URL(dsn).origin] : [];

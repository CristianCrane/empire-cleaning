import { sentryVitePlugin } from "@sentry/vite-plugin";
import type { PluginOption } from "vite";

// The build's part (ADR-0007), for the web app's and the landing site's Vite:
// the release is the git commit Render builds (RENDER_GIT_COMMIT), the same
// as the server's. With SENTRY_AUTH_TOKEN (and SENTRY_ORG), source maps are
// made, uploaded to `project` and deleted, so they're never published;
// without it (dev, tests, CI) there are none.
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
    upload &&
      sentryVitePlugin({
        project,
        release: { name: release, inject: false },
        sourcemaps: { filesToDeleteAfterUpload: ["dist/**/*.map"] },
        telemetry: false,
      }),
  ];
};

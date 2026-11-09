import { resolve } from "node:path";

// The config `pnpm pr:shots` (shots.ts) runs one checkout's end-to-end tests
// with: the package's own playwright.config.ts (PR_SHOTS_PACKAGE names the
// package's folder in that checkout, packages/web or packages/landing), with a
// full-page screenshot at the end of each test. That checkout's slots,
// databases and ports stay its own, and so does its Playwright: run it with
// the package's own runner, as a spec loads its own checkout's
// @playwright/test, so this file imports none. It works on any commit's
// checkout, whose config needs nothing for it.
const folder = process.env.PR_SHOTS_PACKAGE;
if (!folder) {
  throw new Error(
    "PR_SHOTS_PACKAGE names the package whose tests to run: run this through pnpm pr:shots",
  );
}

// what this reads of a package's config
type Config = {
  testDir?: string;
  webServer?: object | object[];
  use?: object;
  projects?: { grep?: unknown }[];
};
const { default: base } = (await import(
  resolve(folder, "playwright.config.ts")
)) as { default: Config };

export default {
  ...base,
  // its paths, from its own folder rather than this file's
  testDir: resolve(folder, base.testDir ?? "."),
  webServer: [base.webServer ?? []]
    .flat()
    .map((server) => ({ ...server, cwd: folder })),
  outputDir: process.env.PR_SHOTS_OUT,
  retries: 0,
  use: { ...base.use, screenshot: { mode: "on", fullPage: true } },
  // desktop's size for any test, not only those tagged @desktop
  projects: base.projects?.map(({ grep: _, ...project }) => project),
};

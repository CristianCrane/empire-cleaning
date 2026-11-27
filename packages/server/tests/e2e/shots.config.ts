import { resolve } from "node:path";

// The config `pnpm pr:shots` (shots.ts) runs one checkout's end-to-end tests
// with: the package's own playwright.config.ts (PR_SHOTS_PACKAGE names the
// package's folder in that checkout, packages/web or packages/landing), with a
// screenshot at the end of each test, the whole page or (PR_SHOTS_VIEWPORT,
// --viewport) the screen; or, with PR_SHOTS_PROTOTYPE (--prototype), its
// prototype.shots.ts alone, which no other run takes. That checkout's slots and databases stay its own,
// on the block of ports pr:shots leased for both sides (shots.ts), and so
// does its Playwright: run it with the package's own runner, as a
// spec loads its own checkout's @playwright/test, so this file imports none.
// It works on any commit's checkout, whose config needs nothing for it.
const folder = process.env.PR_SHOTS_PACKAGE;
if (!folder) {
  throw new Error(
    "PR_SHOTS_PACKAGE names the package whose tests to run: run this through pnpm pr:shots",
  );
}

// what this reads of a package's config
type Config = {
  testDir?: string;
  testMatch?: unknown;
  webServer?: object | object[];
  use?: object;
  projects?: { grep?: unknown; use?: { deviceScaleFactor?: number } }[];
};
const { default: base } = (await import(
  resolve(folder, "playwright.config.ts")
)) as { default: Config };

export default {
  ...base,
  // its paths, from its own folder rather than this file's
  testDir: resolve(folder, base.testDir ?? "."),
  ...(process.env.PR_SHOTS_PROTOTYPE && { testMatch: "prototype.shots.ts" }),
  webServer: [base.webServer ?? []]
    .flat()
    .map((server) => ({ ...server, cwd: folder })),
  outputDir: process.env.PR_SHOTS_OUT,
  retries: 0,
  // the whole page, or with --viewport the screen as the test left it
  use: {
    ...base.use,
    screenshot: { mode: "on", fullPage: !process.env.PR_SHOTS_VIEWPORT },
  },
  // desktop's size for any test, not only those tagged @desktop. Each
  // drawn at a power of two pixels a point, the one at or below its own: the
  // phone's 2.625 draws an icon's edge one of two ways, a few pixels apart,
  // so one commit's shots of a test differed run to run, and at 2 they
  // don't, as scaling by 2 is exact (#488)
  projects: base.projects?.map(({ grep: _, ...project }) => {
    const scale = project.use?.deviceScaleFactor ?? 1;
    const deviceScaleFactor = 2 ** Math.floor(Math.log2(scale));
    return { ...project, use: { ...project.use, deviceScaleFactor } };
  }),
};

// Every layout × case of one prototype, each shot at rest at each width, for
// `pnpm pr:shots --prototype <screen>` (shots.ts), which names the screen in
// PR_SHOTS_PROTOTYPE. A package's prototype.shots.ts runs it with its own
// harness's test, and the address of a prototype's index: the web app's
// shell (packages/web/src/screens/Prototype.tsx) and the landing site's page
// (packages/landing/src/pages/[...prototype].astro) each list every layout
// × case there as a link marked data-prototype-shot, so nothing here loads a
// prototype's code. The type alone is Playwright's, as at-rest.ts says
import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from "@playwright/test";
import { writeFileSync } from "node:fs";
import { atRest } from "./at-rest.ts";

// a phone's width on the phone project; on desktop, a tablet's, a small
// laptop's and a laptop's, where the app's frames change: the one list of
// them, which docs/ux.md and packages/web/README.md point to
const WIDTHS = [
  { project: "phone", width: 412 },
  { project: "desktop", width: 768 },
  { project: "desktop", width: 1024 },
  { project: "desktop", width: 1280 },
];

// what each shot is, as the report carries it to shots.ts: its attachment's
// name
export type PrototypeShot = {
  width: number;
  layout: string;
  layoutName: string;
  case: string;
  caseName: string;
};
const MARK = "prototype-shot ";
const shotName = (shot: PrototypeShot) => `${MARK}${JSON.stringify(shot)}`;
export const shotOf = (name: string): PrototypeShot | undefined =>
  name.startsWith(MARK) ? JSON.parse(name.slice(MARK.length)) : undefined;

export const prototypeShots = (
  test: TestType<
    PlaywrightTestArgs & PlaywrightTestOptions,
    PlaywrightWorkerArgs & PlaywrightWorkerOptions
  >,
  indexOf: (screen: string) => string,
) => {
  const screen = process.env.PR_SHOTS_PROTOTYPE;
  if (!screen) return;
  for (const { project, width } of WIDTHS) {
    test(`${screen} at ${width} px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== project, `${project}'s width`);
      await page.goto(indexOf(screen));
      const links = await page
        .locator("a[data-prototype-shot]")
        .evaluateAll((found) =>
          found.map((a) => ({
            href: a.getAttribute("href") ?? "",
            layout: a.dataset.layout ?? "",
            layoutName: a.dataset.layoutName ?? "",
            case: a.dataset.case ?? "",
            caseName: a.dataset.caseName ?? "",
          })),
        );
      if (!links.length) throw new Error(`${screen}'s index lists no case`);
      // a test per width, each shooting every layout × case, past the
      // project's 30 s, which is for one flow: approve-payment's 42 took
      // 19 s a width (51 s in all, load 0.5 to 3.0, 2026-11-25), and 5 s
      // each leaves room for a loaded machine
      test.setTimeout(30_000 + links.length * 5_000);
      const height = page.viewportSize()?.height ?? 900;
      for (const { href, ...shot } of links) {
        // at-rest.ts made the screen as tall as the last page
        await page.setViewportSize({ width, height });
        await page.goto(href);
        await page
          .locator("[data-prototype-case]")
          .waitFor({ state: "attached" });
        await page.evaluate(() => document.fonts.ready);
        const path = testInfo.outputPath(
          `${shot.layout}-${shot.case}-${width}.png`,
        );
        writeFileSync(path, await atRest(page));
        await testInfo.attach(shotName({ ...shot, width }), {
          path,
          contentType: "image/png",
        });
      }
    });
  }
};

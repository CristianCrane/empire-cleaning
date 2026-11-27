import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { builds, changedFiles, decide, outcome } from "./deploy-test-site.ts";
import { readBlueprint, type Service } from "./render-blueprint.ts";

// what the nightly deploy builds for a change, on render.yaml's own filters
const { services } = readBlueprint("render.yaml");
const LIVE = "a".repeat(40);
const TARGET = "b".repeat(40);
const all = ["empire-test-server", "empire-test-web", "empire-test-landing"];

const deploys = (
  files: string[],
  {
    live = LIVE,
    ancestor = false,
    before = services,
  }: { live?: string; ancestor?: boolean; before?: Service[] } = {},
) =>
  decide({
    target: TARGET,
    live: Object.fromEntries(services.map(({ name }) => [name, live])),
    servicesAt: (sha) => (sha === TARGET ? services : before),
    isAncestor: () => ancestor,
    changed: () => files,
  })
    .filter(({ deploy }) => deploy)
    .map(({ service }) => service);

test("render.yaml's services are the three it deploys", () => {
  expect(services.map(({ name }) => name)).toEqual(all);
});

describe("a change since the last good deploy builds", () => {
  test.each([
    [
      "the server's code: the server",
      ["packages/server/src/index.ts"],
      ["empire-test-server"],
    ],
    [
      "the web app's code: the web app",
      ["packages/web/src/main.tsx"],
      ["empire-test-web"],
    ],
    [
      "the landing site's code: the landing site",
      ["packages/landing/src/pages/index.astro"],
      ["empire-test-landing"],
    ],
    [
      "the design system: both sites",
      ["packages/ui/src/Button.tsx"],
      ["empire-test-web", "empire-test-landing"],
    ],
    ["the shared models: all three", ["packages/models/src/price.ts"], all],
    ["the lockfile: all three", ["pnpm-lock.yaml"], all],
    [
      "docs alone: nothing",
      ["README.md", "docs/ux.md", "packages/web/README.md"],
      [],
    ],
    [
      "tests and stories alone: nothing",
      [
        "packages/server/src/bills.test.ts",
        "packages/ui/src/Button.stories.tsx",
        "packages/web/e2e/bills.spec.ts",
        "packages/server/tests/seed.ts",
      ],
      [],
    ],
    [
      "email previews alone: nothing",
      ["packages/server/emails/reminder.tsx"],
      [],
    ],
    [
      "a docs file beside code: what the code builds",
      ["docs/ux.md", "packages/server/src/index.ts"],
      ["empire-test-server"],
    ],
  ])("%s", (_case, files, expected) => {
    expect(deploys(files)).toEqual(expected);
  });
});

test("a service with no good deploy on record is deployed", () => {
  expect(deploys([], { live: "" })).toEqual(all);
});

test("a commit already live, or older than what's live, deploys nothing", () => {
  expect(deploys(["pnpm-lock.yaml"], { ancestor: true })).toEqual([]);
});

test("a service whose settings in render.yaml changed is deployed", () => {
  const before = services.map((service) =>
    service.name === "empire-test-web"
      ? {
          ...service,
          envVars: [...service.envVars, { key: "VITE_NEW", value: "1" }],
        }
      : service,
  );
  expect(deploys(["render.yaml"], { before })).toEqual(["empire-test-web"]);
});

// Render's own examples (render.com/docs/monorepo-support)
test("globs match as Render's do", () => {
  expect(builds({ paths: ["**/readme.md"] }, ["readme.md"])).toBe(true);
  expect(builds({ paths: ["**/readme.md"] }, ["backend/readme.md"])).toBe(true);
  expect(builds({ paths: ["src/*"] }, ["src/a/b.ts"])).toBe(false);
  expect(builds({ ignoredPaths: ["**/*.md"] }, ["a.md"])).toBe(false);
  expect(builds({ ignoredPaths: ["**/*.md"] }, ["a.ts"])).toBe(true);
});

// Node's globs pass over a dot-path under `**`, where Render's may not: each
// tracked one a service's filter would judge otherwise is listed here, after
// a look at whether its build reads it
test("each dot-path a service's filter passes over is known", () => {
  // the server reads its environment from Render, not this file
  const known = ["packages/server/.env.example"];
  const undot = (path: string) => path.replaceAll(/(^|\/)\./g, "$1_");
  const missed = execFileSync("git", ["ls-files"], {
    cwd: new URL("../../..", import.meta.url),
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => /(^|\/)\./.test(file))
    .filter((file) =>
      services.some(
        ({ buildFilter: { paths = [], ignoredPaths = [] } = {} }) =>
          builds({ paths, ignoredPaths }, [file]) !==
          builds(
            { paths: paths.map(undot), ignoredPaths: ignoredPaths.map(undot) },
            [undot(file)],
          ),
      ),
    );
  expect(missed).toEqual(known);
});

test("a file moved out of a build counts where it was", () => {
  const repo = mkdtempSync(join(tmpdir(), "deploy-test-site-"));
  try {
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
        { cwd: repo, encoding: "utf8" },
      ).trim();
    git("init", "--quiet");
    mkdirSync(join(repo, "packages/web/src"), { recursive: true });
    writeFileSync(join(repo, "packages/web/src/helper.ts"), "export {};\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "one");
    mkdirSync(join(repo, "packages/web/e2e"));
    git("mv", "packages/web/src/helper.ts", "packages/web/e2e/helper.ts");
    git("commit", "--quiet", "-m", "two");
    const files = changedFiles(git("rev-parse", "HEAD~1"), "HEAD", repo);
    expect(files).toContain("packages/web/src/helper.ts");
    expect(deploys(files)).toEqual(["empire-test-web"]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

describe("the deploy just started, among Render's records of its commit", () => {
  // newest first, as GitHub lists them; 5 was the newest before the call
  test.each([
    [
      "isn't recorded yet",
      [{ id: 5, sha: TARGET, state: "failure" }],
      "unrecorded",
    ],
    [
      "is going, past an older failure",
      [
        { id: 6, sha: TARGET, state: "in_progress" },
        { id: 5, sha: TARGET, state: "failure" },
      ],
      "going",
    ],
    [
      "is live, past an older failure",
      [
        { id: 6, sha: TARGET, state: "success" },
        { id: 5, sha: TARGET, state: "failure" },
      ],
      "live",
    ],
    [
      "failed, past an older success",
      [
        { id: 6, sha: TARGET, state: "failure" },
        { id: 5, sha: TARGET, state: "success" },
      ],
      "failed",
    ],
    [
      "isn't another commit's deploy",
      [{ id: 6, sha: LIVE, state: "success" }],
      "unrecorded",
    ],
  ])("%s", (_case, records, expected) => {
    expect(outcome(records, 5, TARGET)).toBe(expected);
  });
});

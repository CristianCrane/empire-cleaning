// Before/after screenshots of a screen, for a PR's body (CLAUDE.md, UX):
//
//   pnpm pr:shots <spec> "<test title>" [--desktop]
//   e.g. pnpm pr:shots packages/web/e2e/bills.spec.ts "a Client pays a Bill by card"
//
// runs one end-to-end test, the web app's or the landing site's (the spec's
// path from the repo root), twice, with a full-page screenshot at its end:
// before, on the branch's merge base with origin/main, in a worktree beside
// this checkout; and after, in this checkout. Phone size, and desktop's too
// with --desktop, for a screen whose larger layout differs. Each side runs with
// its own checkout's Playwright, slots, databases and ports, through
// shots.config.ts. A test the base doesn't have gives an after alone.
//
// The PNGs go to the orphan `pr-media` branch, in a folder named after this
// branch, so a public PR's body can show them inline; it prints the table to
// paste under the body's **Before / after:**. A copy of each stays in this
// checkout's git dir, under pr-shots/. A run that fails on either side pushes
// nothing, and says which side failed.
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const USAGE =
  'Usage: pnpm pr:shots <spec> "<test title>" [--desktop]\n  e.g. pnpm pr:shots packages/web/e2e/bills.spec.ts "a Client pays a Bill by card"';

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

// this checkout, the after
const top = fileURLToPath(new URL("../../../..", import.meta.url)).replace(
  /\/$/,
  "",
);
const CONFIG = join(top, "packages/server/tests/e2e/shots.config.ts");

type Side = "before" | "after";
type Shot = { project: string; file: string };

// what Playwright's JSON report says of each test it ran
type Suite = {
  title: string;
  suites?: Suite[];
  specs?: {
    title: string;
    tests: {
      projectName: string;
      results: {
        status: string;
        attachments: { name: string; path?: string }[];
      }[];
    }[];
  }[];
};
type Report = { suites?: Suite[]; errors?: { message?: string }[] };

class Stop extends Error {}

// the test's end on each project, in one checkout; null when the base has no
// such test (a new one). Anything else that isn't a passed test with its
// screenshot, on either side, stops the run
const shoot = (
  options: { spec: string; title: string; projects: string[]; dir: string },
  checkout: string,
  side: Side,
): Shot[] | null => {
  const [, pkg = "", spec = ""] =
    /^(packages\/[^/]+)\/(.+)$/.exec(options.spec) ?? [];
  const folder = join(checkout, pkg);
  if (!existsSync(join(folder, "playwright.config.ts"))) {
    throw new Stop(
      `${options.spec} is in no package with end-to-end tests: give its path from the repo root, such as packages/web/e2e/bills.spec.ts or packages/landing/tests/landing.spec.ts.`,
    );
  }
  const out = join(options.dir, side);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const reportFile = join(out, "report.json");
  console.log(`\n› ${side}: "${options.title}", in ${checkout}`);
  spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      CONFIG,
      "--reporter=list,json",
      spec,
      "--grep",
      options.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ...options.projects.flatMap((project) => ["--project", project]),
    ],
    {
      cwd: folder,
      stdio: "inherit",
      env: {
        ...process.env,
        PR_SHOTS_PACKAGE: folder,
        PR_SHOTS_OUT: join(out, "results"),
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
      },
    },
  );
  if (!existsSync(reportFile)) {
    throw new Stop(
      `The ${side} run wrote no report: Playwright's output above says why.`,
    );
  }
  const report = JSON.parse(readFileSync(reportFile, "utf8")) as Report;
  const found: {
    title: string;
    project: string;
    status: string;
    path?: string;
  }[] = [];
  // each test by its describes and its own title, as --grep reads it
  const walk = (suite: Suite, describes: string[]) => {
    suite.suites?.forEach((inner) => walk(inner, [...describes, inner.title]));
    for (const { title, tests } of suite.specs ?? []) {
      for (const test of tests) {
        const result = test.results.at(-1);
        found.push({
          title: [...describes, title].join(" "),
          project: test.projectName,
          status: result?.status ?? "not run",
          path: result?.attachments.find(({ name }) => name === "screenshot")
            ?.path,
        });
      }
    }
  };
  report.suites?.forEach((file) => walk(file, []));
  const errors = (report.errors ?? []).map(({ message = "" }) => message);
  if (found.length === 0) {
    const none = errors.every((error) => /No tests found/.test(error));
    if (none && side === "before") return null;
    throw new Stop(
      none
        ? `No test in ${options.spec} is titled "${options.title}" (${side}).`
        : `The ${side} run failed: ${errors.join("; ")}`,
    );
  }
  const titles = new Set(found.map(({ title }) => title));
  if (titles.size > 1) {
    throw new Stop(
      `"${options.title}" names ${titles.size} tests in ${options.spec} (${[...titles].join("; ")}): give the one you mean in full.`,
    );
  }
  return found.map(({ project, status, path }) => {
    if (status !== "passed" || !path) {
      throw new Stop(
        `The test ${status === "passed" ? "left no screenshot" : status} on ${project}, ${side}: its output above says why. A test that stopped partway shows the wrong screen, so nothing was pushed.`,
      );
    }
    const file = join(
      options.dir,
      `${slug(options.title)}-${project}-${side}.png`,
    );
    copyFileSync(path, file);
    return { project, file };
  });
};

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// the base checked out in a worktree of its own for the length of `run`, at
// the same path every time, so its checkout id, and with it its databases'
// names, stay the same (tests/checkout.ts) rather than piling up
const withBase = <T>(sha: string, run: (base: string) => T): T => {
  const base = `${top}-shots-base`;
  const remove = () => {
    if (existsSync(base)) git(top, "worktree", "remove", "--force", base);
    git(top, "worktree", "prune");
  };
  remove(); // a killed run's
  git(top, "worktree", "add", "--quiet", "--detach", base, sha);
  try {
    const install = spawnSync(
      "pnpm",
      ["install", "--frozen-lockfile", "--prefer-offline", "--reporter=silent"],
      { cwd: base, stdio: "inherit" },
    );
    if (install.status !== 0) {
      throw new Stop(`pnpm install failed in the base's worktree (${base}).`);
    }
    return run(base);
  } finally {
    remove();
  }
};

// a commit on pr-media, the orphan branch PR bodies' screenshots live on,
// adding the files to the branch's folder, pushed; each file's URL there
const publish = (dir: string, branch: string, files: string[]) => {
  const remote = git(top, "remote", "get-url", "origin");
  const repo = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)?.[1];
  if (!repo) throw new Stop(`origin (${remote}) is no GitHub repo.`);
  const plumb = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: top,
      encoding: "utf8",
      env: { ...process.env, GIT_INDEX_FILE: join(dir, "index") },
    }).trim();
  // twice: another run's push can land between reading the tip and this one
  for (let attempt = 1; ; attempt++) {
    const tip = git(top, "ls-remote", "origin", "refs/heads/pr-media").split(
      /\s/,
    )[0];
    if (tip) git(top, "fetch", "--quiet", "origin", "refs/heads/pr-media");
    plumb("read-tree", ...(tip ? [tip] : ["--empty"]));
    for (const file of files) {
      const blob = git(top, "hash-object", "-w", file);
      plumb(
        "update-index",
        "--add",
        "--cacheinfo",
        `100644,${blob},${branch}/${basename(file)}`,
      );
    }
    const commit = plumb(
      "commit-tree",
      plumb("write-tree"),
      ...(tip ? ["-p", tip] : []),
      "-m",
      `Screenshots for ${branch}`,
    );
    try {
      git(top, "push", "--quiet", "origin", `${commit}:refs/heads/pr-media`);
      return (file: string) =>
        `https://raw.githubusercontent.com/${repo}/${commit}/${branch}/${basename(file)}`;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
};

const main = () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { desktop: { type: "boolean", default: false } },
  });
  const [spec, title] = positionals;
  if (!spec || !title || positionals.length > 2) throw new Stop(USAGE);
  const projects = values.desktop ? ["phone", "desktop"] : ["phone"];

  const branch = git(top, "rev-parse", "--abbrev-ref", "HEAD");
  const dir = git(
    top,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "pr-shots",
  );
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(top, "fetch", "--quiet", "origin", "main");
  let sha: string;
  try {
    sha = git(top, "merge-base", "HEAD", "origin/main");
  } catch {
    throw new Stop(
      "No merge base with origin/main: git fetch origin, then run it again.",
    );
  }
  const head = git(top, "rev-parse", "--short", "HEAD");
  const dirty = git(top, "status", "--porcelain")
    ? " and its uncommitted changes"
    : "";

  const options = { spec, title, projects, dir };
  const before = withBase(sha, (base) => shoot(options, base, "before"));
  const after = shoot(options, top, "after") ?? [];
  const url = publish(dir, branch, [
    ...(before ?? []).map(({ file }) => file),
    ...after.map(({ file }) => file),
  ]);

  const width = (project: string) => (project === "desktop" ? 450 : 300);
  const img = (shot: Shot) =>
    `<img src="${url(shot.file)}" width="${width(shot.project)}">`;
  console.log(
    `\nBefore ${sha.slice(0, 7)} (the merge base), after ${head}${dirty}. Copies in ${dir}. Paste under **Before / after:**\n`,
  );
  for (const shot of after) {
    const old = before?.find(({ project }) => project === shot.project);
    console.log(
      `${title}, ${shot.project}:\n\n| Before | After |\n| --- | --- |\n| ${old ? img(old) : "none: a new test"} | ${img(shot)} |\n`,
    );
  }
};

try {
  main();
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(`\n${error.message}`);
  process.exit(1);
}

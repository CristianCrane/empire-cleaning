// Before/after screenshots of a screen, for a PR's body (CLAUDE.md, UX): one
// end-to-end test, the web app's or the landing site's, run on the branch's
// merge base and on this checkout, each through its own checkout's
// shots.config.ts and harness, its screenshots pushed to the orphan pr-media
// branch. How to use it, and what each side does: packages/web/README.md,
// Testing, "Screenshots for a PR"; USAGE below.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const USAGE = [
  'Usage: pnpm pr:shots <spec> "<test title>" [--desktop] [--viewport]',
  "       pnpm pr:shots --same <spec>… [--desktop] [--viewport]",
  '  e.g. pnpm pr:shots packages/web/e2e/bills.spec.ts "a Client pays a Bill by card"',
  "       pnpm pr:shots --same packages/web/e2e/bills.spec.ts packages/web/e2e/jobs.spec.ts",
].join("\n");

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
type Report = {
  config?: { rootDir?: string };
  suites?: Suite[];
  errors?: { message?: string }[];
};

class Stop extends Error {}

// one test as a run's report gives it: its spec (from the repo's root), its
// describes and title, the project, how it ended and the shot at its end
type Ran = {
  spec: string;
  title: string;
  project: string;
  status: string;
  path?: string;
};

// the package a spec is in, in a checkout, and the spec's path from it
const packageOf = (spec: string, checkout: string) => {
  const [, pkg = "", file = ""] = /^(packages\/[^/]+)\/(.+)$/.exec(spec) ?? [];
  if (!existsSync(join(checkout, pkg, "playwright.config.ts"))) {
    throw new Stop(
      `${spec} is in no package with end-to-end tests: give its path from the repo root, such as packages/web/e2e/bills.spec.ts or packages/landing/tests/landing.spec.ts.`,
    );
  }
  return { pkg, file };
};

// one checkout's run of some specs of one package, each test on each
// project, through shots.config.ts: every test it ran, and the run's own
// errors (a spec that didn't load, or no test found)
const run = (
  options: {
    pkg: string;
    files: string[];
    grep?: string;
    projects: string[];
    // the screen as the test left it, not the whole page
    viewport: boolean;
    out: string;
  },
  checkout: string,
  side: Side,
): { ran: Ran[]; errors: string[] } => {
  const folder = join(checkout, options.pkg);
  rmSync(options.out, { recursive: true, force: true });
  mkdirSync(options.out, { recursive: true });
  const reportFile = join(options.out, "report.json");
  spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      CONFIG,
      "--reporter=list,json",
      ...options.files,
      ...(options.grep ? ["--grep", options.grep] : []),
      ...options.projects.flatMap((project) => ["--project", project]),
    ],
    {
      cwd: folder,
      stdio: "inherit",
      env: {
        ...process.env,
        PR_SHOTS_PACKAGE: folder,
        PR_SHOTS_OUT: join(options.out, "results"),
        ...(options.viewport && { PR_SHOTS_VIEWPORT: "1" }),
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
  const ran: Ran[] = [];
  // each test by its describes and its own title, as it's given (--grep's
  // own string has the tags too: grepFor)
  const walk = (spec: string, suite: Suite, describes: string[]) => {
    suite.suites?.forEach((inner) =>
      walk(spec, inner, [...describes, inner.title]),
    );
    for (const { title, tests } of suite.specs ?? []) {
      for (const test of tests) {
        const result = test.results.at(-1);
        ran.push({
          spec,
          title: [...describes, title].join(" "),
          project: test.projectName,
          status: result?.status ?? "not run",
          // the web app's harness takes the screen at rest (pr-shot);
          // Playwright's own is what the landing site and an older base give
          path: (
            result?.attachments.find(({ name }) => name === "pr-shot") ??
            result?.attachments.find(({ name }) => name === "screenshot")
          )?.path,
        });
      }
    }
  };
  // a spec's path in the report is from the test folder, the root's here
  const testDir = relative(checkout, report.config?.rootDir ?? folder);
  report.suites?.forEach((file) => walk(join(testDir, file.title), file, []));
  return {
    ran,
    errors: (report.errors ?? []).map(({ message = "" }) => message),
  };
};

// the test's end on each project it ran in, in one checkout; null when the
// base has no such test (a new one). A project
// it skips is left out, and said; anything else that isn't a passed test with
// its screenshot, on either side, stops the run
const shoot = (
  options: {
    spec: string;
    title: string;
    projects: string[];
    viewport: boolean;
    dir: string;
  },
  checkout: string,
  side: Side,
): Shot[] | null => {
  const { pkg, file } = packageOf(options.spec, checkout);
  console.log(`\n› ${side}: "${options.title}", in ${checkout}`);
  const { ran: found, errors } = run(
    {
      pkg,
      files: [file],
      grep: grepFor(options.title),
      projects: options.projects,
      viewport: options.viewport,
      out: join(options.dir, side),
    },
    checkout,
    side,
  );
  if (found.length === 0) {
    const none = errors.every((error) => /No tests found/.test(error));
    if (none && side === "before") return null;
    throw new Stop(
      none
        ? `No test in ${options.spec} is titled "${options.title}" (${side}).`
        : `The ${side} run failed: ${errors.join("; ")}`,
    );
  }
  // --grep finds the title anywhere in a test's, so a test whose whole title
  // is the one given wins over those it's only part of
  const titles = new Set(found.map(({ title }) => title));
  const whole = found.filter(
    ({ title }) => title.toLowerCase() === options.title.toLowerCase(),
  );
  if (titles.size > 1 && !whole.length) {
    throw new Stop(
      `"${options.title}" names ${titles.size} tests in ${options.spec} (${[...titles].join("; ")}): give the one you mean in full.`,
    );
  }
  const ran = (titles.size > 1 ? whole : found).filter(
    ({ project, status }) => {
      if (status === "skipped")
        console.log(`\n› ${side}: skipped on ${project}`);
      return status !== "skipped";
    },
  );
  if (!ran.length && side === "after") {
    throw new Stop(
      `The test skipped on every project, after: nothing to shoot.`,
    );
  }
  return ran.map((test) => {
    const { project, status, path } = test;
    if (status !== "passed" || !path) {
      throw new Stop(
        `The test ${status === "passed" ? "left no screenshot" : status} on ${project}, ${side}: its output above says why. A test that stopped partway shows the wrong screen, so nothing was pushed.`,
      );
    }
    const file = shotFile(options.dir, test, options.viewport, side);
    copyFileSync(path, file);
    return { project, file };
  });
};

// the branch's tests put over the base's, for a test the base lacks: the
// spec's whole test folder (e2e/ or tests/), so a helper a new test imports
// comes with it. They run on the base's own app, server and Playwright
const branchTestsOn = (base: string, spec: string) => {
  const { pkg, file } = packageOf(spec, top);
  const folder = join(pkg, file.split("/")[0] ?? "");
  console.log(
    `\n› before: the base lacks the test, so it runs the branch's ${folder}`,
  );
  cpSync(join(top, folder), join(base, folder), { recursive: true });
};

// Playwright's --grep reads a test's describes and title with each one's
// tags after it ("light theme @desktop the Services and …", eachTheme's),
// so a title given as its words alone matches with any tags between them
const grepFor = (title: string) =>
  RegExp.escape(title).replaceAll(
    String.raw`\x20`,
    String.raw`(?:\x20@\S+)*\x20`,
  );

// where a test's shot is kept, and its name on pr-media: its title for a
// reader, and a hash of its spec, title and project, as two specs can share a
// title and two titles their first 60 letters
const shotFile = (dir: string, test: Ran, viewport: boolean, side: Side) => {
  const hash = createHash("sha256")
    .update(`${test.spec}\n${test.title}\n${test.project}`)
    .digest("hex")
    .slice(0, 8);
  return join(
    dir,
    `${slug(test.title)}-${hash}-${test.project}${viewport ? "-viewport" : ""}-${side}.png`,
  );
};

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// the base checked out in a worktree of its own for the length of `run`, at
// the same path every time, so a killed run's is found and removed, and its
// block of ports stays the same (tests/checkout.ts)
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

type Context = {
  projects: string[];
  viewport: boolean;
  dir: string;
  branch: string;
  sha: string;
  // what the after is, for the output: HEAD's short sha, and whether the
  // checkout has changes beside it
  after: string;
};

const width = (project: string) => (project === "desktop" ? 450 : 300);

// one test, before and after, each project's pair in a table
const one = (spec: string, title: string, context: Context) => {
  const { projects, viewport, dir, branch, sha } = context;
  const options = { spec, title, projects, viewport, dir };
  // the base's own test, else the branch's on the base; a test that fails
  // there, or a spec that won't load, gives an after alone
  const before = withBase(sha, (base) => {
    const own = shoot(options, base, "before");
    if (own) return { shots: own, borrowed: false };
    branchTestsOn(base, spec);
    try {
      return { shots: shoot(options, base, "before"), borrowed: true };
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      console.log(`\n› before: none, as ${error.message}`);
      return { shots: null, borrowed: true };
    }
  });
  const after = shoot(options, top, "after") ?? [];
  const url = publish(dir, branch, [
    ...(before.shots ?? []).map(({ file }) => file),
    ...after.map(({ file }) => file),
  ]);

  const img = (shot: Shot) =>
    `<img src="${url(shot.file)}" width="${width(shot.project)}">`;
  const tests = before.borrowed ? ", with the branch's tests" : "";
  console.log(
    `\nBefore ${sha.slice(0, 7)} (the merge base${tests}), after ${context.after}. Copies in ${dir}. Paste under **Before / after:**\n`,
  );
  for (const shot of after) {
    const old = before.shots?.find(({ project }) => project === shot.project);
    const none = before.shots
      ? `none: skipped on ${shot.project}`
      : "none: a new test, which doesn't run on the base";
    console.log(
      `${title}, ${shot.project}${viewport ? ", the screen as the test left it" : ""}:\n\n| Before | After |\n| --- | --- |\n| ${old ? img(old) : none} | ${img(shot)} |\n`,
    );
  }
};

// every test of the specs, before and after, each one's end shot fresh on
// both sides and compared byte for byte: for a change that should leave
// every screen as it was (#439). It publishes the pairs that differ, and the
// first identical one on each project for the PR's body
const same = (specs: string[], context: Context) => {
  const { projects, viewport, dir, branch, sha } = context;
  const packages = Map.groupBy(specs, (spec) => packageOf(spec, top).pkg);
  const key = ({ spec, title, project }: Ran) =>
    `${spec}\n${title}\n${project}`;
  const say = ({ spec, title, project }: Ran) =>
    `${spec}: ${title}, ${project}`;
  // every test the specs hold, or those --grep names, run in one checkout
  const runAll = (
    checkout: string,
    side: Side,
    out: string,
    only?: { grep: string; packages: Set<string> },
  ) =>
    [...packages].flatMap(([pkg, inPkg]) => {
      if (only && !only.packages.has(pkg)) return [];
      console.log(
        `\n› ${side}: ${only ? "the tests it lacks" : "every test"} in ${inPkg.join(", ")}, in ${checkout}`,
      );
      const { ran, errors } = run(
        {
          pkg,
          files: inPkg.map((spec) => packageOf(spec, checkout).file),
          grep: only?.grep,
          projects,
          viewport,
          out: join(dir, out, pkg.replaceAll("/", "-")),
        },
        checkout,
        side,
      );
      // a spec that won't load stops it, though the others ran
      const failures = errors.filter((error) => !/No tests found/.test(error));
      if (failures.length)
        throw new Stop(`The ${side} run failed: ${failures.join("; ")}`);
      return ran.filter(({ status }) => status !== "skipped");
    });
  // a test that fails stops it all, as one that stopped partway shows the
  // wrong screen
  const stopOnFailed = (ran: Ran[], side: Side) => {
    const failing = ran.filter(({ status }) => status !== "passed");
    if (failing.length) {
      throw new Stop(
        `${failing.length} tests failed, ${side}, so nothing was pushed: ${failing.map(say).join("; ")}`,
      );
    }
  };

  const after = runAll(top, "after", "after");
  stopOnFailed(after, "after");
  let borrowed = 0;
  const before = withBase(sha, (base) => {
    const own = runAll(base, "before", "before");
    stopOnFailed(own, "before");
    // the tests the base lacks, run there from the branch's (#402's rule)
    const has = new Set(own.map(key));
    const lacks = after.filter((test) => !has.has(key(test)));
    if (!lacks.length) return own;
    const lacking = new Set(
      [...packages.keys()].filter((pkg) =>
        lacks.some(({ spec }) => spec.startsWith(`${pkg}/`)),
      ),
    );
    for (const pkg of lacking)
      branchTestsOn(base, packages.get(pkg)?.[0] ?? "");
    const titles = [...new Set(lacks.map(({ title }) => grepFor(title)))];
    try {
      const wanted = new Set(lacks.map(key));
      const theirs = runAll(base, "before", "before-branch", {
        grep: titles.join("|"),
        packages: lacking,
      }).filter((test) => wanted.has(key(test)) && test.status === "passed");
      borrowed = theirs.length;
      return [...own, ...theirs];
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      console.log(
        `\n› before: the branch's tests didn't run there, as ${error.message}`,
      );
      return own;
    }
  });

  const byKey = new Map(before.map((test) => [key(test), test]));
  const pairs = after.flatMap((test) => {
    const old = byKey.get(key(test));
    return old ? [{ test, old }] : [];
  });
  const paired = new Set(pairs.map(({ test }) => key(test)));
  const onlyAfter = after.filter((test) => !paired.has(key(test)));
  const onlyBefore = before.filter(
    (test) => !after.some((other) => key(other) === key(test)),
  );
  const shot = pairs.filter(({ test, old }) => test.path && old.path);
  const noShot = pairs.length - shot.length;
  const compared = shot.map(({ test, old }) => ({
    test,
    old,
    identical: readFileSync(test.path ?? "").equals(
      readFileSync(old.path ?? ""),
    ),
  }));
  const differ = compared.filter(({ identical }) => !identical);
  const identical = compared.filter(({ identical }) => identical);
  const shown = [
    ...differ,
    ...projects.flatMap((project) =>
      identical.filter(({ test }) => test.project === project).slice(0, 1),
    ),
  ];
  const files = shown.map(({ test, old }) => {
    const pair = {
      before: shotFile(dir, old, viewport, "before"),
      after: shotFile(dir, test, viewport, "after"),
    };
    copyFileSync(old.path ?? "", pair.before);
    copyFileSync(test.path ?? "", pair.after);
    return pair;
  });
  const url = files.length
    ? publish(
        dir,
        branch,
        files.flatMap(({ before, after }) => [before, after]),
      )
    : () => "";

  const tests = borrowed
    ? `, with the branch's copy of the ${borrowed === 1 ? "test" : `${borrowed} tests`} it lacks`
    : "";
  const list = (ran: Ran[]) => ran.map((test) => `\n- ${say(test)}`).join("");
  console.log(
    `\nBefore ${sha.slice(0, 7)} (the merge base${tests}), after ${context.after}${viewport ? ", the screen as each test left it" : ""}. Copies in ${dir}.\n`,
  );
  console.log(
    `${identical.length} of ${compared.length} identical (${projects.join(" and ")}).`,
  );
  if (differ.length)
    console.log(`\nDifferent:${list(differ.map(({ test }) => test))}`);
  if (onlyAfter.length)
    console.log(`\nAfter alone, as the base can't run them:${list(onlyAfter)}`);
  if (onlyBefore.length)
    console.log(
      `\nBefore alone, as the branch has no such test:${list(onlyBefore)}`,
    );
  if (noShot)
    console.log(`\n${noShot} tests open no page, so have no shot to compare.`);
  if (!shown.length) return;
  console.log("\nPaste under **Before / after:**\n");
  shown.forEach(({ test, identical: same }, n) => {
    const img = (file: string) =>
      `<img src="${url(file)}" width="${width(test.project)}">`;
    console.log(
      `${test.title}, ${test.project}, ${same ? "identical" : "different"}:\n\n| Before | After |\n| --- | --- |\n| ${img(files[n]?.before ?? "")} | ${img(files[n]?.after ?? "")} |\n`,
    );
  });
};

const main = () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      desktop: { type: "boolean", default: false },
      viewport: { type: "boolean", default: false },
      same: { type: "boolean", default: false },
    },
  });
  const [spec, title] = positionals;
  if (
    values.same
      ? !positionals.length
      : !spec || !title || positionals.length > 2
  )
    throw new Stop(USAGE);

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
  const context: Context = {
    projects: values.desktop ? ["phone", "desktop"] : ["phone"],
    viewport: values.viewport,
    dir,
    branch: git(top, "rev-parse", "--abbrev-ref", "HEAD"),
    sha,
    after: `${head}${dirty}`,
  };
  if (values.same) same(positionals, context);
  else one(spec ?? "", title ?? "", context);
};

try {
  main();
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(`\n${error.message}`);
  process.exit(1);
}

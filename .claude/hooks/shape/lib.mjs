// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// What the shape hooks share: git, and the survey, plan review and review
// files the `shape` skill writes into the git dir (never committed, kept
// per worktree): one set per branch, and on main one per session.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

// A repo's copy of these hooks (for cloud sessions, which have no
// ~/.claude) stands aside wherever the user-level ones are installed, so
// only the newest rules run, and only once. A copy knows itself by where
// sync puts it.
const standAside =
  dirname(fileURLToPath(import.meta.url)).endsWith("/.claude/hooks/shape") &&
  existsSync(join(homedir(), ".claude/hooks/lib.mjs"));

export const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

const lines = (text) => text.split("\n").filter(Boolean);

// Runs a hook's body on its input and prints what the body returns. A
// repo's copy stands aside here, and any failure (not a git checkout, bad
// input) stays silent, so the tool call goes through.
export const hook = (body) => {
  if (standAside) return;
  try {
    const output = body(JSON.parse(readFileSync(0, "utf8")));
    if (output) console.log(JSON.stringify(output));
  } catch {}
};

export const deny = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

// the edited file's own checkout (the nearest folder that exists: a new
// file's own may not yet), so an edit in a worktree counts that worktree
export const cwdFor = (input) => {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return input.cwd;
  let cwd = dirname(path);
  while (!existsSync(cwd)) cwd = dirname(cwd);
  return cwd;
};

// the branch being worked on, and the name its files go by: the branch,
// or on main the session too (work straight on main is one change per
// session); null on a detached HEAD (a rebase, a bisect), which is not gated
export const workOf = (cwd, input) => {
  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "HEAD") return null;
  const onMain = ["main", "master"].includes(branch) && input.session_id;
  return { branch, key: onMain ? `${branch}-${input.session_id}` : branch };
};

export const stateFile = (cwd, kind, key) => {
  const path = git(
    cwd,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    `claude/${kind}-${key.replaceAll("/", "-")}.md`,
  );
  mkdirSync(dirname(path), { recursive: true });
  return path;
};

// the checked-out commit's full sha; "" before the first commit
const headSha = (cwd) => {
  try {
    return git(cwd, "rev-parse", "HEAD");
  } catch {
    return "";
  }
};

// the survey and whether it counts: it must name a path that exists
const survey = (cwd, key) => {
  const path = stateFile(cwd, "survey", key);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  const text = readFileSync(path, "utf8");
  const top = git(cwd, "rev-parse", "--show-toplevel");
  const named = text
    .split(/[\s,;()`'"<>]+/)
    .map((word) => word.replace(/[:.]+$/, ""))
    .filter((word) => /\w/.test(word) && /[/.]/.test(word))
    .some((word) => existsSync(isAbsolute(word) ? word : join(top, word)));
  if (!named) return { path, ok: false, reason: "names no path that exists" };
  const expected = Number(text.match(/^Expected files:\s*~?(\d+)/m)?.[1]);
  const stackedOn = text.match(/^Base:\s*(\S+)/m)?.[1] ?? null;
  return { path, ok: true, expected: expected || null, stackedOn };
};

// the reviewer's read of the survey, before any code: once is enough
const planReview = (cwd, key) => {
  const path = stateFile(cwd, "plan-review", key);
  return existsSync(path) ? { path, ok: true } : { path, ok: false, reason: "missing" };
};

// what an edit waits for: the survey, then the plan review; `missing`
// says the first one not done yet
export const beforeEdit = (cwd, work) => {
  const found = survey(cwd, work.key);
  if (!found.ok)
    return {
      survey: found,
      missing: `there is no survey for ${work.branch} (${found.reason}): load the \`shape\` skill and write its survey to ${found.path}`,
    };
  const plan = planReview(cwd, work.key);
  if (!plan.ok)
    return {
      survey: found,
      missing: `the survey for ${work.branch} has no plan review: run the shape-reviewer agent on it in plan mode, as the \`shape\` skill's Plan review step says, with survey ${found.path} and output ${plan.path}`,
    };
  return { survey: found, missing: null };
};

// the reviewer's read of the diff: it must be of the last commit (written
// after it isn't enough: a round runs while fixes may land), and before
// round 3 leave no block open (after round 3 the user decides). The
// reviewer's header line says all three: "… @ <sha>, round <n>, <k> open
// blocks", where a recheck says "recheck of round <n>", keeping the number.
export const review = (cwd, key) => {
  const path = stateFile(cwd, "review", key);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  const header = readFileSync(path, "utf8").match(/^# Shape review:.* @ ([0-9a-f]{7,40}),.*round (\d+), (\d+) open block/m);
  if (!header) return { path, ok: false, reason: "its header has no commit, round and open-block count" };
  const [sha, ...counts] = header.slice(1);
  if (!headSha(cwd).startsWith(sha)) return { path, ok: false, reason: `it reviewed ${sha}, not the last commit` };
  const [round, open] = counts.map(Number);
  if (open && round < 3)
    return { path, ok: false, reason: `round ${round} left ${open} block(s) open: fix them and run round ${round + 1}` };
  return { path, ok: true };
};

// what the branch is measured against: where it left the branch it's
// stacked on (the survey's Base:, while that still resolves), else the
// default branch
const base = (cwd, stackedOn) => {
  const stack = stackedOn ? [`origin/${stackedOn}`, stackedOn] : [];
  for (const ref of [...stack, "origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    try {
      return git(cwd, "merge-base", "HEAD", ref);
    } catch {}
  }
  return "HEAD";
};

// files the branch changes against its base, untracked ones included
export const changedFiles = (cwd, stackedOn) =>
  new Set([
    ...lines(git(cwd, "diff", "--name-only", base(cwd, stackedOn))),
    ...lines(git(cwd, "ls-files", "--others", "--exclude-standard")),
  ]);

// whether `path` sits in the git dir (where the survey and review live)
export const inGitDir = (cwd, path) =>
  [
    git(cwd, "rev-parse", "--path-format=absolute", "--git-dir"),
    git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
  ].some((dir) => path.startsWith(dir + "/"));

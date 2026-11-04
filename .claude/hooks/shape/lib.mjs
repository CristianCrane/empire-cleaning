// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// What the shape hooks share: git, and the per-branch survey and review
// files the `shape` skill writes into the git dir (never committed, kept
// per worktree).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
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

// null on a detached HEAD (a rebase, a bisect): nothing is gated there
export const branchOf = (cwd) => {
  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  return branch === "HEAD" ? null : branch;
};

export const stateFile = (cwd, kind, branch) => {
  const path = git(
    cwd,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    `claude/${kind}-${branch.replaceAll("/", "-")}.md`,
  );
  mkdirSync(dirname(path), { recursive: true });
  return path;
};

// seconds since the epoch; 0 before the first commit
const headTime = (cwd) => {
  try {
    return Number(git(cwd, "log", "-1", "--format=%ct"));
  } catch {
    return 0;
  }
};

const mainBranches = ["main", "master"];

// the branch's survey and whether it counts: it must name a path that
// exists, and on main it must be newer than the last commit (each change
// on main gets its own)
export const survey = (cwd, branch) => {
  const path = stateFile(cwd, "survey", branch);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  const text = readFileSync(path, "utf8");
  if (
    mainBranches.includes(branch) &&
    statSync(path).mtimeMs / 1000 < headTime(cwd)
  )
    return { path, ok: false, reason: "older than the last commit" };
  const top = git(cwd, "rev-parse", "--show-toplevel");
  const named = text
    .split(/[\s,;()`'"<>]+/)
    .map((word) => word.replace(/[:.]+$/, ""))
    .filter((word) => /\w/.test(word) && /[/.]/.test(word))
    .some((word) => existsSync(isAbsolute(word) ? word : join(top, word)));
  if (!named) return { path, ok: false, reason: "names no path that exists" };
  const expected = Number(text.match(/^Expected files:\s*~?(\d+)/m)?.[1]);
  return { path, ok: true, expected: expected || null };
};

export const review = (cwd, branch) => {
  const path = stateFile(cwd, "review", branch);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  if (statSync(path).mtimeMs / 1000 < headTime(cwd))
    return { path, ok: false, reason: "older than the last commit" };
  return { path, ok: true };
};

// what the branch is measured against: where it left the default branch
const base = (cwd) => {
  for (const ref of ["origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    try {
      return git(cwd, "merge-base", "HEAD", ref);
    } catch {}
  }
  return "HEAD";
};

// files the branch changes against its base, untracked ones included
export const changedFiles = (cwd) =>
  new Set([
    ...lines(git(cwd, "diff", "--name-only", base(cwd))),
    ...lines(git(cwd, "ls-files", "--others", "--exclude-standard")),
  ]);

// whether `path` sits in the git dir (where the survey and review live)
export const inGitDir = (cwd, path) =>
  [
    git(cwd, "rev-parse", "--path-format=absolute", "--git-dir"),
    git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
  ].some((dir) => path.startsWith(dir + "/"));

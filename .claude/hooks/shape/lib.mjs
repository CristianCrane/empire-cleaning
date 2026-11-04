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

export const lines = (text) => text.split("\n").filter(Boolean);

// the top folder of the checkout `cwd` is in
export const topOf = (cwd) => git(cwd, "rev-parse", "--show-toplevel");

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

// the survey and whether it counts: it must name a path that exists,
// with or without its lines (`path:12`, `path:3-5`)
const survey = (cwd, key) => {
  const path = stateFile(cwd, "survey", key);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  const text = readFileSync(path, "utf8");
  const top = topOf(cwd);
  const named = text
    .split(/[\s,;()`'"<>]+/)
    .map((word) => word.replace(/[:.]+$/, "").replace(/:\d[\d-]*$/, ""))
    .filter((word) => /\w/.test(word) && /[/.]/.test(word))
    .some((word) => existsSync(isAbsolute(word) ? word : join(top, word)));
  if (!named) return { path, ok: false, reason: "names no path that exists" };
  const expected = Number(text.match(/^Expected files:\s*~?(\d+)/m)?.[1]);
  return { path, ok: true, expected: expected || null };
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

// how a comment line starts: `#` in HASH files, `//` in SLASHES files;
// C_STYLE files also have block comments, from a line starting `/*` to
// one ending in its first `*/`. A shebang, a `///` directive or a pragma
// on the PRAGMA list (it changes what a tool checks; any `@` tag counts as
// one) is never a comment line here; a directive missing from the list
// is. The reader knows nothing of strings, so a comment-like line inside a
// multi-line string counts as a comment.
const HASH = /\.(sh|bash|zsh|nix|py|ya?ml|toml)$/;
const SLASHES = /\.(m?js|cjs|jsx|tsx?)$/;
const C_STYLE = /\.(m?js|cjs|jsx|tsx?|css)$/;
const PRAGMA =
  /^#!|^\/\/\/\s*<|@|-\*-|^\/\*\s*(?:globals?|exported)\s|eslint-|tslint:|prettier-ignore|biome-ignore|c8 ignore|v8 ignore|istanbul ignore|noqa|type:|mypy:|pyright:|pragma:|pylint:|shellcheck|fmt:/;

// reads one side of a file line by line, following its block comments,
// and says whether each line is a comment line
const commentReader = (file) => {
  let inBlock = false;
  return (line) => {
    if (inBlock || (C_STYLE.test(file) && line.startsWith("/*"))) {
      const close = line.indexOf("*/");
      inBlock = close < 0;
      return close < 0 || close === line.length - 2;
    }
    return HASH.test(file) ? line.startsWith("#") : SLASHES.test(file) && line.startsWith("//");
  };
};

// whether every line changed from `sha` to HEAD is blank or a comment
// line, each in a file whose comments these know; a new, deleted or
// renamed file, a submodule, a mode change, or any other kind of file
// isn't. Both diffs are plumbing (diff-tree, run from the top of the
// checkout), which skips most diff config: relative paths, colour,
// external drivers and textconv never apply, though suppressBlankEmpty
// still does (see below).
const commentOnly = (cwd, sha) => {
  try {
    const top = topOf(cwd);
    const diffOf = (...args) => git(top, "diff-tree", "-r", "--ignore-submodules=none", ...args);
    return lines(diffOf("--name-status", "--no-renames", sha, "HEAD")).every((entry) => {
      const [status, file] = entry.split("\t");
      if (status !== "M" || !(HASH.test(file) || C_STYLE.test(file))) return false;
      // the whole file as context, so each side's block comments are
      // followed; a file .gitattributes marks binary has no hunk
      const diff = diffOf("-p", "--unified=100000000", sha, "HEAD", "--", file);
      const hunk = diff.search(/^@@/m);
      if (hunk < 0 || /^(?:old|new) mode /m.test(diff)) return false;
      const read = { "-": commentReader(file), "+": commentReader(file) };
      return diff
        .slice(hunk)
        .split("\n")
        .slice(1)
        .every((raw) => {
          const mark = raw[0] ?? " "; // diff.suppressBlankEmpty drops a blank context line's space
          if (mark === "\\") return true; // "\ No newline at end of file"
          const line = raw.slice(1).trim();
          if (mark === " ") {
            read["-"](line);
            read["+"](line);
            return true;
          }
          return read[mark](line) ? !PRAGMA.test(line) : !line;
        });
    });
  } catch {
    return false;
  }
};

// the round after which open shape findings go to the user (the `shape`
// skill's "After round 5")
const LAST_ROUND = 5;

// the reviewer's read of the diff: it must be of the last commit (written
// after it isn't enough: a round runs while fixes may land), or of one
// before it with only comment lines changed since; and before the last
// round it must leave no shape finding open (after it the user decides). The
// reviewer's header line says all three: "… @ <sha>, round <n>, <k> open
// shape findings", where a recheck says "recheck of round <n>", keeping
// the number. "open blocks" is the count's old name, which copies of the
// reviewer synced before the rename still write; it goes once every
// repo's copy is synced.
export const review = (cwd, key) => {
  const path = stateFile(cwd, "review", key);
  if (!existsSync(path)) return { path, ok: false, reason: "missing" };
  const text = readFileSync(path, "utf8");
  const header = text.match(/^# Shape review:.* @ ([0-9a-f]{7,40}),.*round (\d+), (\d+) open (?:shape finding|block)/m);
  if (!header) return { path, ok: false, reason: "its header has no commit, round and open count" };
  const [sha, ...counts] = header.slice(1);
  if (!headSha(cwd).startsWith(sha) && !commentOnly(cwd, sha))
    return { path, ok: false, reason: `it reviewed ${sha}, and the commits since change more than comment lines` };
  const [round, open] = counts.map(Number);
  if (open && round < LAST_ROUND)
    return {
      path,
      ok: false,
      reason: `round ${round} left ${open} shape finding(s) open: fix them and run round ${round + 1}, but take a reopened finding, or one the reviewer holds against your pushback, to the user`,
    };
  // the last review (the file's first) lists every finding of the change
  const last = text.slice(header.index).split(/^(?=# Shape review:)/m)[0];
  const ids = [...new Set([...last.matchAll(/^(?:- )?(F\d+)\b/gm)].map((id) => id[1]))];
  return { path, ok: true, ids };
};

// whether `sha` names a commit the branch adds to its base
export const onBranch = (cwd, sha) => {
  try {
    const full = git(cwd, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`);
    return lines(git(cwd, "rev-list", `${base(cwd)}..HEAD`)).includes(full);
  } catch {
    return false;
  }
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

// files the branch changes against its base, untracked ones included,
// across the whole checkout wherever `cwd` sits in it
export const changedFiles = (cwd) => {
  const top = topOf(cwd);
  return new Set([
    ...lines(git(top, "diff", "--no-relative", "--name-only", base(top))),
    ...lines(git(top, "ls-files", "--others", "--exclude-standard")),
  ]);
};

// whether `path` sits in the git dir (where the survey and review live)
export const inGitDir = (cwd, path) =>
  [
    git(cwd, "rev-parse", "--path-format=absolute", "--git-dir"),
    git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
  ].some((dir) => path.startsWith(dir + "/"));

// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// What the change hooks share: git, and the survey, plan review and review
// files the `change` skill writes into the git dir (never committed, kept
// per worktree): one set per branch, and on main one per change.
//
// A gate that must know what a command acts on (which PR) has it named one
// way and turns every other way down, saying how to run it: reading each
// spelling the tool accepts (-R…, GH_REPO, flags before `pr`) kept missing
// routes, round after round (47b0a6c, 3b948a6, then 6442db7 took this
// shape; the cases: change-hooks.test.mjs).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// A repo's copy of these hooks (for cloud sessions, which have no
// ~/.claude) stands aside wherever the user-level ones are installed, so
// only the newest rules run, and only once. A copy knows itself by where
// sync puts it.
const standAside =
  dirname(fileURLToPath(import.meta.url)).endsWith("/.claude/hooks/change") &&
  existsSync(join(homedir(), ".claude/hooks/lib.mjs"));

export const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

export const lines = (text) => text.split("\n").filter(Boolean);

// the flags a script run by hand was given (node's parseArgs, strict): a
// flag it doesn't know prints how it runs and exits 1, so a typo never runs
// it (`prune-merged.mjs --dryrun` ran a real prune when flags were looked
// up one by one)
export const flagsOf = (name, usage, config) => {
  try {
    return parseArgs({ ...config, strict: true });
  } catch (error) {
    console.error(`${name}: ${error.message}\nUsage: node ~/.claude/hooks/${name}.mjs ${usage}`);
    process.exit(1);
  }
};

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

// what a hook answers to add `text` to the agent's context on `event`
// (SessionStart, PostToolUse, SubagentStart …)
export const context = (event, text) => ({
  hookSpecificOutput: { hookEventName: event, additionalContext: text },
});

// a heredoc: its opening line (the tag quoted or not), its body, and the
// line closing it
export const HEREDOC = /(<<-?\s*(['"]?)(\w+)\2[^\n]*\n)([\s\S]*?\n)(\t*\3)(?=\n|$)/g;

// the command with heredoc bodies and quoted text blanked out, keeping
// every other character where it was
export const masked = (command) =>
  command
    .replace(HEREDOC, (_, open, _q, _tag, body, close) => open + body.replace(/[^\n]/g, " ") + close)
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (quoted) => quoted[0] + " ".repeat(quoted.length - 2) + quoted[0]);

// where one command ends and the next starts, in the masked text: an &
// in a redirect (2>&1, >&2, &>f, <&0) is no command boundary, nor is an
// escaped character (find's `\(`), and a paren (a subshell, a
// substitution) is one
export const BOUNDARY = String.raw`(?<!\\)(?:[;|\n()]|(?<![<>])&(?!>))`;

// a redirect, in the masked text: its fd, its operator, and its target
// (group 1: a word, quoted or not; `>&file` is `&>file`), or an fd it
// copies or closes (>&2, <&-)
export const REDIRECT = String.raw`(?:\d*|&)(?:>\||>>?|<>|<<<|<<-?|<)(?:&[\d-](?=[\s;&|<>()]|$)|&?\s*((?:"[^"]*"|'[^']*'|[^\s;&|<>()'"])*))`;

// a shell word: unquoted runs and quoted strings, with nothing between
export const WORD = /(?:[^\s'"]+|'[^']*'|"(?:\\.|[^"\\])*")+/g;

// a word's text, its quotes taken off
export const unquote = (word) =>
  word.replace(/'([^']*)'|"((?:\\.|[^"\\])*)"/g, (_, single, double) => single ?? double.replace(/\\(.)/g, "$1"));

// whether any word is one of `flags`: a long one alone or, ending in `=`,
// with its value; a one-letter one alone, among a cluster's letters
// (`-nri`), or with its value attached (`-o/tmp/x`)
export const has = (words, ...flags) =>
  words.some((word) =>
    flags.some((flag) =>
      flag.endsWith("=")
        ? word === flag.slice(0, -1) || word.startsWith(flag)
        : word === flag || (/^-\w$/.test(flag) && (word.startsWith(flag) || (/^-[a-zA-Z]+$/.test(word) && word.includes(flag[1])))),
    ),
  );

// the command substitutions the shell runs in `command`: $( ), backticks,
// <( ) and >( ) (not in double quotes), outermost ones only, each as { start, end, inner } (its
// command). None in single quotes or a quoted-tag heredoc's body, which are
// literal; one left open runs to the end of the command
export const substitutions = (command) => {
  const bodies = [...command.matchAll(HEREDOC)].map((found) => {
    const start = found.index + found[1].length;
    return { start, end: start + found[4].length, quoted: Boolean(found[2]) };
  });
  const found = [];
  // reads from `from` to the `close` that ends the substitution it's in
  // (none at the top), and gives that close's index
  const walk = (from, close, depth) => {
    let double = false;
    let parens = 0;
    for (let at = from; at < command.length; at++) {
      const body = bodies.find((one) => at >= one.start && at < one.end);
      if (body?.quoted) {
        at = body.end - 1;
        continue;
      }
      // quotes are plain characters in an unquoted-tag heredoc's body, though
      // not in a substitution there
      const plain = body && depth === 0;
      const char = command[at];
      if (char === "\\") at++;
      else if (close === "`" && char === "`") return at;
      else if (!plain && char === '"') double = !double;
      else if (!plain && !double && char === "'") {
        const shut = command.indexOf("'", at + 1);
        at = shut < 0 ? command.length : shut;
      }
      // <( ) and >( ) are plain text in double quotes; $( ) and backticks aren't
      else if (char === "`" || (char === "(" && (command[at - 1] === "$" || (!double && /[<>]/.test(command[at - 1] ?? ""))))) {
        const end = walk(at + 1, char === "`" ? "`" : ")", depth + 1);
        if (depth === 0) found.push({ start: char === "`" ? at : at - 1, end: Math.min(end + 1, command.length), inner: command.slice(at + 1, end) });
        at = end;
      } else if (close === ")" && !double && char === "(") parens++;
      else if (close === ")" && !double && char === ")" && parens-- === 0) return at;
    }
    return command.length;
  };
  walk(0, null, 0);
  return found;
};

// a command's own arguments, from `end` up to the next command, in the
// masked text (so a quoted title or body is blanks)
export const argsOf = (hidden, end) => {
  const stop = hidden.slice(end).search(new RegExp(BOUNDARY));
  return hidden.slice(end, stop < 0 ? undefined : end + stop);
};

// the folder a command runs in at `at`: the last `cd` before it, if any, found in the
// masked command with its substitutions blanked too (so a `cd` in a
// heredoc, a quote or a substitution doesn't count) and read from the original
export const dirOf = (command, hidden, at, cwd) => {
  const outside = hidden.slice(0, at).split("");
  for (const { start, end } of substitutions(command)) outside.fill(" ", start, end);
  const cds = [...outside.join("").matchAll(new RegExp(String.raw`(?:^|${BOUNDARY})\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|)]+)`, "dg"))];
  if (cds.length === 0) return cwd;
  const [start, end] = cds.at(-1).indices[1];
  const dir = unquote(command.slice(start, end)).replace(/^~(?=\/|$)/, homedir());
  return resolve(cwd, dir);
};

// the edited file's own checkout (the nearest folder that exists: a new
// file's own may not yet), so an edit in a worktree counts that worktree;
// through a symlink (~/.claude's links into the dotfiles), the checkout
// it really is in, so the link is gated like its target; for a shell
// command, the folder its last `cd` leaves (an agent's shell starts in its
// parent's folder on every call, so it works in its own worktree by cd)
export const cwdFor = (input) => {
  const command = input.tool_input?.command;
  if (command) return dirOf(command, masked(command), command.length, input.cwd);
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return input.cwd;
  let at = path;
  while (!existsSync(at)) at = dirname(at);
  const real = realpathSync(at);
  return at === path ? dirname(real) : real;
};

// the branch being worked on, and the name its files go by: the branch,
// or on main one change's: the session, and the commit where HEAD meets
// origin (7 characters of it, a length that never grows). That commit
// holds while the change's commits are unpushed and moves once they land,
// so the next change's first edit needs a new survey (without it, a
// session's later changes rode its first one's survey). It moves too when
// HEAD takes in origin's newer work (a pull, a merge, a rebase): then move
// the change's files to the path the turn-down names. With no origin,
// the session alone. null on a detached HEAD (a rebase, a bisect), which
// is not gated
export const workOf = (cwd, input) => {
  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "HEAD") return null;
  if (!["main", "master"].includes(branch) || !input.session_id) return { branch, key: branch };
  const start = originBase(cwd);
  return { branch, key: [branch, input.session_id, start?.slice(0, 7)].filter(Boolean).join("-") };
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
// from the top of the checkout or absolute, with or without its lines
// (`path:12`, `path:3-5`). When it names none, `fix` says what to
// write: the full path of a file it names by its name alone, or the files
// that name could be, or else a path from the top as an example
const survey = (cwd, key) => {
  const path = stateFile(cwd, "survey", key);
  if (!existsSync(path)) return { path, ok: false };
  const text = readFileSync(path, "utf8");
  const top = topOf(cwd);
  const words = text
    .split(/[\s,;()`'"<>]+/)
    .map((word) => word.replace(/[:.]+$/, "").replace(/:\d[\d-]*$/, ""))
    .filter((word) => /\w/.test(word) && /[/.]/.test(word));
  if (!words.some((word) => existsSync(isAbsolute(word) ? word : join(top, word)))) {
    const tracked = lines(git(top, "ls-files"));
    const short = words
      .map((word) => [word, tracked.filter((file) => file.endsWith(`/${word}`))])
      .find(([, files]) => files.length);
    const fix = !short
      ? `such as \`${tracked.find((file) => file.includes("/")) ?? "src/index.ts"}\``
      : short[1].length === 1
        ? `\`${short[0]}\` is \`${short[1][0]}\``
        : `\`${short[0]}\` could be ${short[1].length} files, such as \`${short[1][0]}\`: give the one you mean`;
    return { path, ok: false, fix };
  }
  const expected = Number(text.match(/^Expected files:\s*~?(\d+)/m)?.[1]);
  return { path, ok: true, expected: expected || null };
};

// the reviewer's read of the survey, before any code: once is enough
const planReview = (cwd, key) => {
  const path = stateFile(cwd, "plan-review", key);
  return existsSync(path) ? { path, ok: true } : { path, ok: false, reason: "missing" };
};

// A dictated change (the change skill's rule): a config change the user
// dictated exactly skips the plan review and the review, held as tight as
// a gate can hold it. Its survey is one line, `dictated:` and the user's
// words in double quotes, found (whitespace aside) in a message the user
// typed: the transcript's `origin.kind: "human"` entries, never an
// agent's relay, a tool result or a task notification (a subagent's hook
// input carries the main session's transcript_path, seen live). It names
// one file, a Claude settings file, and that file is the whole change.
// Both sides parse as JSON, and every key path that differs (an array's
// entries by value) only makes Claude ask or refuse more: an allow rule
// removed, a deny or ask rule added, or the model or theme set (NARROWS);
// five at most, each named in the quote as a whole word (between spaces
// or quote marks, trailing punctuation aside: the rule itself, the
// value), so a bare `Bash` inside `Bash(rm *)`, or `sonnet` inside
// `sonnet[1m]`, names nothing. Anything that widens what runs, and a
// plugin either way, takes the full flow: a rule change can only ask
// more, and a model or theme is set only to a value the quote names whole.
//
// What it can't hold: a quote cut from a sentence that negates it ("don't
// add …"), and the transcript itself, which sits outside any checkout, so
// no gate stops a write to it.
const NARROWS = [
  [/^permissions\.allow\[/, (was, is) => is === undefined],
  [/^permissions\.(?:deny|ask)\[/, (was) => was === undefined],
  [/^(?:model|theme)$/, (was, is) => is !== undefined],
];
const DICTATED_MOST = 5;

// text with its whitespace runs as one space
const flat = (text) => text.replace(/\s+/g, " ").trim();

// a JSON value's leaves as { path: value }, an array's entries by value
const leaves = (value, path = "", into = {}) => {
  if (Array.isArray(value)) for (const entry of value) into[`${path}[${JSON.stringify(entry)}]`] = true;
  else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value)) leaves(inner, path ? `${path}.${key}` : key, into);
  else into[path] = JSON.stringify(value);
  return into;
};

// whether the user typed `quote` in this session
const userTyped = (transcript, quote) => {
  const wanted = flat(quote);
  return lines(readFileSync(transcript, "utf8")).some((line) => {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "user" || entry.isMeta || entry.origin?.kind !== "human") return false;
      const content = entry.message?.content;
      const text = typeof content === "string" ? content : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join(" ");
      return flat(text).includes(wanted);
    } catch {
      return false;
    }
  });
};

// null when the survey isn't dictated; else { holds: true }, or { why }:
// the first limit the change is past. `pending` is the edit about to be
// made, { path, content }, if any
export const dictatedHolds = (cwd, work, input, pending) => {
  const path = stateFile(cwd, "survey", work.key);
  if (!existsSync(path)) return null;
  const said = lines(readFileSync(path, "utf8")).filter((line) => line.trim());
  const quote = said.length === 1 && said[0].match(/\bdictated:.*?"([^"]{8,})"/)?.[1];
  if (!quote) return null;
  try {
    if (!input.transcript_path || !userTyped(input.transcript_path, quote))
      return { why: "its quote isn't in a message the user typed in this session (a relay or your own words don't count)" };
    const top = topOf(cwd);
    const named = [...new Set(said[0].split(/[\s,;()`'"<>]+/).filter((word) => /[/.]/.test(word) && existsSync(isAbsolute(word) ? word : join(top, word))))];
    if (named.length !== 1) return { why: "it doesn't name exactly one file" };
    const file = isAbsolute(named[0]) ? named[0].slice(top.length + 1) : named[0];
    if (!/(?:^|\/)\.claude\/settings(?:\.local)?\.json$/.test(file)) return { why: `${file} isn't a Claude settings file` };
    const changed = changedFiles(cwd);
    if (pending) changed.add((existsSync(pending.path) ? realpathSync(pending.path) : resolve(pending.path)).slice(top.length + 1));
    if ([...changed].some((one) => one !== file)) return { why: `the change goes past ${file}` };
    let before = {};
    try {
      before = JSON.parse(git(top, "show", `${base(top)}:${file}`));
    } catch (error) {
      if (lines(git(top, "ls-tree", "--name-only", base(top), "--", file)).length) throw error;
    }
    const after = JSON.parse(pending ? pending.content : readFileSync(join(top, file), "utf8"));
    const [old, now] = [leaves(before), leaves(after)];
    const differ = [...new Set([...Object.keys(old), ...Object.keys(now)])].filter((key) => old[key] !== now[key]);
    const wider = differ.find((key) => !NARROWS.some(([path, narrows]) => path.test(key) && narrows(old[key], now[key])));
    if (wider)
      return { why: `it changes \`${wider}\`: only an allow rule removed, a deny or ask rule added, or the model or theme set may be dictated` };
    if (differ.length > DICTATED_MOST) return { why: `it changes ${differ.length} entries, more than ${DICTATED_MOST}` };
    // each entry's own text (an array's entry, a value), as a whole token
    const spoken = flat(quote);
    const unnamed = differ.find((key) => {
      const entry = key.match(/\[(.*)\]$/)?.[1];
      const text = flat(String(entry ? JSON.parse(entry) : JSON.parse(now[key])));
      return !new RegExp(String.raw`(?<=^|[\s"'\x60])` + text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`(?=[,;.!?)]*(?:$|[\s"'\x60]))`).test(spoken);
    });
    if (unnamed) return { why: `the user's quote doesn't name \`${unnamed}\`'s entry` };
    return { holds: true };
  } catch {
    return { why: "its file or its base doesn't read as JSON" };
  }
};

// what an edit waits for: the survey, then the plan review (unless the
// change is dictated and holds); `missing` says the first one not done yet
export const beforeEdit = (cwd, work, input = {}, pending = null) => {
  const found = survey(cwd, work.key);
  if (!found.ok)
    return {
      survey: found,
      missing: found.fix
        ? `the survey for ${work.branch} (${found.path}) names no file by its path from the top of the checkout (${found.fix}): name each file it touches so`
        : `there is no survey for ${work.branch}: load the \`change\` skill and write its survey to ${found.path}`,
    };
  const plan = planReview(cwd, work.key);
  if (!plan.ok) {
    const dictated = dictatedHolds(cwd, work, input, pending);
    if (dictated?.holds) return { survey: found, missing: null };
    return {
      survey: found,
      missing: dictated
        ? `the survey for ${work.branch} is dictated, but ${dictated.why}. A dictated change is one Claude settings file the user named, that only makes Claude ask or refuse more, or sets the model or theme to a value the user named, each entry in the user's words; anything wider gets the full flow: a full survey (${found.path}) and its plan review (the change-reviewer agent in plan mode, output ${plan.path})`
        : `the survey for ${work.branch} has no plan review: run the change-reviewer agent on it in plan mode, as the \`change\` skill's Plan review step says, with survey ${found.path} and output ${plan.path}`,
    };
  }
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

// the round after which open change findings go to the user (the `change`
// skill's "After round 5")
const LAST_ROUND = 5;

// the reviewer's read of the diff: it must be of the last commit (written
// after it isn't enough: a round runs while fixes may land), or of one
// before it with only comment lines changed since; and before the last
// round it must leave no change finding open (after it the user decides). The
// reviewer's header line says all three: "… @ <sha>, round <n>, <k> open
// change findings", where a recheck says "recheck of round <n>", keeping
// the number. A dictated change that holds (dictatedHolds) has no review,
// and passes with no findings.
export const review = (cwd, work, input = {}) => {
  const path = stateFile(cwd, "review", work.key);
  if (!existsSync(path)) {
    const dictated = dictatedHolds(cwd, work, input, null);
    if (dictated?.holds) return { path, ok: true, ids: [] };
    return { path, ok: false, reason: dictated ? `missing: its survey is dictated, but ${dictated.why}, so it takes the full flow` : "missing" };
  }
  const text = readFileSync(path, "utf8");
  // the first `round <n>` after the sha, and the first open count after
  // that, whatever words come between (a "(with a recheck of …)")
  const header = text.match(/^# Change review:.* @ ([0-9a-f]{7,40}),.*?\bround (\d+)\b.*?\b(\d+) open change finding/m);
  if (!header)
    return {
      path,
      ok: false,
      reason:
        "its header has no commit, round and open count: its first line reads `# Change review: <branch> @ <short sha>, round <n>, <k> open change findings` (or `recheck of round <n>`), with anything more after the round",
    };
  const [sha, ...counts] = header.slice(1);
  if (!headSha(cwd).startsWith(sha) && !commentOnly(cwd, sha))
    return { path, ok: false, reason: `it reviewed ${sha}, and the commits since change more than comment lines` };
  const [round, open] = counts.map(Number);
  if (open && round < LAST_ROUND)
    return {
      path,
      ok: false,
      reason: `round ${round} left ${open} change finding(s) open: fix them and run round ${round + 1}, but take a reopened finding, or one the reviewer holds against your pushback, to the user`,
    };
  // the review (each replaces the last) lists every finding of the change
  const ids = [...new Set([...text.matchAll(/^(?:- )?(F\d+)\b/gm)].map((id) => id[1]))];
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

// where HEAD meets origin's default branch, as a full sha; null with no
// origin
export const originBase = (cwd) => {
  for (const ref of ["origin/HEAD", "origin/main", "origin/master"]) {
    try {
      return git(cwd, "merge-base", "HEAD", ref);
    } catch {}
  }
  return null;
};

// what the branch is measured against: where it left the default branch
const base = (cwd) => {
  const found = originBase(cwd);
  if (found) return found;
  for (const ref of ["main", "master"]) {
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

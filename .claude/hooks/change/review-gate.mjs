// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's change review (the `change` skill):
// it is turned down until the review exists, is of the last commit (or
// of one before it with only comment lines changed since) and, before the
// last round, leaves no change finding open, and until the PR body, read
// from its file, answers every finding of that review in its Change
// section. A PR leaves draft (`gh pr ready`, or `gh pr create` without
// `--draft`) once the branch's lessons file (the `lessons` skill) says
// where every lesson went, and the review is still of the last commit.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { deny, hook, lines, onBranch, review, stateFile, workOf } from "./lib.mjs";

// where a command starts (not inside a message that mentions it), after
// any VAR=value prefixes, with any gh flags before `pr`
// (a VAR=value prefix's value may be quoted: in the masked text its quotes
// hold blanks; a wrapper such as env, command or time runs gh all the same)
const PR_STEP = /(?:^|[;&|(\n])\s*(?:(?:\w+=(?:"[^"]*"|'[^']*'|[^\s"'])*|env|command|time|nohup|exec)\s+)*gh\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*pr\s+(create|ready)\b/g;

// the command with heredoc bodies and quoted text blanked out, keeping
// every other character where it was
const masked = (command) =>
  command
    .replace(/(<<-?\s*(['"]?)(\w+)\2[^\n]*\n)([\s\S]*?\n)(\t*\3)(?=\n|$)/g, (_, open, _q, _tag, body, close) =>
      open + body.replace(/[^\n]/g, " ") + close,
    )
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (quoted) => quoted[0] + " ".repeat(quoted.length - 2) + quoted[0]);

// the folder gh runs in: the last `cd` before it, if any, found in the
// masked command with `$( … )` blanked too (so a `cd` in a heredoc, a
// quote or a command substitution doesn't count) and read from the original
const dirOf = (command, hidden, at, cwd) => {
  let outside = hidden.slice(0, at);
  for (let inner = ""; inner !== outside; ) {
    inner = outside;
    outside = outside.replace(/\$\([^()]*\)/g, (sub) => " ".repeat(sub.length));
  }
  const cds = [...outside.matchAll(/(?:^|[;&|(\n])\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|)]+)/dg)];
  if (cds.length === 0) return cwd;
  const [start, end] = cds.at(-1).indices[1];
  const dir = command.slice(start, end).replace(/^["']|["']$/g, "").replace(/^~(?=\/|$)/, homedir());
  return resolve(cwd, dir);
};

// this gh command's own arguments, up to the next command: in the masked
// text (`masked`), so a quoted title or body is blanks
const argsOf = (hidden, end) => {
  // an & in a redirect (2>&1, >&2, &>f, <&0) is no command boundary
  const stop = hidden.slice(end).search(/[;|\n]|(?<![<>])&(?!>)/);
  return hidden.slice(end, stop < 0 ? undefined : end + stop);
};

// the branch `--head` names, if any, in this gh command's own arguments:
// found in the masked text (so a title or body that mentions --head doesn't
// count) and read from the original
const headOf = (command, hidden, end) => {
  const args = argsOf(hidden, end);
  const flag = /(?:^|\s)(?:--head|-H)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/d.exec(args);
  if (!flag) return undefined;
  const [start, finish] = flag.indices[1];
  return command.slice(end + start, end + finish).replace(/^["']|["']$/g, "").replace(/^[^:]*:/, "");
};

// a turn-down stops the whole command, so it says so: a push or an edit of
// the body chained before the gh command didn't run either
const turnDown = (reason, verb) =>
  deny(`${reason} Nothing in this command ran, steps before gh pr ${verb} included: run each one as its own command.`);

// why the branch's PR can't leave draft yet, if it can't: its lessons file
// is missing, lists nothing, or has a lesson that doesn't say where it went
const lessonsMissing = (cwd, work) => {
  const file = stateFile(cwd, "lessons", work.key);
  const how = `run the \`lessons\` skill (the \`change\` skill's step 6) and write them to ${file}, each lesson saying where it went (\`→ <where>\`), or \`None: <why>\``;
  if (!existsSync(file)) return `${work.branch}'s PR can't leave draft before its lessons: ${how}.`;
  const text = readFileSync(file, "utf8");
  if (/^None:\s*\S/m.test(text)) return;
  const items = lines(text).filter((line) => /^\s*-\s/.test(line));
  const unsaid = items.filter((line) => !/→\s*\S/.test(line));
  if (items.length === 0 || unsaid.length)
    return `The lessons file for ${work.branch} (${file}) ${items.length ? `has ${unsaid.length} lesson(s) that don't say where they went` : "lists none"}: ${how}.`;
};

// gh pr create: the review, the body's Change section, and its lessons
// unless it opens as a draft
const createGate = (command, hidden, match, input) => {
  const cwd = dirOf(command, hidden, match.index, input.cwd);
  const work = workOf(cwd, input);
  if (!work) return;
  const end = match.index + match[0].length;
  const turnDownCreate = (reason) => turnDown(reason, "create");

  // a branch's review lives with its own checkout
  const head = headOf(command, hidden, end);
  if (head && head !== work.branch)
    return turnDownCreate(
      `gh pr create --head ${head} runs from ${work.branch}'s checkout (${cwd}), but a branch's change review lives with its own checkout. Run it from ${head}'s checkout: git switch ${head} first, as its own command, or in its worktree.`,
    );

  const found = review(cwd, work.key);
  if (!found.ok)
    return turnDownCreate(
      `The change review for ${work.branch} isn't ready (${found.reason}). Run the change-reviewer agent as the \`change\` skill's Review step says, with output ${found.path}. Answer each finding in the PR's Change section, then open the PR. (This checked ${work.branch}, checked out in ${cwd} when the command started.)`,
    );

  // the body comes from its file beside the review, and its Change section
  // answers every finding: fixed in a commit on the branch, or answered
  const body = stateFile(cwd, "pr-body", work.key);
  if (!command.includes(body) || !existsSync(body))
    return turnDownCreate(
      `Write the PR body for ${work.branch} to ${body} and open the PR with \`--body-file ${body}\`, as the \`change\` skill's Change section step says.`,
    );
  const text = readFileSync(body, "utf8");
  const at = text.search(/^## Change\b/m);
  if (at < 0) return turnDownCreate(`The PR body (${body}) has no \`## Change\` section: end it with one, as the \`change\` skill says.`);
  const section = lines(text.slice(at));
  const answers = (id) =>
    section.some((line) => {
      if (!new RegExp(`\\b${id}\\b`).test(line)) return false;
      const fixed = line.match(/fixed in ([0-9a-f]{7,40})\b/)?.[1];
      return (fixed && onBranch(cwd, fixed)) || /answered:\s*\S/.test(line);
    });
  const open = found.ids.filter((id) => !answers(id));
  if (open.length)
    return turnDownCreate(
      `The PR body's Change section (${body}) doesn't answer ${open.join(", ")} from the last change review (${found.path}). Give each its own Review line: \`fixed in <sha>\`, a commit on this branch, or \`answered: <why>\`.`,
    );

  if (/(?:^|\s)(?:--draft|-d)(?=\s|=|$)/.test(argsOf(hidden, end))) return;
  const missing = lessonsMissing(cwd, work);
  if (missing) return turnDownCreate(`${missing} Or open it as a draft (\`--draft\`) and mark it ready once they're written.`);
};

// gh pr ready, run bare from the PR's own checkout: its review still of the
// last commit, and its lessons. --undo puts a PR back in draft, which waits
// for nothing
const readyGate = (command, hidden, match, input) => {
  const end = match.index + match[0].length;
  const args = argsOf(hidden, end);
  if (/(?:^|\s)--undo(?=\s|$)/.test(args)) return;
  const cwd = dirOf(command, hidden, match.index, input.cwd);
  const work = workOf(cwd, input);
  if (!work) return;

  // The gate reads the lessons and review of the branch checked out where
  // it runs, which is the PR a bare `gh pr ready` readies. A PR named any
  // other way (a number, URL or branch; -R or --repo, before `pr` or after
  // `ready`; GH_REPO or GH_HOST anywhere in the command) could be another
  // branch's, so it's turned down. Redirects are no argument
  const named = args
    .replace(/(?:\d*|&)[<>]+&?\s*\S*/g, " ")
    .trim();
  const ghFlags = /gh\s+-/.test(hidden.slice(match.index, end));
  if (named || ghFlags || /\bGH_(?:REPO|HOST)\b/.test(command))
    return turnDown(
      `Run \`gh pr ready\` bare, as its own command, from the PR's own checkout (for ${work.branch}'s, in ${cwd}): the gate checks the lessons and review of the branch checked out where it runs, so it can't vouch for a PR named another way (a number, -R, --repo, GH_REPO).`,
      "ready",
    );

  // the review still holds: of the last commit, so the lessons commit got
  // its recheck
  const found = review(cwd, work.key);
  if (!found.ok)
    return turnDown(
      `The change review for ${work.branch} isn't ready (${found.reason}), with output ${found.path}: finish it as the \`change\` skill's Review step says (after a lessons commit, that's the recheck of it), then mark the PR ready.`,
      "ready",
    );

  const missing = lessonsMissing(cwd, work);
  if (missing) return turnDown(missing, "ready");
};

hook((input) => {
  const command = input.tool_input?.command ?? "";
  const hidden = masked(command);
  for (const step of hidden.matchAll(PR_STEP)) {
    const gate = step[1] === "create" ? createGate : readyGate;
    const turned = gate(command, hidden, step, input);
    if (turned) return turned;
  }
});

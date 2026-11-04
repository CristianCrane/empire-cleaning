// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's shape review (the `shape` skill):
// it is turned down until the review exists, is of the last commit (or
// of one before it with only comment lines changed since) and, before the
// last round, leaves no shape finding open, and until the PR body, read
// from its file, answers every finding of that review in its Shape
// section.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { deny, hook, lines, onBranch, review, stateFile, workOf } from "./lib.mjs";

// where a command starts (not inside a message that mentions it), after
// any VAR=value prefixes, with any gh flags before `pr`
const PR_CREATE = /(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*gh\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*pr\s+create\b/;

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

// the branch `--head` names, if any, in this gh command's own arguments:
// found in the masked text (so a title or body that mentions --head doesn't
// count) and read from the original
const headOf = (command, hidden, end) => {
  const stop = hidden.slice(end).search(/[;&|\n]/);
  const args = hidden.slice(end, stop < 0 ? undefined : end + stop);
  const flag = /(?:^|\s)(?:--head|-H)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/d.exec(args);
  if (!flag) return undefined;
  const [start, finish] = flag.indices[1];
  return command.slice(end + start, end + finish).replace(/^["']|["']$/g, "").replace(/^[^:]*:/, "");
};

hook((input) => {
  const command = input.tool_input?.command ?? "";
  const hidden = masked(command);
  const match = PR_CREATE.exec(hidden);
  if (!match) return;
  const cwd = dirOf(command, hidden, match.index, input.cwd);
  const work = workOf(cwd, input);
  if (!work) return;

  // a branch's review lives with its own checkout
  const head = headOf(command, hidden, match.index + match[0].length);
  if (head && head !== work.branch)
    return deny(
      `gh pr create --head ${head} runs from ${work.branch}'s checkout (${cwd}), but a branch's shape review lives with its own checkout. Run it from ${head}'s checkout: git switch ${head} first, as its own command, or in its worktree.`,
    );

  const found = review(cwd, work.key);
  if (!found.ok)
    return deny(
      `The shape review for ${work.branch} isn't ready (${found.reason}). Run the shape-reviewer agent as the \`shape\` skill's Review step says, with output ${found.path}. Answer each finding in the PR's Shape section, then open the PR. (Hooks run before the whole command, so this checked ${work.branch}, checked out in ${cwd} now.)`,
    );

  // the body comes from its file beside the review, and its Shape section
  // answers every finding: fixed in a commit on the branch, or answered
  const body = stateFile(cwd, "pr-body", work.key);
  if (!command.includes(body) || !existsSync(body))
    return deny(
      `Write the PR body for ${work.branch} to ${body} and open the PR with \`--body-file ${body}\`, as the \`shape\` skill's Shape section step says.`,
    );
  const text = readFileSync(body, "utf8");
  const at = text.search(/^## Shape\b/m);
  if (at < 0) return deny(`The PR body (${body}) has no \`## Shape\` section: end it with one, as the \`shape\` skill says.`);
  const shape = lines(text.slice(at));
  const answers = (id) =>
    shape.some((line) => {
      if (!new RegExp(`\\b${id}\\b`).test(line)) return false;
      const fixed = line.match(/fixed in ([0-9a-f]{7,40})\b/)?.[1];
      return (fixed && onBranch(cwd, fixed)) || /answered:\s*\S/.test(line);
    });
  const open = found.ids.filter((id) => !answers(id));
  if (open.length)
    return deny(
      `The PR body's Shape section (${body}) doesn't answer ${open.join(", ")} from the last shape review (${found.path}). Give each its own Review line: \`fixed in <sha>\`, a commit on this branch, or \`answered: <why>\`.`,
    );
});

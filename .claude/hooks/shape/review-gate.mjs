// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's shape review (the `shape` skill):
// it is turned down until the review exists and is newer than the last
// commit.
import { homedir } from "node:os";
import { resolve } from "node:path";
import { deny, hook, review, workOf } from "./lib.mjs";

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
  const outside = hidden.slice(0, at).replace(/\$\([^()]*\)/g, (sub) => "$(" + " ".repeat(sub.length - 3) + ")");
  const cds = [...outside.matchAll(/(?:^|[;&|(\n])\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|)]+)/dg)];
  if (cds.length === 0) return cwd;
  const [start, end] = cds.at(-1).indices[1];
  const dir = command.slice(start, end).replace(/^["']|["']$/g, "").replace(/^~(?=\/|$)/, homedir());
  return resolve(cwd, dir);
};

// the branch `--head` names, if any, in this gh command's own arguments
const headOf = (command, hidden, end) => {
  const stop = hidden.slice(end).search(/[;&|\n]/);
  const args = command.slice(end, stop < 0 ? undefined : end + stop);
  const head = args.match(/(?:^|\s)(?:--head|-H)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/)?.[1];
  return head?.replace(/^["']|["']$/g, "").replace(/^[^:]*:/, "");
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
  if (found.ok) return;
  return deny(
    `The shape review for ${work.branch} isn't ready (${found.reason}). Run the shape-reviewer agent as the \`shape\` skill's Review step says, with output ${found.path}. Answer each finding in the PR's Shape section, then open the PR. (Hooks run before the whole command, so this checked ${work.branch}, checked out in ${cwd} now.)`,
  );
});

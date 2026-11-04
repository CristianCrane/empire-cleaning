// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's shape review (the `shape` skill):
// it is turned down until the review exists and is newer than the last
// commit.
import { homedir } from "node:os";
import { resolve } from "node:path";
import { deny, hook, review, workOf } from "./lib.mjs";

// where a command starts: not inside a message that mentions it
const PR_CREATE = /(?:^|[;&|(\n])\s*gh\s+pr\s+create\b/;

// the command with heredoc bodies and quoted text blanked out, keeping
// every other character where it was
const masked = (command) =>
  command
    .replace(/(<<-?\s*(['"]?)(\w+)\2[^\n]*\n)([\s\S]*?\n)(\t*\3)(?=\n|$)/g, (_, open, _q, _tag, body, close) =>
      open + body.replace(/[^\n]/g, " ") + close,
    )
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (quoted) => quoted[0] + " ".repeat(quoted.length - 2) + quoted[0]);

// the folder gh runs in: the last `cd` before it, if any, found in the
// masked command (so a `cd` in a heredoc or a quote doesn't count) and read
// from the original
const dirOf = (command, hidden, at, cwd) => {
  const cds = [...hidden.slice(0, at).matchAll(/(?:^|[;&|(\n])\s*cd\s+("[^"]+"|'[^']+'|\S+)/dg)];
  if (cds.length === 0) return cwd;
  const [start, end] = cds.at(-1).indices[1];
  const dir = command.slice(start, end).replace(/^["']|["']$/g, "").replace(/^~(?=\/|$)/, homedir());
  return resolve(cwd, dir);
};

hook((input) => {
  const command = input.tool_input?.command ?? "";
  const hidden = masked(command);
  const at = hidden.search(PR_CREATE);
  if (at < 0) return;
  const cwd = dirOf(command, hidden, at, input.cwd);
  const work = workOf(cwd, input);
  if (!work) return;

  const found = review(cwd, work.key);
  if (found.ok) return;
  return deny(
    `The shape review for ${work.branch} isn't ready (${found.reason}). Run the shape-reviewer agent as the \`shape\` skill's Review step says, with output ${found.path}. Answer each finding in the PR's Shape section, then open the PR.`,
  );
});

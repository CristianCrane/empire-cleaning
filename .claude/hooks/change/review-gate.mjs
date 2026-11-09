// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's change review (the `change` skill):
// it is turned down until the review exists, is of the last commit (or
// of one before it with only comment lines changed since) and, before the
// last round, leaves no change finding open, and until the PR body, read
// from its file, is in the skill's shape (its parts, Check these's
// permalinks, Change collapsed, nothing else) and answers every finding of
// that review in its Change section. A PR leaves draft (`gh pr ready`, or `gh pr create` without
// `--draft`) once the branch's lessons file (the `lessons` skill) says
// where every lesson went, and the review is still of the last commit.
import { existsSync, readFileSync } from "node:fs";
import { deny, dirOf, hook, lines, masked, onBranch, review, stateFile, workOf } from "./lib.mjs";

// where a command starts (not inside a message that mentions it), after
// any VAR=value prefixes, with any gh flags before `pr`
// (a VAR=value prefix's value may be quoted: in the masked text its quotes
// hold blanks; a wrapper such as env, command or time runs gh all the same)
const PR_STEP = /(?:^|[;&|(\n])\s*(?:(?:\w+=(?:"[^"]*"|'[^']*'|[^\s"'])*|env|command|time|nohup|exec)\s+)*gh\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*pr\s+(create|ready)\b/g;

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

// the PR body's labelled parts (the `change` skill's PR body step), in its
// order: whether each must be there, whether its sentence is on its line, and
// how many permalinks it holds. `## Change` follows, collapsed
const PARTS = [
  { label: "Problem", required: true, sentence: true },
  { label: "Fix", required: true, sentence: true },
  { label: "Check these", required: true, links: [3, 5] },
  { label: "Before / after" },
  { label: "Tests" },
];

// the Change section, collapsed in a closed <details>: the blank line after
// </summary> lets GitHub draw its heading
const COLLAPSED = /^<details>\s*<summary>Change<\/summary>[ \t]*\n[ \t]*\n(## Change[ \t]*\n[\s\S]*?)^<\/details>/m;

// a permalink: a file's lines at a commit's full sha
const PERMALINK = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/blob\/([0-9a-f]{40})\//g;

// what keeps the body from the skill's shape, outside fenced code: a part
// missing or short of what it holds, a label (any line led by bold) or
// heading it doesn't have, a permalink at no commit on the branch, or
// Change not collapsed. The Change section, when it's there, comes back to
// be checked against the review
const shapeOf = (text, cwd) => {
  const prose = text.replace(/^```[\s\S]*?^```/gm, "");
  const problems = [];
  // each label's block: its line's rest, then the lines up to the next
  // label or the collapsed Change
  const blocks = new Map();
  let block = null;
  for (const line of prose.split("\n")) {
    const label = /^\*\*(.+?):?\*\*:?(.*)$/.exec(line);
    if (label) blocks.set(label[1], (block = { rest: label[2].trim(), text: "" }));
    else if (/^<details>/.test(line)) block = null;
    else if (block) block.text += `${line}\n`;
  }
  for (const { label, required, sentence, links } of PARTS) {
    const part = blocks.get(label);
    if (!part) {
      if (required) problems.push(`no \`**${label}:**\``);
      continue;
    }
    if (sentence && !part.rest) problems.push(`\`**${label}:**\` has no sentence on its line`);
    const count = links && [...part.text.matchAll(PERMALINK)].length;
    if (links && (count < links[0] || count > links[1]))
      problems.push(
        `\`**${label}:**\` has ${count} permalink(s) (\`https://github.com/<owner>/<repo>/blob/<full sha>/<path>#L<a>-L<b>\`), not ${links.join(" to ")}`,
      );
  }
  const stray = [
    ...[...blocks.keys()].filter((label) => !PARTS.some((part) => part.label === label)).map((label) => `**${label}**`),
    ...lines(prose).filter((line) => /^#{1,6}\s/.test(line) && !/^## Change\s*$/.test(line)),
  ];
  if (stray.length) problems.push(`parts it doesn't have: ${stray.map((part) => `\`${part}\``).join(", ")}`);
  const elsewhere = [...new Set([...prose.matchAll(PERMALINK)].map((link) => link[1]))].filter((sha) => !onBranch(cwd, sha));
  if (elsewhere.length)
    problems.push(`permalinks at ${elsewhere.map((sha) => sha.slice(0, 7)).join(", ")}, no commit on this branch: link at HEAD's full sha`);
  const collapsed = COLLAPSED.exec(prose);
  if (!collapsed)
    problems.push(
      "no `## Change` collapsed as `<details><summary>Change</summary>`, a blank line, `## Change` and its lines, then `</details>`",
    );
  return { problems, section: collapsed ? lines(collapsed[1]) : null };
};

// gh pr create: the review, the body's shape and its Change section, and
// its lessons unless it opens as a draft
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

  // the body comes from its file beside the review, is in the skill's
  // shape, and its Change section answers every finding
  const body = stateFile(cwd, "pr-body", work.key);
  if (!command.includes(body) || !existsSync(body))
    return turnDownCreate(
      `Write the PR body for ${work.branch} to ${body} and open the PR with \`--body-file ${body}\`, as the \`change\` skill's PR body step says.`,
    );
  const { problems, section } = shapeOf(readFileSync(body, "utf8"), cwd);
  if (problems.length)
    return turnDownCreate(
      `The PR body (${body}) isn't in the shape the \`change\` skill's PR body step gives: ${problems.join("; ")}.`,
    );
  // why no line answers a finding, or null when one does, in the words of
  // the reviewer's template: `fixed in <sha>` (a commit on this branch),
  // `fixed in the survey` (its text, never committed) or `answered: <why>`
  const unanswered = (id) => {
    const named = section.filter((line) => new RegExp(`\\b${id}\\b`).test(line));
    if (!named.length) return "no line names it";
    const whys = named.map((line) => {
      if (/fixed in the survey\b|answered:\s*\S/.test(line)) return null;
      const sha = line.match(/fixed in ([0-9a-f]{7,40})\b/)?.[1];
      if (sha) return onBranch(cwd, sha) ? null : `\`fixed in ${sha}\` is no commit on this branch: after a rebase or an amend, give the new sha; a fix that landed elsewhere (main, another PR) is \`answered: <where>\``;
      if (/\bfixed\b/.test(line))
        return "it says fixed, but in no commit on this branch: a fix to the survey's text is `fixed in the survey`, one anywhere else (an issue, a comment) is `answered: <where>`";
      if (/\banswered\b/.test(line)) return "`answered` takes a colon: `answered: <why>`";
      return "its line says neither `fixed in` nor `answered:`";
    });
    return whys.includes(null) ? null : whys[0];
  };
  const open = found.ids.flatMap((id) => {
    const why = unanswered(id);
    return why ? [`${id}: ${why}`] : [];
  });
  if (open.length)
    return turnDownCreate(
      `The PR body's Change section (${body}) doesn't answer every finding of the last change review (${found.path}): ${open.join("; ")}. Each finding gets its own Review line ending \`fixed in <sha>\` (a commit on this branch), \`fixed in the survey\` (a fix to the survey's text, which isn't committed) or \`answered: <why>\`.`,
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

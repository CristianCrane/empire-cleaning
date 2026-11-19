// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// `gh pr create` waits for the branch's change review (the `change` skill):
// it is turned down until the review exists (a dictated change that holds
// has none: lib's dictatedHolds), is of the last commit (or
// of one before it with only comment lines changed since) and, before the
// last round, leaves no change finding open, and until the PR body, read
// from its file, is in the skill's shape (its parts, Check these's
// permalinks, Change collapsed, nothing else) and answers every finding of
// that review in its Change section. A PR leaves draft (`gh pr ready`, or `gh pr create` without
// `--draft`) once the branch's lessons file (the `lessons` skill) says
// where every cost went, and the review is still of the last commit.
// A prototype branch's PR (lib's prototypeBranch) is turned down either
// way: it skipped the reviews because it never merges.
//
// Only the user merges a PR of the dotfiles (DOTFILES; their CLAUDE.md):
// `gh pr merge` on one goes through only naming the PR by its number
// alone, from a checkout of it, and only when a message the user typed in
// this session asks to merge that number. The one exception is a process
// batch (lib's processBatch; the dotfiles' docs/process.md, Landing),
// whose approval is the user's verdicts in its log: run bare from its own
// checkout, it merges once its review leaves no change finding open, its
// first commit only adds log entries, and every later commit names one of
// them (`L<n>`) with a yes or edit verdict (batchUnapproved). Another
// repo's merges go through. What it can't hold: a message that negates the ask ("don't
// merge #12"), and a merge by any other route (`gh api`, the web).
//
// It reads Bash and Monitor commands alike (settings.json registers it on
// `Bash|Monitor`): a Monitor runs its command in a shell too, so a
// `gh pr merge`, create or ready there is gated as in Bash.
import { existsSync, readFileSync } from "node:fs";
import {
  argsOf,
  base,
  branchOf,
  deny,
  dirOf,
  git,
  githubOrigin,
  has,
  hook,
  lines,
  masked,
  onBranch,
  positional,
  processBatch,
  prArgs,
  prototypeBranch,
  prStep,
  review,
  stateFile,
  unquote,
  userMessages,
  WORD,
  workOf,
} from "./lib.mjs";

// the repo whose PRs only the user merges
const DOTFILES = "CristianCrane/.dotfiles";

const PR_STEP = prStep("create", "ready", "merge");

// the branch `--head` names, if any, in this gh command's own arguments:
// found in the masked text (so a title or body that mentions --head doesn't
// count) and read from the original
const headOf = (command, hidden, end) => {
  const args = argsOf(hidden, end);
  const flag = /(?:^|\s)(?:--head|-H)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/d.exec(args);
  if (!flag) return undefined;
  const [start, finish] = flag.indices[1];
  return unquote(command.slice(end + start, end + finish)).replace(/^[^:]*:/, "");
};

// a turn-down stops the whole command, so it says so: a push or an edit of
// the body chained before the gh command didn't run either
const turnDown = (reason, verb) =>
  deny(`${reason} Nothing in this command ran, steps before gh pr ${verb} included: run each one as its own command.`);

// a prototype branch's PR, turned down whatever else it has
const prototypeTurnDown = (branch, verb) =>
  turnDown(
    `${branch} is a prototype branch: it skipped the survey and the reviews because it never merges, so it never becomes a PR. Build the pick on its own branch (not prototype-…) with the full flow, as the \`change\` skill's Prototype rule says.`,
    verb,
  );

// why the branch's PR can't leave draft yet, if it can't: its lessons file
// is missing, lists nothing, or has a cost that doesn't say where it went.
// The costs are the bullets before the first line starting `None:` (or
// `Ruled out`, the older skill's spelling, which repos' copies write until
// their sync); its reason follows, in any form
const lessonsMissing = (cwd, work) => {
  const file = stateFile(cwd, "lessons", work.key);
  const how = `run the \`lessons\` skill (the \`change\` skill's step 6): its \`capture.mjs --source lessons\` writes each cost to ${file} with where it went (\`→ inbox <id>\`), or write \`None: <why>\` there when the work cost nothing`;
  if (!existsSync(file)) return `${work.branch}'s PR can't leave draft before its lessons: ${how}.`;
  const all = lines(readFileSync(file, "utf8"));
  const split = all.findIndex((line) => /^(?:ruled out|none:)/i.test(line.trim()));
  const items = (split < 0 ? all : all.slice(0, split)).filter((line) => /^\s*-\s/.test(line));
  const ruledOut = split >= 0 && /\w/.test(all.slice(split).join(" ").replace(/^\s*(?:ruled out|none)\W*/i, ""));
  const unsaid = items.filter((line) => !/→\s*\S/.test(line));
  if ((items.length === 0 && !ruledOut) || unsaid.length)
    return `The lessons file for ${work.branch} (${file}) ${items.length ? `has ${unsaid.length} cost(s) that don't say where they went` : "lists none"}: ${how}.`;
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

// gh pr create: the PR's branch (not a prototype, and the one checked
// out), then the review, the body's shape and its Change section, and its
// lessons unless it opens as a draft. The branch is settled before a
// checkout with no work to gate (a detached HEAD, a prototype) stands
// aside, so neither opens another branch's PR unchecked
const createGate = (command, hidden, match, input) => {
  const cwd = dirOf(command, hidden, match.index, input.cwd);
  const branch = branchOf(cwd);
  const end = match.index + match[0].length;
  const turnDownCreate = (reason) => turnDown(reason, "create");

  const head = headOf(command, hidden, end);
  if (prototypeBranch(head ?? branch)) return prototypeTurnDown(head ?? branch, "create");
  // a branch's review lives with its own checkout
  if (head && head !== branch)
    return turnDownCreate(
      `gh pr create --head ${head} runs from ${branch}'s checkout (${cwd}), but a branch's change review lives with its own checkout. Run it from ${head}'s checkout: git switch ${head} first, as its own command, or in its worktree.`,
    );
  const work = workOf(cwd, input);
  if (!work) return;

  const found = review(cwd, work, input);
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
// a `gh pr <step>` and where it runs: its own arguments, whether it names
// the repo elsewhere, its checkout, and whether it's bare. A bare one acts
// on the PR of the branch checked out where it runs, so a gate can read
// that branch's files; a PR named any other way (a number, URL or branch;
// -R or --repo, before `pr` or after the step; GH_REPO or GH_HOST anywhere
// in the command: lib's prArgs) could be another branch's. Redirects are
// no argument
const stepOf = (command, hidden, match, input) => {
  const { args, elsewhere } = prArgs(command, hidden, match);
  const cwd = dirOf(command, hidden, match.index, input.cwd);
  return { args, elsewhere, cwd, bare: !args.trim() && !elsewhere };
};

const readyGate = (command, hidden, match, input) => {
  const { args, cwd, bare } = stepOf(command, hidden, match, input);
  if (/(?:^|\s)--undo(?=\s|$)/.test(args)) return;
  const branch = branchOf(cwd);

  // The gate reads the lessons and review of the branch checked out where
  // it runs (stepOf's bare), so a PR named another way is turned down
  if (!bare)
    return turnDown(
      `Run \`gh pr ready\` bare, as its own command, from the PR's own checkout (for ${branch}'s, in ${cwd}): the gate checks the lessons and review of the branch checked out where it runs, so it can't vouch for a PR named another way (a number, -R, --repo, GH_REPO).`,
      "ready",
    );
  if (prototypeBranch(branch)) return prototypeTurnDown(branch, "ready");
  const work = workOf(cwd, input);
  if (!work) return;

  // the review still holds: of the last commit, so a commit since it got
  // its recheck
  const found = review(cwd, work, input);
  if (!found.ok)
    return turnDown(
      `The change review for ${work.branch} isn't ready (${found.reason}), with output ${found.path}: finish it as the \`change\` skill's Review step says (after a commit since the review, that's its recheck), then mark the PR ready.`,
      "ready",
    );

  const missing = lessonsMissing(cwd, work);
  if (missing) return turnDown(missing, "ready");
};

// gh pr merge's flags that take a value, so the value is no PR
const MERGE_VALUES = new Set(["-b", "--body", "-F", "--body-file", "-t", "--subject", "--match-head-commit", "-A", "--author-email"]);

// gh pr merge on a dotfiles PR: one it can tell may be the dotfiles' (run
// in a checkout of them, or a command naming them anywhere) is named one
// way, by its number from a checkout of them, and merges only when the
// user asked for that number in a message of their own
const mergeGate = (command, hidden, match, input) => {
  const { args, elsewhere, cwd } = stepOf(command, hidden, match, input);
  const origin = githubOrigin(cwd);
  const here = origin && `${origin.owner}/${origin.name}`.toLowerCase() === DOTFILES.toLowerCase();
  if (!here && !command.toLowerCase().includes(DOTFILES.toLowerCase())) return;
  // GH_REPO, GH_HOST or gh flags before `pr`: lib's prArgs; -R or --repo
  // after `merge`, which prArgs leaves to the hook (pr-conflict hands them
  // on to its own gh), are turned down here. A value-taking flag's value
  // (MERGE_VALUES) is no PR, which lib's positional can't tell
  const words = args.match(WORD) ?? [];
  const named = positional(words.filter((_, at) => !MERGE_VALUES.has(words[at - 1])));
  // a process batch, run bare from its own checkout: its log is the
  // approval (batchUnapproved)
  if (here && !elsewhere && !has(words, "-R", "--repo=") && named.length === 0 && processBatch(branchOf(cwd))) {
    const why = batchUnapproved(cwd, input);
    if (!why) return;
    return turnDown(
      `A process batch merges by the agent only when the user's verdicts in its log approve every change (the dotfiles' docs/process.md, Landing), and ${branchOf(cwd)}'s can't: ${why}. Fix that, or leave the PR for the user to merge.`,
      "merge",
    );
  }
  if (!here || elsewhere || has(words, "-R", "--repo=") || named.length !== 1 || !/^\d+$/.test(named[0]))
    return turnDown(
      `Run \`gh pr merge <number>\` from a checkout of ${DOTFILES}, the PR named by its number alone (no branch, URL, -R, --repo or GH_REPO): only the user merges its PRs, and the gate checks that they asked to merge that number.`,
      "merge",
    );
  const number = named[0];
  const asked = new RegExp(String.raw`(?<![\w/.-])#?${number}(?!\.?\w)`);
  let messages = [];
  try {
    messages = userMessages(input.transcript_path);
  } catch {}
  if (!messages.some((text) => /\bmerge\b/i.test(text) && asked.test(text)))
    return turnDown(
      `Only the user merges a ${DOTFILES} PR: no message the user typed in this session asks to merge #${number} (a relay or your own words don't count). Leave it for them to merge on GitHub, or merge it once they ask for #${number} by its number.`,
      "merge",
    );
};

// the log a process batch adds its verdicts to
const PROCESS_LOG = "docs/process-log.md";

// why a process batch's PR can't merge without the user, if it can't: its
// review isn't clean, or its commits aren't the verdicts its log adds (the
// first commit adds them and nothing else; every later one names one, and
// only ones the user said yes to or edited). The log commit alone merges:
// a repo's batch has its entries here and its changes there, and a branch
// reads approvals only from its own first commit, so it approves nothing
// later
const batchUnapproved = (cwd, input) => {
  const work = workOf(cwd, input);
  const found = review(cwd, work, input);
  if (!found.ok) return `its review isn't ready (${found.reason})`;
  if (found.open !== 0) return found.open ? `its review leaves ${found.open} change finding(s) open` : "it has no review of its own";
  const commits = lines(git(cwd, "rev-list", "--reverse", "--no-merges", `${base(cwd)}..HEAD`));
  if (!commits.length) return "it has no commits";
  const [first, ...changes] = commits;
  // numstat: added, deleted, path. Only adds: an edited or removed line
  // would rewrite a verdict the user gave
  const logged = lines(git(cwd, "diff-tree", "--no-commit-id", "--numstat", "-r", first)).map((line) => line.split("\t"));
  if (logged.length !== 1 || logged[0][2] !== PROCESS_LOG || logged[0][1] !== "0") return `its first commit (${first.slice(0, 7)}) must add the run's entries to ${PROCESS_LOG} and nothing else`;
  const added = git(cwd, "show", "--format=", first, "--", PROCESS_LOG);
  const approved = new Set([...added.matchAll(/^\+- (L\d+) (?:yes|edit)\b/gm)].map((entry) => entry[1]));
  for (const sha of changes) {
    const named = [...git(cwd, "log", "-1", "--format=%B", sha).matchAll(/\bL\d+\b/g)].map((id) => id[0]);
    const wrong = named.filter((id) => !approved.has(id));
    if (!named.length || wrong.length)
      return `commit ${sha.slice(0, 7)} names ${named.length ? `${wrong.join(", ")}, which the log doesn't add with a yes or edit` : "no log entry (L<n>)"}`;
  }
};

const GATES = { create: createGate, ready: readyGate, merge: mergeGate };

hook((input) => {
  const command = input.tool_input?.command ?? "";
  const hidden = masked(command);
  for (const step of hidden.matchAll(PR_STEP)) {
    const gate = GATES[step[1]];
    const turned = gate(command, hidden, step, input);
    if (turned) return turned;
  }
});

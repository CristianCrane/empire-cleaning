---
name: shape
description: Survey the patterns a code change touches before its first edit, get a fresh shape review before its PR, and write the PR's Shape section. Use when starting any change in a git repo, or when a hook asks for a survey or a review.
---

<!-- The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs. -->

# Shape

Each change leaves the codebase with less entropy, never more. Left alone, an agent judges this after its approach is already chosen, grades its own work, and extends whatever pattern is there because extending is the easy path. So the survey comes before the plan and holds facts, a fresh reviewer argues against the change, and extending is the choice that needs a reason.

A **pattern** is any shape the change follows or adds: a helper, a table, a layer, a test harness, a hook, a doc convention, a copy of code across packages.

## Rules

- **Ratchet.** A change may leave the code no simpler, but it never adds a third copy of a pattern, never bends a pattern that fights the change, and never edits one idea in many places (shotgun surgery: fold the idea into one place first).
- **The simplest shape is the plan.** When the survey finds a simpler shape than extending, build that. Extending instead takes a written reason, which goes in Shape.
- **One kind of work per PR**: a refactor, a behaviour change, or cleanups.
- **Refactor first.** A refactor that changes no behaviour, under ~10 files and inside one package: make it on its own branch and PR, then build the change on top of it. A bigger refactor, or one that crosses packages: stop and ask the user whether it goes first in its own PR or on its own issue.
- **A stacked PR lands on the default branch.** Open it with `--base <its survey's Base:>`, so it shows only its own diff. Before stacking, check GitHub deletes merged branches (`gh repo view --json deleteBranchOnMerge`); with that on, GitHub retargets a stacked PR when its base merges, and if it's off, ask the user to turn it on. Either way, once the lower PR merges, check the stacked one targets the default branch (`gh pr view <n> --json baseRefName`, against `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`), retarget it if not (`gh pr edit <n> --base <default branch>`), and drop the survey's `Base:` line. Merging the stacked one into its old base strands its commits off the default branch, so retarget it rather than handing the user a merge order.
- **Every change** gets a survey, a plan review and a review. A small change writes a one-line survey.
- The repo's own rules (CLAUDE.md, ADRs) add to these.

## 1. Survey

Before the first edit: the survey gate turns edits down until it exists, and its turn-down names the path. (The survey lives in the git dir, one per branch, or on `main` one per session.)

```
Change: <one line>
Patterns touched:
  - <name>: <n> copies — <path>, <path>, … — fits | fights the change
Simplest shape: <what> (~<n> files)
Plan: refactor first | extend — <the reason, when extend>
Expected files: <n>
Base: <the branch this one is stacked on; leave the line out when it's the default branch>
```

Count copies by searching the repo for each pattern, not from memory. Done when every pattern the change touches is listed with every copy's path, and the simplest shape has a file count.

## 2. Plan review

Run the `shape-reviewer` agent in **plan** mode, with the survey's path and the plan review's path (`plan-review-…` beside the survey; the gate names it). It reads the survey before any code exists, when a wrong shape costs a paragraph rather than rework. Revise the survey for each block; answer each note in Shape. One plan review per change; edits go through once it's written.

Post the survey in chat, then go on, unless the plan is a refactor big enough to ask about.

## 3. Build

Keep the survey true: when the plan or the file count changes, update it. A hook compares the branch's size with `Expected files` every 25 files.

## 4. Review

After the last commit, before opening the PR (`gh pr create` is turned down until the review is newer than the last commit and, before round 3, has no open blocks), run the `shape-reviewer` agent: **round 1**, with the branch, the repo root, whether it's a refactor, the survey's path and the review's path (`review-…` beside the survey).

- **Blocks** start the next round: fix them, commit, and run the reviewer again, **round 2** then **round 3**. A follow-up round checks only the fixes, against the previous review in the same file.
- **Notes** never start a round. Answer each in Shape, from every round (later rounds carry them forward): rebutted, or filed as a follow-up issue. Fixing one here costs another round.
- **Done** when a round finds no blocks and is newer than the last commit.
- **After round 3**, any block still open goes to the user: stop and put each one to them with its paths. A round 4 runs only when they say so.

## 5. Shape section

Every PR body ends with:

```
## Shape
- Extended | Retired | New: <pattern> — <paths>
- Simpler shape considered: <a real shape>; <why not, or "done in #N">
- Review: <finding> → fixed | rebutted: <why>
- Harder to change: <what, or nothing>
```

One line per pattern and per review finding. A refactor PR's Shape names what it retired and says how behaviour was shown unchanged.

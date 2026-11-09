---
name: change
description: Survey the patterns a code change touches before its first edit, get a fresh change review before its PR, write the PR's Change section, and close with its lessons. Use when starting any change in a git repo, or when a hook asks for a survey, a review or lessons.
---

<!-- The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs. -->

# Change

Each change leaves the codebase with less entropy, never more. Left alone, an agent judges this after its approach is already chosen, grades its own work, and extends whatever pattern is there because extending is the easy path. So the survey comes before the plan and holds facts, a fresh reviewer argues against the change, and extending is the choice that needs a reason.

A **pattern** is any shape the change follows or adds: a helper, a table, a layer, a test harness, a hook, a doc convention, a copy of code across packages.

## Rules

- **Ratchet.** A change may leave the code no simpler, but it never adds a third copy of a pattern, never bends a pattern that fights the change, and never edits one idea in many places (shotgun surgery: fold the idea into one place first).
- **The simplest shape is the plan.** When the survey finds a simpler shape than extending, build that. Extending instead takes a written reason, which goes in Change.
- **One kind of work per commit**: a refactor, a change, or a cleanup. A PR carries them in that order: refactor commits, then the change, then cleanups. That order holds up to round 1; fixes and later scope go on top, never before a refactor commit.
- **Refactor first.** A refactor that changes no behaviour goes in the PR's first commits, and the change is built on top of it.
- **Fix what you see.** A problem outside the change, seen while building or by the reviewer, goes on the survey's `Seen nearby:` list and is fixed in a cleanup commit after the change's. Nothing is filed for later.
- **Big work.** A refactor or cleanup over ~10 files, or one that crosses packages: stop and ask the user one thing, whether it rides in this PR or gets its own. It's done either way. A refactor's own PR merges first, and the change's branch then starts from the default branch; a cleanup's own PR follows the change's.
- **Every change** gets a survey, a plan review and a review. A small change writes a one-line survey; one for a bug carries its Cause.
- The repo's own rules (CLAUDE.md, ADRs) add to these.

## 1. Survey

Before the first edit: the survey gate turns edits down until it exists, and its turn-down names the path. (The survey lives in the git dir, one per branch, or on `main` one per session.)

```
Change: <one line>
Cause: <what's wrong>, shown by <evidence> | <what's wrong>, to show: <how> | none: no bug
Patterns touched:
  - <name>: <n> copies — <path>, <path>, … — fits | fights the change
Simplest shape: <what> (~<n> files)
Plan: refactor first | extend — <the reason, when extend>
Commits:
  - refactor | change | cleanup: <what>
Expected files: <n>
Seen nearby:
  - <problem> — <path>
```

A bug (wrong behaviour, a failing or flaky test, a run that's too slow) has a cause, and the cause is a claim until evidence shows it: a reproduction, a trace, numbers before and after, a test red on the old code, each taken as the code runs (the same handler, PATH, shell, data). Evidence that takes an edit (a red test, a trace needing instrumentation) is `to show:`, and the branch shows it before round 1. Count copies by searching the repo for each pattern, by its shape and by its values and words (a key's value, a sentence's phrase), not from memory: a copy can go by another name. Done when a bug's Cause is shown or says how it will be, every pattern the change touches is listed with every copy's path, and the simplest shape has a file count. `Seen nearby:` grows while you build; each item becomes a cleanup commit.

## 2. Plan review

Run the `change-reviewer` agent in **plan** mode, with the survey's path and the plan review's path (`plan-review-…` beside the survey; the gate names it). It reads the survey before any code exists, when a wrong shape or an unshown cause costs a paragraph rather than rework. Revise the survey for each finding, or give round 1 your reason against it (round 1 carries the plan review's findings forward). One plan review per change; edits go through once it's written.

Post the survey in chat, then go on, unless it has Big work to ask about.

## 3. Build

Keep the survey true: when the plan or the file count changes, update it, and when a `to show:` cause is shown, say `shown by` what. A hook compares the branch's size with `Expected files` every 25 files.

## 4. Review

Once the change is committed, before opening the PR (`gh pr create` is turned down until the review is of the last commit, or of one before it with only comment lines changed since, and, before the last round, has no open change findings), run the `change-reviewer` agent: **round 1**, with the branch, the repo root, which commits are refactors (the survey's `Commits:`), the survey's and plan review's paths, and the review's path (`review-…` beside the survey).

A round is the reviewer and you arguing about shape, and about a bug's evidence. The reviewer reads the diff and the survey and runs no tests, so tests never hold it up: start each round as its commit lands, and run the repo's quick tests beside it (its CLAUDE.md or AGENTS.md names them, and its full suite).

- **Every finding is a fix**, made now and never filed for later. Each has an id (`F<n>`) and a severity:
  - **`[change]`**: a shape decision, or a bug's unshown cause (the reviewer's impact list). Fix it, with any failure the round's quick tests found, commit, and run the reviewer again: **round 2**, **round 3**, and on. A follow-up round checks only the fixes, against the previous review in the same file. Only these fixes count rounds.
  - **`[text]`**: a comment or doc that's false, stale or missing. A fix that changes only comment lines in code needs no review: the PR gate lets it through. A fix to Markdown gets a recheck.
- **A recheck** reviews a commit that fixes no change finding: a text fix in Markdown, a cleanup from `Seen nearby:`, a fix to a failing test, typecheck, lint or CI. It checks only that commit, keeps the round's number and costs no round; a change finding it raises starts the next round. Rechecks have no cap.
- **Push back** when a finding is wrong: give your reason in the prompt of the reviewer's next pass (a recheck of the same commit, when nothing else changed). It concedes or holds, with evidence. A change finding it still holds goes to the user with both sides; their ruling goes in the next pass's prompt, and closes the finding.
- **The full suite** runs once, after a round or recheck leaves no change finding open, before the PR. A fix it needs gets a recheck, and only what failed runs again, with the quick tests.
- **Done** when the last review leaves no change finding open, every text finding is fixed, and the full suite has passed.
- **Going nowhere** goes to the user in any round. When a round reopens a finding an earlier round marked fixed, the fixes are going back and forth: stop and put it to them with both sides. New, narrower findings each round are progress; keep going.
- **After round 5**, any change finding still open goes to the user: stop and put each one to them with its paths. A round 6 runs only when they say so.

## 5. Change section

Write the PR body to `pr-body-…` beside the review (the gate names it) and open the PR with `gh pr create --body-file <that path>`: the gate reads the body there and turns the PR down until its Change section answers every finding of the last review, by id. Every PR body ends with:

```
## Change
- Extended | Retired | New: <pattern> — <paths>
- Simpler shape considered: <a real shape>; <why not, or "done in <sha>">
- Review: F<n> <finding> → fixed in <sha> | answered: <why, and the reviewer's or user's word on it>
- Seen nearby: <problem> → fixed in <sha>
- Harder to change: <what, or nothing>
```

One line per pattern, per review finding and per `Seen nearby:` item. When the PR has refactor commits, Change names what they retired and says how behaviour was shown unchanged.

## 6. Lessons

Once the full suite has passed, run the `lessons` skill: before the PR leaves draft (`gh pr ready`, or `gh pr create` without `--draft`), or before the push to main where there's no PR. Its lessons for the repo land as one cleanup commit, which gets its recheck. The gate holds a PR in draft until its lessons file says where every lesson went and the review is of the last commit.

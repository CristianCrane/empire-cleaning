## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Human tasks go on two lists

Don't open an issue for work only a person can do. Add it to one of two standing issues instead, as a checklist item that links the issue it unblocks: eleven human-task issues (#43 to #196) were folded into these two on 2026-11-02 (d152bee3), so a person's work is in two places, not scattered.

- **#206 "Jen's to-do list"**: anything Jennifer, the owner, must check, answer or do: drafted copy, claims about how the business works, business questions, facts and photos, the Google Business Profile. Write it short and plain, with no glossary terms.
- **#205 "Manual setup"**: every other human task: accounts, secrets, DNS, dashboards, the domain switch, go-live steps. Every service account is made under the business Gmail, empirecleaningproservices@gmail.com, so there's one inbox to keep (2026-11-17).

An agent ticket that waits on one of them stays open, blocked by #205 or #206 (see **Blocking** in `docs/agents/issue-tracker.md`).

### Triage labels

The labels and what each means: `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`. When an ADR retires a pattern, it names the pattern; follow the newest ADR, as an older one can stand partly superseded (ADR-0018 over ADR-0014's commercial rules).

The files `docs/map.md` lists are the doc curator's alone, so each fact sits in one place, short (.dotfiles#61): a change leaves a note instead, as the `change` skill's Build says.

## UX

Before designing, prototyping, reviewing or changing any screen, or writing words a person reads (a server message, an email), load the `ui` skill, then read `docs/ux.md`: this product's UX rules, and how a new UX question is settled (prototype, pick, build, record). Before reworking a screen, search `docs/ux-log.md`, the decisions so far, for it and for the states and words it shows, and read the rows that match, not the 211KB log whole (on 2026-11-25 builders brought in 36KB of it a run), so a choice isn't undone by accident: a decision can sit under another screen's name (where a failed charge is retried is Payment Method's, though Home's alert follows it). Record a new decision as `docs/ux.md`'s Changing a screen says.

A PR that changes a screen shows it before and after: `pnpm pr:shots <spec> "<test title>"` makes the screenshots and prints the table for the PR body (`packages/web/README.md`, Testing).

A rule both the server and a screen run lives in `@empire-cleaning/models`, as the Suggested Price does: the one copy, not a second (the rule: the `ui` skill, "Rules the server keeps").

## Tests

Before writing a test, changing how tests start, stop or wait, chasing one that fails or runs slow, or claiming what a build leaves out, load the `testing` skill, then read `docs/testing.md`: this repo's test rules, helpers and budgets. Before chasing a failure or timing a change, search `docs/testing-log.md`, the findings so far, for the test, its file and the symptom, and read the rows that match: the same failure has turned up twice already.

For the `change` skill, which says when each runs: the quick tests are `pnpm test:change`, naming the specs for the screens a change touches (`packages/web/README.md`), and the Checks (the CI table in `README.md`); the full suite is CI, on the PR (ADR-0026). A newer push cancels the run still going, and a cancelled run isn't a failure but hides one: read `gh run list` conclusions (cancelled vs failure; 2026-10-27, when cancelled runs read as failed builds).

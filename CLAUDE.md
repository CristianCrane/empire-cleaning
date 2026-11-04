## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Human tasks go on two lists

Don't open an issue for work only a person can do. Add it to one of two standing issues instead, as a checklist item that links the issue it unblocks:

- **#206 "Jen's to-do list"**: anything Jennifer, the owner, must check, answer or do: drafted copy, claims about how the business works, business questions, facts and photos, the Google Business Profile. Write it short and plain, with no glossary terms.
- **#205 "Manual setup"**: every other human task: accounts, secrets, DNS, dashboards, the domain switch, go-live steps.

An agent ticket that waits on one of them stays open, blocked by #205 or #206 (see **Blocking** in `docs/agents/issue-tracker.md`).

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`. When an ADR retires a pattern, it names the pattern; follow the newest ADR.

## UX

Before changing any screen, read `docs/ux.md`: the UX rules every screen keeps, how a new UX question is settled (prototype, pick, build, record), and the log of past decisions. Record each new decision there, and add a Storybook pattern (`packages/ui/src/Patterns.stories.tsx`) when a rule carries over to other screens.

## Tests

For the `change` skill, which says when each runs: the quick tests are `pnpm test`, the Checks (the CI table in `README.md`), and the specs for the screens a change touches (`packages/web/README.md`); the full suite is `pnpm test:full` and the Checks.

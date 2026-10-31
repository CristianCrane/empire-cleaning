## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## UX

Before changing any screen, read `docs/ux.md`: the UX rules every screen keeps, how a new UX question is settled (prototype, pick, build, record), and the log of past decisions. Record each new decision there, and add a Storybook pattern (`packages/ui/src/Patterns.stories.tsx`) when a rule carries over to other screens.

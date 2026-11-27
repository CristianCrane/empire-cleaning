# Docs map

Its format: `~/.claude/hooks/docs.mjs`'s header; its writer: `~/.claude/agents/doc-curator.md`.

- `docs/ux.md` (rule): every screen's rules; read before any screen change.
- `docs/ux-words.md` (rule): every word a person reads; read before any screen change, server message or email.
- `docs/testing.md` (rule): every test's rules; read before writing a test, changing how tests start, stop or wait, or chasing one that fails or runs slow.
- `docs/screens.md` (screen): the areas' paths and the screens outside an area; read with any screen change.
- `docs/screens-office.md` (screen): each Office screen and the picks it keeps; read before changing one.
- `docs/screens-portal.md` (screen): each Client portal screen and the picks it keeps; read before changing one.
- `docs/screens-cleaner.md` (screen): each Cleaner area screen and the picks it keeps; read before changing one.
- `packages/server/README.md` (how-to): setting up, testing and monitoring the server; read before working in it.
- `docs/*.md`
- `docs/adr/*.md` (decision): each call that rules something out, with why; read the ones a change touches before making it. Work that contradicts one says so and why, rather than overriding it silently.
- `docs/agents/*.md` (rule): how the issue tracker and its labels are worked here, for the plugin's skills and anyone filing or triaging an issue.
- `GLOSSARY.md` (term): each domain term's meaning here and how it differs from its neighbours, with the words screens use for it; read before naming a concept in code, a test, copy or an issue. A concept it doesn't have is either invented language (reconsider it) or a real gap (a note to the doc curator).
- `README.md`
- `packages/*/README.md`

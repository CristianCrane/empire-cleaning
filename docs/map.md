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
- `docs/adr/*.md` (decision): each call that rules something out, with why; read the ones a change touches before making it.
- `docs/agents/*.md`
- `GLOSSARY.md`
- `README.md`
- `packages/*/README.md`

# Docs map

The docs every agent reads here. Only the doc curator writes them (`~/.claude/agents/doc-curator.md`): any other agent leaves a note, as the `change` skill's Build says, so each fact sits in one place and stays short. CI's Docs check turns red on a commit that changes one without the curator's trailer.

An entry gets its kind, `(rule)`, `(decision)`, `(screen)`, `(term)` or `(how-to)`, once its files hold that kind alone, which switches on its word budgets (#567).

- `docs/*.md`
- `docs/adr/*.md`
- `docs/agents/*.md`
- `GLOSSARY.md`
- `README.md`
- `packages/*/README.md`

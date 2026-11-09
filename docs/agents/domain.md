# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `GLOSSARY-MAP.md` at the root):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids. A test's title, a variable and a comment are output too: when a screen word changes, search them as well as the strings people read, and leave the term in them. A title that says the screen word, old or new, reads as the wrong concept once the word moves, as "an extra" did for an Adjustment (PR #381, review F4, F9 and F10).

What a person reads is the exception: labels, page text, messages and emails use everyday words (ADR-0027). An entry whose term people don't say carries an `_On screen_:` line after `_Avoid_`: the word screens and emails use for it, or "none" where screens name something else instead (Assignment). It's one word for every reader, the Office, Cleaners, Clients and Guests alike, and no two entries share one (ADR-0029): an Add-on is an "extra" to everyone, an Adjustment a "price change". It may give a case only for what the term covers (Payment Method: "card or bank" where a bank account can pay). Job is the one exception, kept on purpose: "clean" to a Client, as to the Office a job isn't always a clean (painting is a job too); don't fold it into one word, or copy it for another entry. Office Staff's "us to a Client" isn't a second name: it's how we speak to a Client (`docs/ux.md`, Words). It may be one its `_Avoid_` list keeps out of code and docs: a Completed Job is "done" on screen. Before writing copy or another line (a `_Spanish_` word, a catalog) from an entry, search the strings each of its readers sees for its word: screens can drift from the glossary, and one reader can see another word than the next (#300 found six entries, such as Balance, "the rest" to a Client). Where they differ, settle the entry's line first: record what screens say when every reader sees the same word, or else fix the screens to one word. The rules for writing them are in `docs/ux.md`, Words.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Spanish words

Guests, Clients and Cleaners see the product in English or Spanish (ADR-0025). Each `GLOSSARY.md` entry for a term they see carries a `_Spanish_:` line after `_Avoid_` and any `_On screen_` line, in that line's shape: the Spanish word every screen and email uses for each of its screen words, one per case where it gives one per case, the case said in English as there (Job: "trabajo; limpieza to a Client"), "none" where it says none (Revision), and one word for the term where the entry has no `_On screen_` line (Quote). It never translates a term that screens don't show. Entries only the Office sees, such as Minimum Charge or the Price List, have none: the Office reads their `_On screen_` word (minimum price, prices), in English.

- Write Spanish copy with these words, as English copy uses each term's `_On screen_` word, or the term where it has none.
- The lines came in with #300 as an agent drafted them, and the owner checks the word list on #206 before launch; her changes go in here. From then on, a new term they see gets its `_Spanish_:` line when it's added, and the owner checks the word on #206.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

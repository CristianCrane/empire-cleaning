# Lint rules

The repo's own lint rules, as oxlint JS plugins (`.oxlintrc.json`'s `jsPlugins`, run by `pnpm lint`). JS plugins are in alpha in oxlint and not bound by semver, so each rule is tested through oxlint's own `RuleTester` (`pnpm --filter @empire-cleaning/lint test`, in CI's Checks job), and an oxlint update that changes the plugin API fails there.

## `empire/report-unexpected`

Every error a screen catches but didn't expect goes to Sentry (#351). A `catch` clause, a `.catch(handler)` and the second handler of a `.then(ok, handler)` each rethrow, or call the package's reporter (the rule's `reporters` option, set per package in `.oxlintrc.json`):

- the web app: `reportUnexpected` (`packages/web/src/monitoring.ts`), which skips the API's answers and a card that couldn't be used
- the Quote form and the landing site: the browser's `reportError`, which skips nothing itself; the host's Sentry picks it up once it has started (ADR-0007)
- the design system: none, so a catch there rethrows or says why it expects its throw
- everywhere: Sentry drops a dropped connection

A handler passed by name (`.catch(reportUnexpected)`) passes when it's the reporter. A call anywhere in the handler counts, but not one in a function the handler makes, which may never run. A catch that only ever expects its throw says why, as blocked storage does in `packages/ui/src/stored.ts`:

```ts
// oxlint-disable-next-line empire/report-unexpected -- blocked storage, expected
```

The rule is on in `packages/{web,quote-request,landing,ui}/src`, but not in tests or stories. The server reports through its own Sentry.

## `empire/words-from-catalog`

Words that differ by language come from a catalog, never a branch on the language (ADR-0025, #388). A branch (`lang === "es" ? "Hola" : "Hi"`) skips the typecheck that fails the build on a missing Spanish string, and its plurals skip `formats[lang].plural`. Write the words in `catalog()` (`packages/models/src/language.ts`) and look them up by the language: `words[lang].greeting(name)`.

A JS plugin gets no types, so the rule knows a language by what it's compared with: one of models' `LANGUAGES` codes. It flags a ternary, `&&`, `||`, `if` or `switch` on such a comparison when a branch holds words:

- the comparison either way round, with `===`, `!==`, `==` or `!=`, under any name (`lang`, `client.preferredLanguage`, `currentLanguage()`), inside a bigger test (`formal && lang === "es"`, `!(…)`), or kept in a `const` (`const es = lang === "es"`)
- words are a string, template or JSX text anywhere under a branch, with a letter, that isn't a language code; what a branch compares with, an object's key, a member's name and a type aren't words

It allows a branch that picks no words (`inLanguage`), and one that picks the other language: `lang === "en" ? "es" : "en"` (the landing header).

What it can't see:

- a language compared with anything but a code: `lang === other`, `lang.startsWith("es")`, a boolean kept by `let` or passed in (`isSpanish`)
- words a branch reaches through a call: `lang === "es" ? spanish() : english()`
- an `.astro` file's template: oxlint reads only its frontmatter, so `{lang === "es" ? "Hola" : "Hi"}` in markup passes

As it looks deep, it also flags a string under a branch that isn't words, such as an Intl option or a locale tag (`lang === "en" ? "en_US" : "es_US"`): that goes in a table by language too, as `locales` does. The rule is on everywhere, tests included: a test's expected words in each language go in a table by language, not a branch.

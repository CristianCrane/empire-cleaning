# Lint rules

The repo's own lint rules, `empire/…`: one oxlint JS plugin (`src/index.ts`, a rule a file, registered there; `.oxlintrc.json`'s `jsPlugins`, which also sets where each is on). `pnpm lint` runs them, with `src/astro-markup.ts` (an `.astro` file's markup, which oxlint can't read) and `src/catalog-copies.ts` (across files).

```sh
pnpm --filter @empire-cleaning/lint test
```

The rules are tested through oxlint's `RuleTester`, as JS plugins are alpha and an oxlint update can break them; the other two with plain vitest.

## `empire/report-unexpected`

A `catch`, `.catch(handler)` or `.then(ok, handler)` rethrows or calls its package's reporter (`reporters` in `.oxlintrc.json`): the web app's `reportUnexpected` (`packages/web/src/monitoring.ts`), the browser's `reportError` in the Quote form and landing site, none in the design system. A handler passed by name counts when it's the reporter; a call inside a function the handler makes doesn't. A catch that only ever expects its throw says why, as `packages/ui/src/stored.ts` does:

```ts
// oxlint-disable-next-line empire/report-unexpected -- blocked storage, expected
```

On in `packages/{web,quote-request,landing,ui}/src`, not tests or stories.

## `empire/words-from-catalog`

Words that differ by language come from a catalog (ADR-0025): write them in `catalog()` (`packages/models/src/language.ts`) and look them up, `words[lang].greeting(name)`, never a branch on the language. A branch picking no words, or picking the other language (`lang === "en" ? "es" : "en"`), passes. A non-word string under a branch (a locale tag, an Intl option) goes in a table by language too, as `locales` does, and so do a test's expected words in each language. It runs on `.astro` markup too, where an `oxlint-disable` comment doesn't reach.

It can't see a language compared with anything but a code, a boolean kept by `let` or passed in, or words reached through a call: the rule holds there unchecked.

## `empire/screen-layout`

A screen renders through its type's layout (ADR-0031, `docs/ux.md`, Screen types), never placing the kit's `Breadcrumbs`, `ActionFooter` or `PageHeader`, the page's title (`Heading level={1}` or `<h1>`) or a facts grid (a `<dl>` with `grid`, but two columns of amounts, `grid-cols-[1fr_auto]`), dialogs included: there's to be one facts grid, the kit's. A new layout goes in `packages/ui/src/layouts/`, where it doesn't run.

On in `packages/web/src/screens`, not tests, stories, the test site's People screen (it has no type) or a prototype (`*.prototype.tsx`, which draws a layout's parts by hand to try them).

It can't see a level not written as `1`, class names made by a call, or a part reached through a kit component that isn't a layout.

## `catalog-copies`

The same English in two of the screens' catalogs (`packages/web/src`, not a prototype's, and `packages/models/src/messages`) is a second Spanish to keep in step: give it one home (`docs/ux-words.md`, Language). It prints each copy with every file and key.

A copy whose Spanish differs in each place (it agrees with a different noun, or speaks to a Client as usted and a Cleaner as tú) goes on its `allowed` list with every file and why; a third file still fails, and an entry no longer a copy fails until it's taken out.

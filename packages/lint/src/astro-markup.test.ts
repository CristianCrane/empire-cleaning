import { describe, expect, it } from "vitest";
import { markupBranches } from "./astro-markup.ts";

// an .astro file: Header.astro's frontmatter, and `markup` as its template
const astro = (markup: string, frontmatter = "") => `---
import { languageOf } from "@empire-cleaning/models";
const lang = languageOf(Astro.currentLocale);
const other = lang === "en" ? "es" : "en";
const t = words[lang];
${frontmatter}
---

${markup}
`;

// the line the template starts on, in `astro`
const first = 9;

describe("words-from-catalog over .astro markup", () => {
  it.each([
    ["a ternary between strings", '<p>{lang === "es" ? "Hola" : "Hello"}</p>'],
    [
      "a ternary between elements",
      '<p>{lang === "es" ? <b>Hola</b> : <b>Hello</b>}</p>',
    ],
    [
      "an element shown in one language",
      '<p>{lang === "es" && <b>Hola</b>}</p>',
    ],
    ["an attribute", '<a title={lang !== "en" ? "Entrar" : "Sign in"}>x</a>'],
    [
      "a branch inside a map",
      '<ul>{items.map((i) => <li>{lang === "es" ? i.es : "Item"}</li>)}</ul>',
    ],
  ])("flags %s, where it starts", (_, markup) => {
    const column = markup.indexOf("lang") + 1;
    expect(markupBranches(astro(markup))).toEqual([{ line: first, column }]);
  });

  it("follows a const the frontmatter sets to a comparison", () => {
    const source = astro(
      '<p>{es ? "Hola" : "Hello"}</p>',
      'const es = lang === "es";',
    );
    expect(markupBranches(source)).toEqual([{ line: first, column: 5 }]);
  });

  it("finds a branch after words with accents, on its own line", () => {
    const source = astro(
      '<p>Limpieza en Ñandú, sí</p>\n<p>{lang === "es" ? "Hola" : "Hi"}</p>',
    );
    expect(markupBranches(source)).toEqual([{ line: first + 1, column: 5 }]);
  });

  it.each([
    // Header.astro's switch: both branches language codes
    [
      '<a hreflang={lang === "en" ? "es" : "en"} lang={other}>{t.otherLanguage}</a>',
    ],
    // words from the catalog
    ["<p>{t.signIn}</p>"],
    // a branch on something else
    ['<p>{open ? "Open" : "Closed"}</p>'],
    // a `let` may change, so it isn't followed
    ['<p>{es ? "Hola" : "Hi"}</p>', 'let es = lang === "es";'],
    // the frontmatter and a <script> are oxlint's, so not reported twice
    ["<p>{greeting}</p>", 'const greeting = lang === "es" ? "Hola" : "Hi";'],
    ['<script>const hi = lang === "es" ? "Hola" : "Hi";</script>'],
  ])("allows %s", (markup, frontmatter = "") => {
    expect(markupBranches(astro(markup, frontmatter))).toEqual([]);
  });
});

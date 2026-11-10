import { RuleTester } from "oxlint/plugins-dev";
import rule from "./words-from-catalog.ts";

const branch = [{ messageId: "branch" }];
const tsx = { filename: "screen.tsx" };

new RuleTester().run("words-from-catalog", rule, {
  valid: [
    // words from a catalog, looked up by the language
    "const t = words[lang]; say(t.greeting(name))",
    // picking the other language: both branches language codes (Header.astro)
    'const other = lang === "en" ? "es" : "en"',
    // a branch on the language that picks no words (inLanguage)
    'const shown = lang === "en" ? item : { ...item, name: item.nameEs || item.name }',
    'if (lang !== "en") item = translated(item)',
    // what a branch compares with isn't words
    'const plural = lang === "es" && kind === "home"',
    // a branch on something else
    'const label = done ? "Done" : "Not yet"',
    'if (kind === "home") show("Your home")',
    // a `let` may change, so it isn't followed
    'let es = lang === "es"; es = false; const hi = es ? "Hola" : "Hi"',
    // a language's default is no branch
    'const l = email.lang ?? "en"',
    // object keys and types under a branch aren't words
    {
      code: 'const p = lang === "es" ? { [k]: v } : { ...p, kind: x as "home" }',
      filename: "words.ts",
    },
  ],
  invalid: [
    // the shapes that slipped in (#387): the email greeting, keepUnder and
    // tooManyTries, each a ternary on the language between two templates
    {
      code: 'const greeting = (lang, name) => lang === "es" ? `Hola, ${name}:` : `Hi ${name},`',
      errors: branch,
    },
    {
      code: 'function tooMany() { const lang = currentLanguage(); return lang === "es" ? `Demasiados intentos. ${wait}` : `Too many tries. ${wait}` }',
      errors: branch,
    },
    // the comparison either way round, negated, loose, under any name
    { code: 'const hi = "es" === lang ? "Hola" : "Hi"', errors: branch },
    { code: 'const hi = lang !== "en" ? "Hola" : "Hi"', errors: branch },
    { code: 'const hi = lang == "es" ? "Hola" : "Hi"', errors: branch },
    {
      code: 'const hi = client.preferredLanguage === "es" ? "Hola" : "Hi"',
      errors: branch,
    },
    {
      code: 'const hi = currentLanguage() === "es" ? "Hola" : "Hi"',
      errors: branch,
    },
    // within a bigger test
    {
      code: 'const hi = formal && lang === "es" ? "Hola" : "Hi"',
      errors: branch,
    },
    { code: 'const hi = !(lang === "en") ? "Hola" : "Hi"', errors: branch },
    // a const kept for it
    {
      code: 'const es = lang === "es"; const hi = es ? "Hola" : "Hi"',
      errors: branch,
    },
    // only one branch with words
    { code: 'const hi = lang === "es" ? "Hola" : english', errors: branch },
    // words deep in a branch: a call's argument, a function's result
    {
      code: 'const n = lang === "es" ? fmt(`${n} limpiezas`) : fmt(`${n} cleans`)',
      errors: branch,
    },
    {
      code: 'const unit = lang === "es" ? (n) => (n === 1 ? "hora" : "horas") : unitEn',
      errors: branch,
    },
    // a locale tag is a table's job, by language (`locales`)
    { code: 'const tag = lang === "en" ? "en_US" : "es_US"', errors: branch },
    // a deep search also catches a string that isn't words, such as an
    // Intl option: pick it by language from a table too
    {
      code: 'const f = lang === "es" ? { month: "long" } : opts',
      errors: branch,
    },
    // an if, with an else or falling through
    {
      code: 'function hi(lang) { if (lang === "es") return "Hola"; return "Hi" }',
      errors: branch,
    },
    {
      code: 'let hi; if (lang === "es") { hi = "Hola" } else { hi = "Hi" }',
      errors: branch,
    },
    // a switch on the language, or on a test of it
    {
      code: 'function hi(lang) { switch (lang) { case "es": return "Hola"; default: return "Hi" } }',
      errors: branch,
    },
    {
      code: 'function hi() { switch (true) { case lang === "es": return "Hola"; default: return "Hi" } }',
      errors: branch,
    },
    // words shown in one language only
    {
      code: 'const note = lang === "en" && "Se habla español"',
      errors: branch,
    },
    {
      code: 'const note = lang === "en" && <p>Se habla español</p>',
      ...tsx,
      errors: branch,
    },
    // JSX either side
    {
      code: 'const hi = lang === "es" ? <b>Hola</b> : <b>Hi</b>',
      ...tsx,
      errors: branch,
    },
  ],
});

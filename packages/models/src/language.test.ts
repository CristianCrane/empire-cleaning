import { expect, test } from "vitest";
import { catalog, languageOf } from "./language.ts";

test("a tag asks for Spanish when it's any Spanish, else English", () => {
  expect(languageOf("es")).toBe("es");
  expect(languageOf("es-MX")).toBe("es");
  expect(languageOf(" ES-us")).toBe("es");
  expect(languageOf("en-US")).toBe("en");
  expect(languageOf("fr")).toBe("en");
  expect(languageOf(null)).toBe("en");
  expect(languageOf(undefined)).toBe("en");
});

test("a catalog's Spanish must have every English string, of its kind", () => {
  const words = catalog({
    en: { hello: "Hello", count: (n: number) => `${n} cleans` },
    es: { hello: "Hola", count: (n: number) => `${n} limpiezas` },
  });
  expect(words.es.count(2)).toBe("2 limpiezas");

  catalog({
    en: { hello: "Hello", bye: "Bye" },
    // @ts-expect-error: no Spanish for "bye"
    es: { hello: "Hola" },
  });
  catalog({
    en: { count: (n: number) => `${n}` },
    // @ts-expect-error: a function of another kind
    es: { count: (n: string) => n },
  });
});

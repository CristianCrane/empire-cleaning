import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogCopies, catalogPaths, catalogWords } from "./catalog-copies.ts";

// a screen's file whose catalog's English is `en`
const screen = (path: string, en: string) => ({
  path,
  source: `import { catalog } from "@empire-cleaning/models";
const words = catalog({
  en: { ${en} },
  es: {},
});
`,
});

describe("catalog-copies", () => {
  it("names both files and keys of a copied string", () => {
    expect(
      catalogCopies(
        [
          screen("a/Bill.tsx", 'total: "Total", due: "Due"'),
          screen("a/Job.tsx", 'sum: "Total"'),
        ],
        [],
      ),
    ).toEqual([
      {
        words: "Total",
        places: [
          { path: "a/Bill.tsx", key: "total" },
          { path: "a/Job.tsx", key: "sum" },
        ],
      },
    ]);
  });

  it("passes when each string is in one catalog", () => {
    expect(
      catalogCopies(
        [
          screen("a/Bill.tsx", 'total: "Total"'),
          screen("a/Job.tsx", 'total: "Price"'),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("counts two catalogs in one file as two, but the same words twice in one as one", () => {
    const twice = {
      path: "a/Two.ts",
      source: `const one = catalog({ en: { a: "Paid", b: "Paid" }, es: {} });
const two = catalog({ en: { c: "Done" }, es: {} });
const three = catalog({ en: { d: "Done" }, es: {} });`,
    };
    expect(catalogCopies([twice], []).map((c) => c.words)).toEqual(["Done"]);
  });

  it("reads a template's words, the strings in its placeholders, and through functions, satisfies and as", () => {
    expect(
      catalogWords(
        "a/Plan.ts",
        `const words = catalog({
  en: {
    payBill: (n: string) => \`Pay bill \${n}\`,
    each: (price: string | null) => \`\${price ? "Each clean, priced" : "Each clean"} is charged.\`,
    status: { active: "Active" } satisfies Record<string, string>,
    errors: { GONE: "Gone" } as Record<string, string>,
  },
  es: {},
});`,
      ).map(({ words, key }) => [words, key]),
    ).toEqual([
      ["Pay bill ${…}", "payBill"],
      ["${…} is charged.", "each"],
      ["Each clean, priced", "each"],
      ["Each clean", "each"],
      ["Active", "status.active"],
      ["Gone", "errors.GONE"],
    ]);
  });

  it("skips what has no letter, a type, and the Spanish", () => {
    expect(
      catalogWords(
        "a/Range.ts",
        `const words = catalog({
  en: { range: (from: "a" | "b", to: string) => \`\${from} – \${to}\`, dot: " · " },
  es: { range: (from: string, to: string) => "Hola" },
});`,
      ),
    ).toEqual([]);
  });

  it("lets an allowed copy through, only in the files it names", () => {
    const allow = [
      { words: "Paid", in: ["a/Bill.tsx", "a/Job.tsx"], why: "test" },
    ];
    const bill = screen("a/Bill.tsx", 'paid: "Paid"');
    const job = screen("a/Job.tsx", 'paid: "Paid"');
    expect(catalogCopies([bill, job], allow)).toEqual([]);
    expect(
      catalogCopies([bill, job, screen("a/Plan.tsx", 'paid: "Paid"')], allow),
    ).toHaveLength(1);
  });

  // a new catalog that isn't added to git yet counts, else its copies go
  // unseen and an allowed copy it holds is called stale (#405)
  it("reads catalogs git doesn't track yet, but not ignored files", () => {
    const top = mkdtempSync(join(tmpdir(), "catalog-copies-"));
    try {
      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: top, stdio: "ignore" });
      git("init", "--quiet");
      mkdirSync(join(top, "packages/web/src"), { recursive: true });
      writeFileSync(join(top, ".gitignore"), "ignored.ts\n");
      for (const name of ["added.ts", "new.ts", "ignored.ts"])
        writeFileSync(join(top, "packages/web/src", name), "");
      git("add", ".gitignore", "packages/web/src/added.ts");
      expect(catalogPaths(top).sort()).toEqual([
        "packages/web/src/added.ts",
        "packages/web/src/new.ts",
      ]);
    } finally {
      rmSync(top, { recursive: true, force: true });
    }
  });
});

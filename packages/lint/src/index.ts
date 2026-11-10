// The repo's own lint rules, one oxlint JS plugin (`empire/…`), registered
// in .oxlintrc.json's jsPlugins; each rule is in its own file
// (packages/lint/README.md)

import reportUnexpected from "./report-unexpected.ts";
import wordsFromCatalog from "./words-from-catalog.ts";

export default {
  meta: { name: "empire" },
  rules: {
    "report-unexpected": reportUnexpected,
    "words-from-catalog": wordsFromCatalog,
  },
};

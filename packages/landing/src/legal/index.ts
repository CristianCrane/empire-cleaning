import type { Catalog, LegalKey } from "@empire-cleaning/models";
import { twin } from "../twin.ts";
import { privacy } from "./privacy.ts";
import { privacy as privacyEs } from "./privacy.es.ts";
import { terms } from "./terms.ts";
import { terms as termsEs } from "./terms.es.ts";

// the site's two policies (#462): the Privacy policy and the Terms of
// service, each a page of plain parts. Their names and addresses are
// models' legalPages, which the web app's sign-in page links too. The owner
// checks the words on #206, and their Spanish in each one's twin; neither is
// legal advice
export type LegalPage = {
  // which policy it is, in either language
  key: LegalKey;
  // the day it takes effect (YYYY-MM-DD): a change to what it says gets a
  // new one
  effective: string;
  description: string;
  sections: { title: string; text: string[]; list?: string[] }[];
};

// what a twin takes from the English
const facts = ["key", "effective"] as const;
export type LegalWords = Omit<LegalPage, (typeof facts)[number]>;

const legalPages: Catalog<LegalPage>[] = [
  twin(facts, privacy, privacyEs),
  twin(facts, terms, termsEs),
];

// a policy, by its key
export const legalOf = (key: LegalKey) =>
  legalPages.find((p) => p.en.key === key)!;

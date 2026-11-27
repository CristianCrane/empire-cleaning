# Spanish for everyone but the Office, in each person's Preferred Language

The landing site says "Se habla español" and the crew speaks Spanish, so everything a Guest, Client or Cleaner sees comes in English and Spanish: the landing site, the Quote form, the Client portal and sign-in, the Cleaner area, the emails to all of them, and the API's messages. The Office workspace stays English: the Office works in English, and translating the Price List's screens would cost a lot for nobody.

Each Client and each Staff member has a Preferred Language, English or Spanish, that their screens and messages follow. It lives on the Client and the Staff member, not the Account, because Guests and Clients the Office entered get emails without an Account (ADR-0006, ADR-0012). The portal shows the Client's, the Cleaner area the Staff member's; before sign-in a screen follows the page the person came from, or else their browser.

Words live in typed catalogs, every string in English and Spanish side by side, so a missing Spanish string fails the build instead of showing English on a Spanish screen. Words are never picked by a branch on the language, which would skip that check (`empire/words-from-catalog`). The `Language` type, the catalog's type and its lookup are written once, in `packages/models`. We chose this over i18next or Lingui, whose extraction tooling serves a translator workflow we don't have, and which would add a dependency to every package. On the landing site (ADR-0005), each typed content module gets a Spanish twin of the same type, which Astro's i18n routing serves.

The API turns its messages into words itself, in the language each request says its screen is showing (`Accept-Language`, English when it says none), rather than returning codes for each client to word: under ADR-0003 the API is the only way in, so a future Cleaner app gets the same Spanish without copying the web app's wording, and the server needs a Spanish catalog for its emails anyway.

## Consequences

- Every landing page has a Spanish twin under `/es/`, with `hreflang` links both ways. The header switches between them; nothing redirects by browser language, so nobody is trapped in the one they didn't want.
- Spanish is neutral Latin American, *usted* to Guests and Clients, *tú* to Cleaners. Each Client- or Cleaner-facing term has one Spanish word for its screen word (ADR-0029), which every screen and email uses.
- A Guest's first Quote sets the new Client's Preferred Language from the page they asked on; a Quote added to an existing Client leaves theirs as it is. Office Staff set it for a Client they enter or Staff they invite, and see it, so they know to phone in Spanish.
- Anyone may change their own, and that writes every Client and Staff member their Account is connected to: one person, one language.
- Services, Add-ons and Premises Types have an optional Spanish name, and a Service its description too, which Clients see when it's set.
- Text a person writes, such as Access Instructions, a reason or a review, is shown as written, never machine-translated.
- Dates, money, plurals and lists come from `Intl`, in `en-US` or `es-US`, through one set of formatters in `packages/models`.
- The Stripe card form and pages and the Google sign-in button are shown in the person's language.
- An agent drafts the Spanish; the owner, or a Spanish-speaking member of the crew, checks it before launch.
- Texts (#211) will follow the Preferred Language too.

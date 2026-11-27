# Words a person reads

Every word a person reads: labels, page text, screen messages, the server's that reach a screen (a 409's or 429's message, field errors, a 404's where a screen shows it, as Confirm email does), and emails.

## Words

- Any other 404's text is never shown (`useAction`), so it stays as it is (#336).
- Everyday words: a GLOSSARY term's `_On screen_` word where it has one; sentence case; terms lowercase in a sentence; a Service's name keeps its capitals.
- One word per concept for every reader, and one concept per word (ADR-0029, which holds the Job exception): an Add-on is an "extra", an Adjustment a "price change"; where a reader sees extras, "extra" is no adjective ("1 more hour", "upper floors").
- To a Client we're "us" ("Please call us", not "the Office").
- A wait's alert says what's happening and how long it usually takes, promising neither ending (models' `paymentNotDone`, #534).
- A paused plan says what the pause does in one sentence wherever a Client reads it (Client portal > Bill, Client portal > Your plan, the cards of Client portal > Payments and Client portal > Home, emails): "Until it's paid, we won't book more cleans on your plan." when it asks them to pay, "Until it goes through, …" when not (`noMoreCleans`). It's true whether or not cleans are booked, and says "paid" only where paying is theirs to do (the user's call, #536). The terms and the pause-warning email keep "Cleans already booked still go ahead" (`BOOKED_GO_AHEAD`).
- A weekly Bill's costs say which Bill: one owed before that week's Bill is made goes on it, "goes on your bill for that week" to the Client (`ON_WEEKS_BILL`), "goes on that week's bill" to the Office (`ON_THAT_WEEKS_BILL`); a fee goes on its Job's week, and one settled after the clean on the next (#244).
- Words that state a rule are checked against the code (`lateFeeOf` charges a clean's share, not the plan's deposit, as the app and the first Terms once said, #462). Words on money, fees, refunds or who sees a Client's details name, in the review's prompt, the function each claim was checked against.
- A message both the server and a screen show is written once in `packages/models/src/messages/`, a file per subject (`jobs.ts`): a Guest's, Client's or Cleaner's is a catalog string in English and Spanish (`messages[lang]`, ADR-0025), an Office-only one an English constant beside them.
- A field that's too long says its limit, from the server's `keepUnder` ("Keep the reason under 500 characters").
- A length of time is said as its reader needs it (#548): to the Office to the minute ("1 h 38 min", `formatHours`; an end "9:00 AM to 10:38 AM"); to a Client or Cleaner to the quarter hour, "About" only when rounded (models' `howLong`, emails too; "until about 10:45 AM").
- Hours typed or priced at a rate read as typed, in decimals (`typedHours`): Office > Prices' figures, a price's working and running totals ("2.3375 h"), cleaning hours (shown only for a crew of more than one, as one cleaner's is the time on site), "+1.5 h", a cleaner's working hours ("7.5 h"). Office > Schedule reads booked and free time as lengths.
- A plan whose weekdays' cleans are alike says its length once; once they differ, each kind is its own fact naming its weekdays ("On site Mondays and Fridays, with 2 cleaners" beside "On site Wednesdays, with 1 cleaner"), never a "+", which reads as a sum and matches by position. Weekdays alike to their reader go together, so a Client may read one where the Office reads two.

## Language

- Copy fits either language: Guest, Client and Cleaner screens are in English and Spanish (ADR-0025), and Spanish runs 20-30% longer, so shorten the label, never squeeze the layout. The layout test opens each in both.
- Dates, money, numbers, lists and plurals come from models' `formats[lang]`, never a screen's own formatter. Lists have no comma before "and", so English lists use en-GB's `Intl.ListFormat`, the rest en-US and es-US.
- A screen's words come from its catalog in the language shown (`useSaid(words)`, `screens/words.ts`), never a `lang === "es"` branch. A word more than one screen shows is in one catalog, once: the portal's `portal/words.ts` (`p`), the Cleaner area's `cleaner/words.ts` (`c`), the rest `labels.ts`; `pnpm lint` (`catalog-copies`) fails on the same English twice.
- A word every area shows addresses no one (Clients read usted, Cleaners tú): the Account menu, error pages, `labels.ts` and the design system's words are impersonal ("Se puede intentar de nuevo"). A word that addresses its reader goes in its area's words; English whose Spanish differs by place is listed as allowed in `catalog-copies` (#305).
- Who reads which: the Client portal in the Client's Preferred Language, the Cleaner area in the Staff member's, the Office in English, and before sign-in in the linking page's (`?lang=es`, remembered) or the browser's. How it's kept: `packages/web/src/language.ts`'s header, and `router.tsx`'s `areaLanguage`.
- A screen still in English takes `messages.en`, `formats.en`, `screenWords.en`, so a search for `.en` finds each one left; the Office's stay so. A shared part's Office-only words stay an English string beside the Client's catalog word.
- Words are made where the reader's language is known: a caller hands over what happened (cents, a kind, a record, a null card), never a made sentence or formatted amount (#304 sent English in Spanish emails, which a `.en` search can't find).
- A Spanish sentence ending on a time takes one stop (models' `oneStop`; a bold time on its own, `stopAfter(time)`); the emails' test and the layout spec fail on "a.m.." (#304).
- A change of language takes effect on the screen as it is, with no reload (Stripe's `elements.update({ locale })`; a route deciding the language); its test switches a screen already showing (#303's two misses, #305).
- A Spanish rough amount says "cerca de", never "unas" or "unos" (`labels.about`, #305).

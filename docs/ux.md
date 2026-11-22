# UX rules

How Empire Cleaning's screens are meant to look and behave, and why. Read
this before designing, prototyping, reviewing or changing any screen in
`packages/web`, `packages/ui`, `packages/quote-request` or
`packages/landing`, and before writing any words a person reads: a server
message or an email too (Words).

- **Screen types** says what kinds of screen there are, the design
  principles every one keeps, and each type's rules. Every screen renders
  through the layout for its type (ADR-0031).
- **The rules** below are this product's; the `ui` skill's hold here too.
  Most have a live example in Storybook under **Patterns**
  (`packages/ui/src/Patterns.stories.tsx`), named in brackets.
- **Changing a screen** says how a new UX question is settled.
- **`docs/screens.md`** lists every screen: its route, its type, the rule
  it keeps and its parts in order.

They came out of a screen-by-screen UX pass (#96). These aren't ADRs: they
can change, through the same loop.

## Principles

- **Least Client friction.** In every Client-facing choice, pick the option
  with the fewest steps for the Client (passwordless sign-in, self-serve
  choices instead of round trips to the Office), and call out any trade-off
  that adds steps.
- **Figures the owner edits are concrete.** Hours per room, not
  multipliers pointing at figures elsewhere; when figures combine, show a
  worked example beside them (the Service page's Example Quote).

## Screen types

Every screen is one of seven types, and renders through the layout for its
type (ADR-0031). The layout places the page's parts (the breadcrumbs, the
title row and its subtitle, where actions sit, the bar at the foot); the
screen fills its slots and never places those parts itself, nor lays out a
facts grid by hand, which is the kit's, one for every screen and dialog
(#432).
`pnpm lint` fails where a screen does (`empire/screen-layout`,
`packages/lint`), every type having its layout since #437. The layouts live in `packages/ui/src/layouts/`. Which type
each screen is: `docs/screens.md`'s Route index. A new screen takes a type
from here; one that fits none is a new type, settled as Changing a screen
says before it's built.

### What every type keeps

The owner's design principles (2026-11-13): **clear, focused, simple,
peaceful**. No screen overloads anyone with clutter and detail; the `ui`
skill says how, and here:

- **What each screen leads with:** a home screen, what's next; a money page,
  whether anything is owed; a Cleaner's list, where they're working.
- **What waits behind a tap:** a "How it's worked out" link, a folded
  section, the Actions menu.
- **Details belong on the detail page**, not its row.

### Record

A page about one thing: a Job, a Quote, a Client, a home, a plan, a Site
Visit, a Bill, a Staff member. It renders through `RecordPage`
(`packages/ui/src/layouts/RecordPage.tsx`, #432), which places, in order:

- **The page header** (the rule under Page structure).
- **At most two alerts**, the most pressing first (danger, warning, info,
  success), the rest behind "Show N more". Each is one Notice with at most
  one action (no alert in an alert: the `ui` skill). What an action's failure
  says is a Toast, not a Notice on the page (a retried charge, a plan
  offered).
- **The details card** (`DetailsCard`): what it is, large, behind its tile
  (a `DateTile` for when, an `IconTile` for what, an `Avatar` for who),
  a muted line above and below; then its facts (`Facts`, each an icon, a
  value and a muted line), with the time, the address and how to reach
  someone among them, not in a part of their own.
- **Its parts**, each a Section. An action on one part stays on that part's
  title line (End plan, red, on the plan; Billing's Edit). A part
  with nothing in it yet offers its action (`ActionRow`). Money is one
  part: its facts, the price changes in it, "How it's worked out" folded
  (`Fold`).
- **Its History**, a `Timeline` in a Card, newest first: last, at every
  width: one column, as a side column competed with the page (#493 builds
  it). What happened (a drop-out, a Cleaner taken off) is told there, not
  kept as a row elsewhere. A Quote's story is its
  body, **Now** on top holding it as it stands; its Draft is a Form page.
- **On a phone, the page's actions pinned at the foot**, above the tab
  bar, after the facts (#493 builds it).

("Layout / RecordPage"; "A Record: its header, two alerts, its details, its
parts"; "A record's History beside it, from xl"; "Records as stories")

### List

Every one of something, to find one and open it. It renders through
`ListPage` (`packages/ui/src/layouts/ListPage.tsx`, #433), which places, in
order:

- **The page header**: the title, in a phone's top bar, no breadcrumbs, and
  at most one primary, filled, for making a new one (New quote, Invite
  staff).
- **Its Tabs**, the one way it splits, each with its count, and no All
  (Services' Retired and Staff's Deactivated are Tabs too). The Tab, the
  search and how many are shown live in the URL, so Back keeps them. It
  opens on the first Tab that holds anything, or, where the server pages
  it (Jobs, Clients), on its first Tab, asked for before the counts are
  known.
- **A search**, on an Office work list only: at the end of the Tabs' line
  from `md`, behind an icon on a phone. It looks through every Tab: the Tabs
  step aside for "N found in every tab", every row then says where it
  stands, and Clear search brings them back. One that matches nothing says
  so, with Clear search.
- **Its rows**: an Office list is a `Table` from `md` (sortable where it
  helps, Quotes'), rows on a phone; a Client's or a Cleaner's is rows at
  every width. Dated rows are grouped by month at every width, each month
  its own List or Table under its name. As rows they lead with a small
  `DateTile`, then the weekday and time (a Table's first column gives the
  date and time), then what the person looking tells them apart by: the Office the Client, the address and service under it; a Cleaner
  roughly where (the postcode), the service under it; a Client the kind of
  clean, with the home only when they have more than one. A row is badged
  only when it isn't the usual case for its Tab (Needs cleaners, never
  Staffed), and the Table's Status column only shows while a row has one.
- **50 at a time**, then "Show more (N left)".
- **With nothing in it at all**: the primary in an `EmptyState`, moved
  there from the header so the page has one, or with nothing to add
  (Offers, Cleans), one quiet line.

("Layout / ListPage")

### Home

Where an area starts: the overview of everything relevant at a glance,
with a quick click for more. Today, a Client's Home and Payments, and a
Cleaner's Your jobs render through `HomePage`
(`packages/ui/src/layouts/HomePage.tsx`, #435), which places, in order:

- **The greeting**: "Hi, Jen", by the person's first name, on an area's
  first page; Payments keeps its name, hidden on a phone where the bar
  says it. Its one secondary action on the title row (Request a quote, Your
  card).
- **One answer card** (`AnswerCard`): what's next or what's owed, read left
  to right behind its tile (a `DateTile` for when, an `IconTile` for
  what), the kind of answer muted above, the answer large, a line or two,
  and the page's one primary Button. What waits on the reader leads,
  money owed first, as it's what they came to the page to do (the `ui`
  skill): while a price change waits, the card's primary is
  Review the price change and an alert says why, its tile stepping aside
  meanwhile (each fact once; where the alert sits is settled on #493's
  prototype). With nothing waiting anywhere, offers to answer included,
  it's a green all-clear card, as a screen says only what's true (the
  `ui` skill). The Office's is its first
  to-do, the server's order.
- **News** under it, an info Notice each, never an action (a move asked
  for, a bank payment on its way).
- **Two to four tiles**, two a row on a phone and one row from `sm`, each
  with a hint of what's there so a glance often answers. No row shows
  until a tile is pressed. Where its rows have a List page of their own,
  the tile links there, the count in its hint (a Client's quote, a
  Cleaner's Offers); where they don't, it shows how many (or what the kind
  is judged by, how many in its hint: the Office's Money shows what's
  owed, as its count read as money, the 11-20 audit's Today 3; #507) and opens them in place under the tiles, one at a time, pressed again to close (the
  Office's to-dos by kind and the day's Jobs, a Cleaner's Coming up, every
  payment). A tile with none is greyed out. Which one is open is in the
  URL (`?open=`), so Back from a row comes back to it. What's waiting on a
  Client (a quote, a price change to OK) is a tile rather than cut for a
  shortcut, so it stays in reach, unless the card holds it (a price
  change, while it waits; #493 builds it). Lists of past things live on
  their own pages.

Today also keeps "Lead a to-do row with what to do". ("Layout / HomePage";
"A home screen answers one question: what's next"; "A money page answers
one question first: do I owe anything?")

### Form page

A form with a page of its own, for what's too long or too often tweaked
for a dialog. It renders through `FormPage`
(`packages/ui/src/layouts/FormPage.tsx`, #434), which places, in order:

- **The page header** (the rule under Page structure), a single page
  action at the end of the title row, as a Record's one action (a
  Service's Retire), what its failure says a Toast.
- **Its alerts**, as a Record's.
- **What the page needs explained**, folded under a line saying what it
  is ("How your card is used"). Nothing else on it explains: no help text
  under the page's title or a part's. A field's own description, what a
  figure covers (Base: kitchen, living areas and entry), is the field's,
  and stays.
- **The whole form in one Card.** What the person came for is open; every
  other part is one line saying what's set ("Booking: On a plan · no site
  visit · recommends nothing else"), a tap opening it in place
  (`FormPart`). A folded part opens itself when a field in it is found
  wrong. A stepped form (Request a quote, Welcome) keeps its own steps,
  Back and Next.
- **What the fields come to** (a worked example, a price) in an aside,
  sticky beside the card from `xl`, its right column a Record's
  History's (`Beside`), and after the card below that. A price the form
  is written to reach (the Draft's, New quote's) leads instead: first
  below `xl`, so a phone reads what it comes to before the parts that
  change it. Until what sets it is known (a business's floor area), it
  says what's missing in its place, not a number, as a number then would
  be untrue (the `ui` skill). It
  shows only totals, each one's working folded under "How
  it's worked out"; what sets a price (a price of your own, its reason)
  stays in the part it prices.
- **Its button at the card's foot**, after what saving agrees to (a
  card's consent), in view. A form with a price or a Send (the Draft, New
  quote) has the page's `ActionFooter` instead (FormPage's `footer`),
  its total and whether it's saved on the left, the button on the right;
  what's said before the button (a refusal, a warning) comes after the
  card.
- **Outside an area** (Welcome), a page of its own, the logo above and
  who's signed in beside it (`PageFrame`).

It also keeps "Forms ask quietly, a few questions at a time". ("Layout /
FormPage")

- **A form the owner tweaks to see what it does stays one form**, with its
  example beside it (the Service page).
- **A form that makes a new version saves when it's pressed** (the
  Service, each save a new version); one being written saves as it
  changes (the Draft).
- **The header's action and the form's own save never run at once**: each
  shows pending while the other runs (a pending Button takes no press), so
  neither sends what the other just replaced (the Service's Retire and
  Save).
- **A save made from an older version is refused, and the form shows the
  newer one** (#447): when someone else saved since it loaded, the server
  says "Something changed just then. Please check it and try again.", the
  page reloads under it, and the form, or a Settings page's dialog, starts
  afresh from what they saved, the message kept (`useDraftOf`). The
  screen holds no copy of the rule: it reloads on any failed save.

### Settings

How things are set up, read rather than worked through. Prices and Your
details render through `SettingsPage`
(`packages/ui/src/layouts/SettingsPage.tsx`, #436), which places, in order:

- **The page header**: the title, in the bar on a phone, and at most one
  muted line, which version ("Version 7 · saved Nov 3 by Jen"). No pointer
  to another page the nav already has.
- **Its alerts**, as a Record's: what's waiting (starting figures to keep,
  a new email waiting on its link), never an explanation.
- **One card of summary rows**, a part each, saying what it's set to in a
  line ("Light 0.85× · Average 1× · Heavy 1.4×"). A tap opens its dialog
  (`SettingsPart`'s `dialog`, given its open state as a PageAction's is):
  what the part is for first, its figures, what saving does above Save
  ("Quotes already sent keep their prices"), then Cancel and Save.
- **Its lists of rows** (`SettingsList`), a Section each, its Add on the
  title's line, each row opening its own dialog or page; the retired ones
  folded after, under "Retired (N)".

Nothing on its first view explains: no Section description, no header
paragraph. ("Layout / SettingsPage")

- **Settings are read, then changed part by part**: facts and rows, each
  part changed in its own dialog (Prices, Your details).

### Message page

A page that only says something. Its layouts are `MessagePage` and Sign
in's `SignInPage` (`packages/ui/src/layouts/MessagePage.tsx`): in an area,
in its frame, nav and all; anywhere else a page of its own, the logo above.

- **A message page** (Not found, Something went wrong, the sign-in link,
  Confirm email): centred in one narrow card, a large `IconTile`, the
  title, one line, at most one Button (what fixes it), the way home a text
  link under it. No details a Client can't use. ("A message page: one
  Button, home a link")
- **Sign in is a form in the same card**: its title at the start, Google
  first, and under the card a line for someone new, then links to the
  landing site's Privacy policy and Terms of service.

### Calendar

The Schedule, one of a kind. It renders through `CalendarPage`
(`packages/ui/src/layouts/CalendarPage.tsx`, #437): the page header every
type shares, its title in the bar on a phone, then the calendar's parts.
It keeps "Schedules are calendars". ("Layout / CalendarPage")

## Rules

The `ui` skill's rules hold here too; these are this product's.

### Page structure

- **The page header is the layout's** (`PageHeader`, `packages/ui/src/layouts/PageHeader.tsx`):
  the breadcrumbs from the area's nav section down to this page, every
  step; the title and its status badge, which says where the thing stands
  for this reader now: where two states hold, the one waiting on them
  (a Client's clean: Needs your OK, Move asked; a Site Visit that has
  been: To record), in the words its rows use (#493 G3.1; the 11-20
  audit's Site visit 1; #507); a subtitle only when it says what
  nothing else on the page does (a Bill's week), never the title, a crumb
  or the Client again (each fact once: the `ui` skill); and the page's
  actions at the end of the title row: one split button, the page's next
  step its primary and the rest behind its arrow, or a ⋯ menu when nothing
  is next, sticking in a header once scrolled past, a Record's there on a
  wider screen only and at the foot on a phone (#493 builds it); a page
  whose only action destroys has no primary, that action in the same
  place, outlined in red (`danger-outline`), not in a ⋯ menu, which would
  hide the page's only action (the `ui` skill); the
  destructive last in red after a rule. Printed,
  it's the title alone.
  ("Layout / RecordPage / Actions In The Header", "One Action";
  "Layout / FormPage / Priced With A Footer" for a lone destructive action)
- **What loads holds its room** (the `ui` skill): choices from the API draw
  blank tiles at their size first (`ChoiceTilesLoading`). ("ChoiceTiles /
  Loading")
- **Sections, not Cards, around Lists and Tables.** A title sits on the
  page, above an untitled Card or a List; never a Card titled inside (no box
  in a box: the `ui` skill). ("Sections Not Cards Around Lists")
- **The landing site's bands alternate**, plain then raised, by their place
  on the page, not by which section they are (`band.ts`), so reordering
  sections never puts two alike together. A card takes the other colour
  from its band. The Quote form always sits on a raised band.

### Navigation

- **A phone's tab bar holds five shortcuts at most**, what's used all day;
  the ☰ menu, a drawer from the left opened from the top bar with the logo
  at its head, is the full menu, every section as the sidebar lists them,
  the shortcuts too (#305). Sections that aren't shortcuts are `inMenu`:
  the Office's tab bar keeps Today and the Schedule. Larger screens list
  every section in the sidebar.
  ("Layout / AppLayout / Phone Menu")
- **Related sections share a heading** in the sidebar and the ☰ menu
  (`NavItem.group`), the busiest first with none: the Office's Today and
  Schedule, then Work (Jobs, Quotes), People (Clients, Staff) and Pricing
  (Services, Prices). ("Layout / AppLayout / Groups")
- **The account's parts are the menu's foot**, in every area: under a
  divider at the foot of the sidebar, and of the ☰ menu on a phone, one
  plain item each, never behind a dialog (name and email, the other
  language in the portal and the Cleaner area, Switch to, Show tips again,
  Sign out, the theme; `AppLayout`'s `foot`). So a phone's top bar is the
  ☰ and the section. ("Layout / AppLayout / Phone Menu Foot")
- **The language is changed in one press, by the other language named in
  its own words** ("Español" on an English screen, "English" on a Spanish
  one), so someone who can't read the screen's language still finds it:
  at the foot of the sidebar and of the ☰ menu on a phone.
  It writes every Client and Staff member the person is (ADR-0025).
- **A page that takes a moment to load says so in the frame**, in every
  area (`AppLayout`'s `loading`): after 200ms a thin bar in the brand
  colour runs across the top, the page on show fades to half, and a screen
  reader hears "Loading…" once. The page on show can't be pressed from the
  press that leaves it, before it fades, so a press meant for the next page
  never lands on the old one. It and its section in the navigation stay
  until the next page is ready; the navigation stays live. A quicker load
  shows nothing, and so does a change
  within a page (a search, a Tab, the Schedule's week) or its reload after
  a save, which leave the page usable. A link's page starts loading as the
  pointer rests on it, it's focused or pressed down (`preload.ts`), so a
  page often shows at once. ("Layout / AppLayout / Loading")

### Buttons and actions

- **One primary Button per page** (the `ui` skill); everything else is
  secondary, text or quiet.
- **A bar at the foot of a page is an `ActionFooter`**, which the page's
  layout places, never a sticky bar of the page's own, which pins under the phone's tab bar (#425). It holds,
  above the tab bar, a Record's actions on a phone (a Cleaner's Job on
  site), which a wider screen keeps in the header instead (the `ui` skill;
  #493 builds it), and a form's price and its button (the Quote Draft's
  Send, New quote's Draft a quote), full width beside the sidebar on a
  wider screen until #493 settles it with a prototype. What it sums up
  (prices, whether it's saved) on its left, the main action last, on the
  right. The layout test fails a button or link under a fixed bar. ("A
  bar at the foot is an ActionFooter")
- **Buttons are ranked by fill**: primary filled, secondary outlined,
  `text` for a Section's actions, `danger-text` beside them, a page's
  lone destructive action outlined in red (`danger-outline`), `danger`
  filled only in the dialog that confirms it, `quiet` only to back out. What's pressable looks it, and the
  reverse (the `ui` skill).
  ("Clickable catches the eye")
- **A Section's actions are text Buttons** on the title's line, no taller
  than it; on a phone they wrap under the title.
- **A red button is for what can't be got back** (the `ui` skill): End
  plan, Cancel bill, Deactivate (the places it frees on Jobs don't come
  back). Declining a quote is `quiet`, as it backs out of the quote, not
  red, as the Client can ask again, and its confirm is the dialog's
  primary; so is the Office's Turn down of a Client's move. A Service's
  Retire isn't red (Offer again brings it back), nor a Draft's Remove
  <weekday> (Add a weekday does).
- **Continue with Google is Google's own button** (the `ui` skill: a
  third-party sign-in keeps its owner's look): their colours in light and
  dark, their logo, Roboto. Only the 44px touch height is ours.

### Notices

- **A Notice holds at most one action**, a text Button (or `ButtonLink`) on
  the right of its text, never primary, and not the page's next step,
  which is the page's primary (the `ui` skill; #493 builds it). Two
  things to say or do are two Notices. ("Notices hold one action")
- **Tone means what a status's does**: warning for something waiting on
  someone, danger for something that failed or is late, info for what
  they're waiting on us for, success for done.

### Words

Every word a person reads follows these: labels, page text, the screens'
messages, the server's that reach a screen (a 409's or 429's message,
field errors, and a 404's where a screen shows it, as Confirm email
does), and emails. Other 404s' text is never shown (`useAction`), so it
stays as it is (#336).

- **Everyday words, the ones a person would say.** A term from
  `GLOSSARY.md` uses its `_On screen_` word where it has one: cleaning
  hours, not Labour Hours. Labels are in sentence case and terms are
  lowercase in a sentence: "Send a quote", "your cleaning plan". A
  Service's name, such as Deep Clean, keeps its capitals.
- **One word per concept, for every reader, and one concept per word**
  (ADR-0029; a status is the reader's: the `ui` skill). The Office,
  Cleaners, Clients and Guests read the same word
  for a term: an Add-on is an "extra" to everyone, an Adjustment a "price
  change". No word names two terms, and where a reader also sees extras,
  "extra" isn't an adjective either: more time is "1 more hour", a home's
  floors above the first "upper floors". Job is the one exception, kept
  on purpose: "clean" to a Client, "job" to the Office and Cleaners, since
  to the Office a job isn't always a clean (painting is a job too). Don't
  fold it, or copy it for another term. "Us" to a Client is how we speak (below),
  not a second name for the Office.
- **A problem says what's wrong, then how to fix it** (the `ui` skill): "Not
  enough cleaners are free then. Pick another time, or add working hours for
  a cleaner that day." No counting unless the number helps. When nothing can
  be done: "This clean was cancelled."
- **A field that's too long says its limit** (the `ui` skill), from the
  server's `keepUnder`: "Keep the reason under 500 characters".
- **Words that state a rule are checked against the code** (the `ui` skill):
  `lateFeeOf` charges a clean's share, not the plan's whole deposit, which
  the app and the first Terms of service once said (#462). Words on money,
  fees, refunds or who sees a Client's details name, in the review's prompt,
  the function each claim was checked against.
- **To a Client, we're "us"**: "Please call us", not "the Office".
- **A message the server and a screen both show is written once**, in
  `packages/models/src/messages/`, which both import: a file per subject,
  such as `jobs.ts` for a Job's time and room. Those a Guest, Client or
  Cleaner may read are models' catalog strings, in English and Spanish
  (`messages[lang]`, ADR-0025); those only the Office reads are English
  constants beside them.

### Language

- **Copy fits in either language.** Every Guest, Client and Cleaner
  screen comes in English and Spanish (ADR-0025), and Spanish runs 20–30%
  longer. Where a Spanish label doesn't fit a tab, Button, `DateTile` or
  Notice, the label is shortened, never the layout squeezed. The layout
  test opens each of their screens in both.
- **Dates, money, numbers, lists and plurals come from `formats[lang]`**
  in `packages/models`, never a formatter of a screen's own. Lists have no
  comma before "and" ("Monday, Wednesday and Friday"), so English lists
  alone use `en-GB`'s `Intl.ListFormat`; everything else is `en-US` or
  `es-US`.
- **A screen's words come from its catalog, in the language it's shown
  in** (`useSaid(words)` in `packages/web/src/screens/words.ts`: its own
  words as `w`, with `formats`, `messages` and `screenWords` of that
  language). A word more than one screen shows is in one catalog, once:
  the portal's (its navigation, breadcrumbs, tours) in `portal/words.ts`
  (`p`), the Cleaner area's in `cleaner/words.ts` (`c`), the rest in
  `labels.ts`, which tours can import too. `pnpm lint` fails on the same
  English in two catalogs (`packages/lint`, `catalog-copies`). Never a
  `lang === "es" ? … : …` branch: the words differ, so they're a catalog's.
- **A word every area shows addresses no one.** Clients read *usted*,
  Cleaners *tú*, and a catalog has one Spanish per language, so the Account
  menu, error pages, `labels.ts` and the design system's words are
  impersonal ("Se puede intentar de nuevo", "Ir a la página de inicio",
  "Intentar de nuevo"). A word that has to address its reader goes in the
  area's own words; English whose Spanish differs in each place, as it
  agrees with a different noun (a clean is *Terminada*, a job *Terminado*)
  or speaks to a Client in one and a Cleaner in the other ("Vuelva" and
  "Vuelve a intentarlo"), is listed as allowed in `catalog-copies` (#305).
- **Which language a screen is in** is the app's one store
  (`packages/web/src/language.ts`): the portal the Client's Preferred
  Language, the Cleaner area the Staff member's, the Office English, and
  before sign-in the language of the page that linked here (`?lang=es`,
  remembered in the browser) or else the browser's. The design system and
  react-aria follow it through `LanguageProvider`; the API is told it on
  every request; `<html lang>` says it.
- **A screen still English takes `messages.en` and `formats.en`** (and
  `screenWords.en`), so a search for `.en` finds every one left to
  translate. The Office's stay that way; where a part shared with the portal
  words something only the Office reads, that stays an English string
  beside the Client's catalog word.
- **Words are made where the reader's language is known.** A caller hands
  a screen or an email what happened (cents, a kind, a record, a null card),
  never a sentence or an amount already formatted: words made before it
  were English in every Spanish email of #304 (`sendBill`'s paragraphs, a
  settled Job's label, `?? "card"`), and a search for `.en` doesn't find
  them.
- **A Spanish sentence that ends on a time takes one stop.** es-US writes
  "9:00 a.m.", so a sentence ending on a time, or on a list of them, goes
  through models' `oneStop`, and a time a screen shows on its own (in
  bold) is followed by `stopAfter(time)` rather than a string starting
  with ".". Five review rounds of #304 found "a.m.." one shape at a time
  across the portal; the emails' test and the layout spec (every Client
  and Cleaner screen in Spanish) fail on it.
- **A change of language takes effect on the screen as it is**, with no
  reload: whatever is set up once in a language (Stripe's form,
  `elements.update({ locale })`; a route deciding the screen's language)
  follows the change, and no step in between shows another language. Its
  test switches language on a screen already showing and checks what
  shows, not only a screen opened in it. Both of #303's misses, the card
  form and the English flash on returning to the tab, passed tests that
  opened screens in Spanish (#305).
- **A Spanish amount that's roughly so many says "cerca de"**, never
  "unas" or "unos" before the number, which agree with it and read "unas 1
  h" when it's one (`labels.about`). Round 1 of #305 found it in an email
  and four screens, each written the same way.

### First-time help

- **First-time help is a spotlight tour, never a Notice or a checklist
  card**: nothing may shift the page's layout. One to three steps, each
  popover beside what it points at (`startTour`), shown once per screen,
  the first time it matters: its tour runs only when every step's target is
  on the screen. ("First-time help points, never pushes")
- **Steps find their targets by the screen's own words** (what's pressed,
  a link or Button, by its text; a part, a Section or labelled group, by its
  name), never `data-tour` attributes; the tours spec fails when one can't
  be found.
- **Each area's one line of value leads the first of its tours a person
  meets.**
  Closing a tour partway counts as seen; Show tips again, at the menu's foot,
  brings every tour back.

### Dialogs and rows

- **A row holds no Buttons.** Pressing it opens one dialog that does the
  work. A row that opens nothing (someone on a Job's crew) may hold one
  quiet icon Button where the chevron would be, opening its dialog (an ✕
  takes someone off). ("Rows open one dialog, two Buttons")
- **A dialog has at most two Buttons**, one filled (primary, or danger) and
  one quiet (Cancel, or an alternative like Dismiss), plus the ✕.
- **Never a dialog on a dialog.** A second look (Remove, Turn down) is a
  step inside the same dialog; a picker sits in the dialog itself, the
  dialog made wide if it needs room.

### Lists and tables

- **Lead a to-do row with what to do** (Send a quote, Find cleaners), a
  toned `IconTile` for the kind; rows that only show things keep the name
  as the title. ("Action First To Do Rows")
- **A row's title and line wrap rather than cut** (the `ui` skill), and
  Spanish runs longer. `ListItem` wraps both, anywhere, so every List does: a long
  email in a Settings summary row breaks rather than running off a phone
  (#436). On a phone a row's badge (`end`) sits under its text rather than
  beside it (#305).
- **Lean rows**: the fewest columns that drive the decision (who, where,
  status, money, age); no cell that means something different from row to
  row (and colour: the `ui` skill).
- **Dated things a person scans are grouped by month**. As rows, each is a
  `DatedItem`: a small `DateTile`, then the weekday and time leading its
  title, the date said in words to a screen reader (the tile is only
  seen); in a Table, the first column gives the date and time. A row is
  badged only when it isn't plain.
- **An empty place offers what fills it** (`EmptyState` with its action),
  never says again what its Section's
  description above it already says (each fact once: the `ui` skill).
  ("Empty states offer the action")

### Forms

- **Forms ask quietly, a few questions at a time**: tinted fields with a
  bottom line; `SegmentedControl`, `ChipGroup` or `ChoiceTiles` for short
  choices; optional fields behind "+ Add …"; long forms in steps, who's
  asking last. The Office on the phone gets one page in the order of a call
  instead. ("Quiet Forms In Steps")
- **A form starts blank for someone new**: no answer is picked for them,
  as one would say something about their place they never said; each
  required one is asked before Next. A place on file starts at what's
  recorded, and a form one person fills again and again (the Office's)
  at their usual answers (#493 G2.3).
- **Every search field shows a magnifying glass.**

### Time and schedules

- **Schedules are calendars**: a day, three days or a week on the Schedule
  (a day on a phone, so its blocks have room to name their client;
  elsewhere three at first, then the span last chosen in that browser;
  #493 builds it), a month on a
  Cleaner's availability. Jobs are timed events (start and
  duration), ready for a Google Calendar sync. A Job or a Site Visit
  dragged on the Schedule carries a picture of its block, and an outline
  its size shows where it would land, snapped as the drop is: its own
  colours, a see-through fill inside a dashed edge, red where it can't go
  (the server's rules: for a Job, hours and a crew free; for a Site Visit,
  a time not yet passed, its visitor's hours or Office Staff, a crew free,
  and busy with nothing else; both end by midnight); a day where it can go
  at no time fades. A Job drags while booked and not yet started; a Site
  Visit while booked, even once its time has passed, so a missed one moves
  to a time to come. Either move is confirmed first. ("Schedules As
  Calendars")
- **Every place a time is chosen uses the calendar picker**, with the day
  and time fields kept as the keyboard path. The Office picks on the
  Schedule (`office/SchedulePicker.tsx`, inline in a wide dialog); a Client
  picks a day on a month, then that day's open times
  (`screens/AvailabilityPicker.tsx`). Clients never see the Schedule or
  anyone else's Jobs.

### Status and colour

- **A status is the same colour everywhere** (the `ui` skill): info just so, success done
  or running as it should, warning needs someone, danger went wrong,
  neutral not going ahead. ("Status colours")
- **One icon per concept** (the `ui` skill), in `screens/icons.ts`: a Quote is
  `ClipboardPenLine`.

### The logo

- **The logo is used exactly as drawn** (`Logo`), as it's the business's
  own mark: not redrawn, cropped, recoloured beyond its own dark version,
  or rearranged into a lockup. Where it doesn't fit, the screen changes
  around it. On a phone the top bar names the section you're in and the
  logo heads the ☰ menu; the sidebar holds it centred; the landing site
  has no header bar, just the language, Sign in and the theme in the top
  right corner. The hero leads with what we clean and where, as a
  stranger gives it a few seconds (the `ui` skill): the logo goes up
  into the header, smaller, and the slogan, if it stays, below the
  headline (#505 builds it).
  ("Foundations / Logo")
- **A section is named once on a phone.** The top bar names the section,
  so a section's own page (Jobs, Payments, Your Jobs…) hides its heading
  on a phone (`Heading inBar`, which its layout places); screen readers and larger screens keep
  it. A heading that says more than the bar stays: a Home's greeting ("Hi,
  Casey"), a Job's or a Quote's name on the pages within a section.
- **The favicon is a separate mark**: the logo's roof and window with its
  skyline behind, no background, in the logo's light or dark colours.

## Changing a screen

1. **Ask the question.** What is the screen for, and what's wrong with it
   now?
2. **Prototype it** on a `prototype-<screen>` branch: a signed-out route
   (`/prototype/<screen>?case=&layout=`) with made-up data for every state,
   ↑/↓ to switch layouts and ←/→ to switch cases (`PrototypeSwitcher`,
   copied from the latest `prototype-*` branch, as it isn't on main).
   Usually three layouts. Push the branch; it's kept as the record. It never
   becomes a PR, so it skips the change review (the `change` skill's
   Prototype rule).
3. **Pick one** with the user, and note any tweaks.
4. **Build it** on a `ux-<screen>` branch, through the layout for its type
   (a change to how every screen of a type looks is a change to its layout),
   with its tests (e2e on phone and
   desktop, axe in light and dark through the harness's `expectAccessible`,
   the layout test at every width, a Guest's, Client's or Cleaner's screen
   in Spanish too, through `expectFitsInBoth`). Moving a screen onto its
   layout drops nothing by accident (the `ui` skill, "Reworking a
   screen"): #432's review found three such drops, and #434's two more. A
   part dropped on purpose gives its reason in its `docs/ux-log.md` row.
5. **Record it**: a row in `docs/ux-log.md`; a new rule above (a
   type's own under its entry in Screen types), and a
   pattern in Storybook, if it carries over to other screens; and in
   `docs/screens.md`, a new route's row in the Route index and its entry, or
   the entry of a screen whose parts or their order change.

A change that only applies these rules needs no prototype; it still gets a
row in `docs/ux-log.md`.

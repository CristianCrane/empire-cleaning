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
  section, a page's rarer actions behind its next step's arrow or a ⋯.
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
  a muted line above and below; never what the page's title already says,
  so a Staff member's card leads with their role, as their name is the
  title (#548's UX review U46); then its facts (`Facts`, each an icon, a
  value and a muted line), with the time, the address and how to reach
  someone among them, not in a part of their own. A card that counts its
  facts (the Office's Job and its Money, a Bill) takes as many columns as
  they need (`factColumns`), so none sits alone in a part of a row
  squeezing its words: a lone fact the whole row, four two and two. Every
  card's, by what it shows: #553.
- **Its parts**, each a Section. An action on one part stays on that part's
  title line (End plan, red, on the plan; Billing's Edit). A part
  with nothing in it yet offers its action (`ActionRow`), unless that
  action is the page's next step, in the header: then the part waits until
  it has something (a Site Visit that has been, Record findings; each
  action once). Money is one
  part: its facts, one line a fact, "How it's worked out" folded
  (`Fold`); a Job's price changes are a part of their own after How it
  went, as they're what happened there (a list on a phone, a table wider).
- **Its History**, a `Timeline` in a Card, newest first: last, at every
  width: one column, as a side column competed with the page (#493). It
  holds what has happened; what's booked to come is a part of its own (a
  home's Booked jobs, soonest first, badged only when one needs cleaners),
  so the log isn't mostly the future, each entry alike. Each
  entry says what happened on one line and when on the line under it, then
  what it was about, where it has a line of its own, under that ("Standard
  Clean $194.89 · 2 cleaners · for Mon, Jan 12, 9:00 AM"), every entry alike
  (`TimelineItem`, a Quote's story too); on a Job's, any more there is goes
  after a colon in that line (a cancellation's reason), not on a third. A
  home's History is the one exception: each entry there is a record, its
  Quote, Job or Site visit, its state now a badge ("Quote · Deep Clean
  $359.29", Accepted), dated by when it was sent or took place. A home
  holds many records, each with its own story a tap away, and one entry
  each keeps the home's short. Telling it as events, as every other
  History does, is #555 (#548, U33). A
  Quote sent again names what it changed of the send before it, in the
  Draft's words for its fields and in the Draft's order: "Quote sent again ·
  cleaners changed", "· Deep Clean price changed" where only the Service
  offered beside it moved, "· nothing changed". It names what changed, not
  what to: the entry's own line holds what decides whether the clean fits,
  the price, the crew and the time it was sent for (a plan's crews each with
  their weekdays once they differ), so two entries show a before and an
  after, and **Now** the rest. The server works it out (`revisionChanges`),
  field by field, so a price the Price list moved between sends reads "price
  changed" (#548). What happened (a drop-out, a Cleaner taken off) is told there, not
  kept as a row elsewhere. A Quote's story is its
  body, **Now** on top holding it as it stands; its Draft is a Form page.
- **On a phone, the page's next step pinned at the foot**, above the tab
  bar, after the facts, the rest behind its arrow in a sheet; a wider
  screen keeps it in the header (`RecordPage`'s `next`). Greyed, it says
  why in a line above it there (its `why`, `ActionFooter`), as the alert
  that says so has scrolled away (#534).

("Layout / RecordPage", "Next Step At A Phones Foot"; "A Record: its header, two alerts, its details, its
parts"; "A record's History last, one column"; "Records as stories")

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
- **A search**, on an Office work list only: at the end of the Tabs' line,
  a field from `md` and an icon that opens one on a phone, so it never
  takes a row of its own under the bar that names the list. It looks through every Tab: the Tabs
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
  card), which stands aside while the card asks something out of the
  usual of them (below; #493).
- **One answer card** (`AnswerCard`): what's next or what's owed, read left
  to right behind its tile (a `DateTile` for when, an `IconTile` for
  what), the kind of answer muted above, the answer large, a line or two,
  and the page's one primary Button. What waits on the reader leads,
  money owed first, as it's what they came to the page to do (the `ui`
  skill): on a Client's, money owed that asks something, then a price
  change to answer, then the morning a crew couldn't get in, then a quote
  ready. When the card needs a reason (money late, a price change, a crew
  who couldn't get in), an alert in its sentiment's colour sits between
  the greeting and the card and says why (what happened, on which clean,
  by when), and the card says what to do, its amount and its primary, so
  each fact shows once: the facts before the decision, read top to bottom
  (#493's D2, `prototype-home-alert`). What the card holds steps out of
  the tiles meanwhile; while it asks something out of the usual (money
  owed that asks, a price change, a crew who couldn't get in), the title
  row's action stands aside too. A paused plan with nothing to do is the
  plan's card, its alert calm (info), its way to the plan outlined. Money owed that asks nothing (a
  payment we try again ourselves, or their bank payment on its way) is
  Payments' card alone, calm: info,
  "Payment pending" and one line, that there's nothing to do (and, while
  it pauses a plan, "Until it goes through, we won't book more cleans on your
  plan."), and its way to see it outlined, as the page has no next step.
  With nothing waiting anywhere,
  offers to answer included, it's a green all-clear card, as a screen says only what's true (the
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
  shortcut, so it stays in reach, unless the card holds it. Lists of past things live on
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
  sticky beside the card in a 22rem column from `xl`, and after the
  card below that, the page then the content's width ("A wide screen
  keeps a readable column", below); with no aside, the page is a form's
  width, its header with it ("A form keeps a form's width", Forms). A price the form
  is written to reach (the Draft's, New quote's) leads instead: first
  below `xl`, so a phone reads what it comes to before the parts that
  change it. Until what sets it is known (a business's floor area), it
  says what's missing in its place, not a number, as a number then would
  be untrue (the `ui` skill). It
  shows only totals, each one's working folded under "How
  it's worked out"; what sets a price (a price of your own, its reason)
  stays in the part it prices. A one-off Draft's price is the one asked
  for, its own Service's; the Service recommended for a first visit,
  which the sent Quote offers too (ADR-0018), is an aside: one quiet
  line under it ("Also offered: Deep Clean $299.41"), its price and
  working folded behind it, and in the Service part its own price behind
  a fold (the user, on #527: "The recommendation is an aside"). Under
  each option's price, unfolded, the one asked for and that line both,
  why the client can't pick it at the time proposed ("The client can't
  pick it at this time: that day is too full."), a warning; in danger
  when it would run past midnight, which Send refuses. When the Service
  offered has the same problem, the line under the one asked for names it
  ("The client can't pick it or the Deep Clean at this time: …"), said
  once.
- **Its button at the card's foot**, after what saving agrees to (a
  card's consent), in view. A form with a price or a Send (the Draft, New
  quote) makes its button the page's next step instead (FormPage's
  `next`, #493 D1): from md the header's primary, a Draft's Delete draft
  behind its arrow, whether it's saved beside it (shown from the start,
  "Saved", then what Send waits on, if anything: "Saved · Pick a time to
  send", "Saved · No room on Fri, Dec 4 at 11:30 AM"), and once scrolled the header that sticks carries the title,
  the total (below `xl`, where the prices beside the form don't stay in
  view; a one-off Draft's named, "Standard Clean $194.89", the
  recommendation in neither) and the button; on a phone the page's `ActionFooter`, its total
  and whether it's saved on the left, the button on the right, Delete
  draft alone on the title row. The sticky header's total slides in with
  it, once the title row's button has scrolled away, and never from `xl`,
  where the prices beside the form stick too. What's said
  before the button (a refusal, a warning) comes after the card; one
  that answers its press takes the focus as it shows, mid-screen, so
  it's in view and read out wherever the button was, a page above it in
  the header (Notice's `answers`, #534). Such a
  form has an aside, its price, and the page is the content's width; a
  form alone keeps a form's width and its button in its card (FormPage's
  type holds it).
- **Outside an area** (Welcome), a page of its own, the logo above and
  who's signed in under it on a phone, beside it from `sm` (`PageFrame`),
  centred at a form's width with no aside.

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
  nothing else on the page does (a Client's Quote, open until when), never
  the title, a crumb, a fact below (a Bill's week, #493 PR 13) or the Client
  again (each fact once: the `ui` skill); and the page's
  actions at the end of the title row, on the title's line: one split
  button, the page's next step its primary and the rest behind its arrow
  ("More actions": a menu under it from md, a sheet from a phone's foot;
  the arrow outlined while the next step waits, disabled, so one control
  doesn't show two ranks),
  or a quiet ⋯ ("More actions") when nothing is next. One action with
  nothing next stays a Button, as a menu of one would hide it; a page
  whose only action destroys has no primary, that action in the same
  place, outlined in red (`danger-outline`) (the `ui` skill); the
  destructive last in red after a rule. Short of room, the badge drops
  under the title before the button moves. From md, once the window's top
  reaches the title row's actions, a slim header sticks at the top with
  the title, the badge and the same actions (the split button, or the ⋯ or
  lone Button when nothing is next), lined up with the page's column (a
  form's width on a Form page with no aside), with room
  beside the button for what the step rests on (a Form page's price,
  below `xl`, and whether it's saved; #493 D1); a List's New stays on its row. A Record's next step is
  there on a wider screen only, and at
  the foot on a phone. Printed, it's the title alone.
  ("Layout / RecordPage / Next Step In The Header", "Nothing Next", "One Action";
  "Layout / FormPage / Priced On A Phone" for a lone destructive action,
  "Priced On A Laptop" for a Form page's next step)
- **A wide screen keeps a readable column**: the content's, AppLayout's
  `max-w-5xl` (960 px inside its margins), the width every page in an
  area reads at (a page outside one keeps `PageFrame`'s). A Record fills
  it, its header's buttons on its right edge, and a bar at the page's
  foot lines up with it too (`ActionFooter`), and so does a Form page
  with an aside, the one side column (#493 G4.4: a card stopped 376 px
  short of its button). No second, narrower cap for a Record: the user's pick
  on the Office's Job drew one column at this width. A form is narrower,
  a form's width (Forms), and a Form page with no aside is narrowed with
  it, header and all, so its buttons still line up with its card.
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
  the Office's tab bar keeps Today and the Schedule. From lg (1024) the
  sidebar lists every section. From md (768) to lg it folds to a rail, so
  a narrow laptop window keeps a laptop's ways and the page its room,
  never the phone's frame (#493): each section's icon with its name small
  under it, always shown, as a touch tablet never hovers and an icon
  alone doesn't say what it is; the current one highlighted, a rule
  between groups, and a count (the Cleaner's Offers) in its name, as in
  the sidebar.
  ("Layout / AppLayout / Phone Menu", "Rail", "Sidebar")
- **Related sections share a heading** in the sidebar and the ☰ menu
  (`NavItem.group`), the busiest first with none: the Office's Today and
  Schedule, then Work (Jobs, Quotes), People (Clients, Staff) and Pricing
  (Services, Prices). ("Layout / AppLayout / Groups")
- **The account's parts are the menu's foot**, in every area: under a
  divider at the foot of the full sidebar, and of the ☰ menu on a phone,
  one plain item each, never behind a dialog (name and email, the other
  language in the portal and the Cleaner area, Switch to, Show tips again,
  Sign out, the theme; `AppLayout`'s `foot`). So a phone's top bar is the
  ☰ and the section. The rail is the one exception (#493): it has no room
  for a line of them, and they're seldom used, so the other language
  stays on it, one press away, and the rest sit behind one Account at its
  foot, a popover holding the person (name and email) and the items, with
  no logo or area heading, as the account isn't where the brand lives.
  ("Layout / AppLayout / Phone Menu Foot", "Rail")
- **The language is changed in one press, by the other language named in
  its own words** ("Español" on an English screen, "English" on a Spanish
  one), so someone who can't read the screen's language still finds it:
  at the foot of the sidebar, on the rail, and of the ☰ menu on a phone.
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
  layout places, never a sticky bar of the page's own, which pins under the phone's tab bar (#425); a sheet's pinned Buttons are the sheet's, over the tab bar (Dialogs and rows). It holds,
  above the tab bar, a Record's next step on a phone, which a wider screen
  keeps in the header instead (`phone`; the `ui` skill), and on a phone a
  form's price and its button (the Quote Draft's Send, New quote's Draft a
  quote), which a wider screen keeps in the header too (#493 D1: Forms).
  What it sums up (prices, whether it's saved) on its left, the main action
  last, on the right. The layout test fails a button or link under a fixed bar. ("A
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
  <weekday> (nothing sent or booked is lost, and Add a weekday gives a day
  again in a tap). The Office's Turn down of a quote stays red: it closes
  the Client's quote for good on the Office's word (a move turned down
  leaves the Job as booked), where a Client's Decline is their own word on
  their own quote.
- **Continue with Google is Google's own button** (the `ui` skill: a
  third-party sign-in keeps its owner's look): their colours in light and
  dark, their logo, Roboto. Only the 44px touch height is ours.

### Notices

- **A Notice holds at most one action**, a text Button (or `ButtonLink`) on
  the right of its text, never primary, and not the page's next step,
  which is the page's primary (the `ui` skill). Two
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
  on the screen and not greyed. ("First-time help points, never pushes")
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
  work. What's done to something that opens nothing (someone on a Job's
  crew) is in the page's actions menu, named for whom ("Take Cory Cleaner
  off"): an ✕ by a face sat mid-card, where no chevron goes (#493).
  ("Rows open one dialog, two Buttons")
- **A dialog has at most two Buttons**, one filled (primary, or danger) and
  one quiet (Cancel, or an alternative like Dismiss), plus the ✕.
- **A dialog keeps its title and its Buttons in view** while what's between
  them scrolls, a sheet on a phone and centred from `sm`: its Buttons read
  after the facts, as a page's, and in reach however long the dialog, and
  its title says which dialog this is (#493). The dialog places its
  `Actions` row itself, with the ActionFooter's look, and each row draws
  its line only while something lies under it.
  ("Components/Dialog: Long Sheet")
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
- **A row's line is parts set apart by dots, each part whole where it
  fits** (the kit's `Line`): a wrap moves a whole part to the next line, and
  never leaves a dot at a line's end or start, as "Standard Clean ·" over
  "$194.89" did on a phone (#548). What belongs together is one part: a
  Service and its price ("Standard Clean $194.89"), a name and its role.
  A part after the first reads on from its dot in lower case, as a
  sentence does ("Deep Clean · about 1¾ h", models' `inLine`). A slot that
  takes only text (a `TimelineItem`'s title, an email's line) takes
  models' `lineOf`, whose dots are glued to both their neighbours, so they
  never end or start a line either, though a long part may break inside
  itself. A slot that takes more than text (a Fact's value or line, a card's
  title) takes the `Line`: with each part held whole, `lineOf`'s one text
  has nowhere to wrap, and "Apartment · 2 bedrooms · 1.5 bathrooms" ran a
  320px Quote sideways, so its words give the parts (`propertyParts`). Inside any part or sentence, a number stays with its
  word ("2 bedrooms", "1.5 bathrooms", "2 cleaners") and a clock time with
  its AM or PM, held by a no-break space where the words are made (web's
  `count`, models' time formats), so "1.5" or "9:00" never ends a line on
  its own, nor "10:00 AM" or "9:00 a.m." wraps, on every screen and in
  every email (#548, #534's UX review U19).
- **Figures sit in a column**: a list of labels and their values (a
  price's hours and Deposit, a plan clean against a one-off, a plan's
  totals, a quote's extras, "How it's worked out", a receipt) is the kit's
  `Figures`, at most 28rem wide from its card's start, each value at the
  column's end, so on a wide card a value sits near its label rather than
  across the card (the user's pick B, #548). On a phone, and in any card
  narrower than that, it's the card's width; a long label wraps inside it,
  its value staying at the end.
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
- **A form keeps a form's width, and a field its answer's** (the user,
  on #493's Welcome at 1440: "too wide for a form field to span"): a
  field far wider than its answer puts its label far from where the
  answer goes, and doesn't say what length it wants. So a form reads at
  42rem (`max-w-form`) at every screen width: a Form page with no aside,
  its header with it (in an area at the content's start, outside one
  centred), a form's dialog (`lg`), and the landing site's Quote form,
  whose band is that width. No field's box is wider, nor a
  `SegmentedControl`'s track, wherever it sits (a wide dialog, a card beside an
  aside), and from `sm` one with a short answer is sized to it by its
  longest answer (`Field.tsx`'s `width`): to about 8 characters 9rem
  (a ZIP code, a time), to about 14 13rem (a phone, by `type="tel"`; a
  day, a unit, a number, an amount), a few words 20rem (a `Select`'s
  default); each holding its longest answer whole ($100,000.00, 1,000,000
  sq ft). Fields side by side go in a `FieldRow`, no wider than a
  form, columns of 13rem or more (two to a row in a form's card, three in a
  wider one, one on a phone), so a short field's neighbour sits near it, not across a wide
  dialog; `ChoiceTiles` keep a form's width too. A date and its start time go in a
  `packed` `FieldRow`, each at its answer's width from the row's start, and
  in a dialog that moves a booked time, Pick from the schedule, which fills
  both, under them on the same left edge (a Draft quote's are behind its
  open times, Time and schedules): spread across a card's two columns, with
  the button centred under them, they broke the form's one edge (the user, on #527: "breaking
  symmetry and balance"). On a phone every field is full width, a thumb's target.
  ("A form keeps a form's width")
- **Every search field shows a magnifying glass.**

### Time and schedules

- **Schedules are calendars**: a day, three days or a week on the Schedule
  (a day at first on a phone, so its blocks have room to name their client;
  three at first on anything wider; then the span last chosen in that
  browser), a month on a
  Cleaner's availability. Jobs are timed events (start and
  duration), ready for a Google Calendar sync. A block leads with its
  client's name, wrapping where it has the height, as its place on the grid
  gives its time: the time shows under the name where there's room, and is
  read out first, as a screen reader can't see the grid. A Job's state is a
  mark beside the name (its icon from `screens/icons.ts`, in its colour; a
  Staffed Job, the usual case, has none), its words read out; a Site
  Visit's is its own icon, so it isn't told from a Staffed Job by colour
  alone; the crew's names show only when someone's on it, a name to a
  line, and a block draws only the lines that fit whole, each wrapping in a
  narrow lane rather than cut short ("Cory Cl…" names no one), and each
  time or Site visit line whole or not drawn at all; the client's name, the
  first line, always shows, cut at the block's foot when a short block can't
  hold all of it. The key draws each state as a block
  (#493 G4.1). A Job or a Site Visit dragged on the Schedule carries a picture of its block, and an outline
  its size shows where it would land, snapped as the drop is: its own
  colours, a see-through fill inside a dashed edge, red where it can't go
  (the server's rules: for a Job, hours and a crew free; for a Site Visit,
  a time not yet passed, its visitor's hours or Office Staff, a crew free,
  and busy with nothing else; both end by midnight); a day where it can go
  at no time fades. A Job drags while booked and not yet started; a Site
  Visit while booked, even once its time has passed, so a missed one moves
  to a time to come. Either move is confirmed first. ("Schedules As
  Calendars")
- **A time is picked from the times that are free**, with the day and
  time fields kept as the keyboard's way. A Draft quote's proposed time is
  picked in its part, in a tap (`office/OpenTimePicker.tsx`, #493, the
  user's pick B): a strip of a week's days, each saying why it's shut
  ("No cleaners" when no Cleaner works it, as its fix is more hours, "No
  room" when it's full), over the viewed day's start times that have room
  for the clean asked for, under its name ("Open times on Tue, Jan 6", and ", and the time picked"
  when its tile there is marked with a problem),
  those without left out; the time picked fills
  its tile with when it ends, or is marked with its problem, which a line
  over it says, naming the Service offered beside it when it's that one's
  problem, and the nearest time that has room for it too (ending by
  midnight among it), with "Pick that time"; paged off its tile, a line
  says the time picked and its problem, and "Show it" goes back to it.
  Back is off where the page before has no day to come. A plan's new weekday comes with no time, for the weekday the
  client asked for, and once dated pages through its own weekday's dates.
  The fields are behind "Type a date and time". The part folds to its time
  on load when that's set, has room and can be sent, and again so when a
  weekday's added or removed. It pages with the kit's `Stepper`, as the
  Schedule and a Cleaner's working hours do. The Office's dialogs that move a booked time (a Job, a plan's
  visit, a Site Visit) still pick on the Schedule
  (`office/SchedulePicker.tsx`, inline in a wide dialog) until #543; a
  Client picks a day on a month, then that day's open times
  (`screens/AvailabilityPicker.tsx`). Both lists of times are the kit's
  `TimeTiles`. Clients never see the Schedule or anyone else's Jobs.
- **A length of time is said as its reader needs it** (#548). The Office
  books to the minute, so it reads a length that way: "1 h 38 min", "3 h",
  "45 min" (`formatHours`), and a clean's end to the same minute ("9:00 AM
  to 10:38 AM"). A Client or a Cleaner plans their day around it, so they
  read it to the quarter hour, "About" only when that rounded it: "About
  1¾ h", "3 h" (models' `howLong`, the emails too), and "until about
  10:45 AM". Hours she types or prices at a rate aren't a length on the
  clock, so they read as she types them, decimal (`typedHours`): the
  Price list's figures, the working-out of a price, each row's running
  total too ("2.3375 h"), so it adds up against what was typed; the
  cleaning hours it comes to, on the price card and the Job ("3.25 h",
  a crew's hours together, priced at a rate), shown only for a crew of
  more than one, as a crew of one's are its time on site, said once;
  extra time on the day ("+1.5 h"); and a cleaner's working hours on their
  Staff page ("7.5 h", where she types 7.5), while the Schedule reads
  what's booked and free of them as lengths. A plan on several weekdays
  whose cleans are all alike says it once, as a one-weekday plan does;
  once they differ, its card, the Office's and the Client's, and the
  Client's quote give each kind of clean its own fact, naming its
  weekdays: "On site Mondays and Fridays, with 2 cleaners" beside "On
  site Wednesdays, with 1 cleaner", and "About 2 h, How long on Mondays".
  A "+" between them reads as a sum and leaves the reader matching days
  by position. Weekdays alike to their reader go together, so a Client
  may read one where the Office reads two ("About 2 h" for 1 h 57 min and
  2 h 3 min). So with a plan quote's price cards: the Client's weekdays
  alike in all a card draws (its Service and every figure) share one
  card, titled with each, "Mondays at 9:00 AM and Wednesdays at 1:00 PM ·
  Standard Clean", as two cards the same say each price twice; the
  Office's card per weekday stays, as each has its own hours. The Client's list of cleans leaves how long to the card
  while each runs as its weekday's there. Once one doesn't (booked
  longer, or moved to a day the card has no length for), a plan of one
  length gives every row its own, so the one that differs sits among
  neighbours alike; a plan of several lengths gives it to that clean
  alone, as its neighbours are other weekdays, unlike to compare, and
  every row's length would hide it.

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
  logo heads the ☰ menu; the sidebar holds it centred, and the rail has
  no room for it; the landing site
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
2. **Prototype it** on a `prototype-<screen>` branch off main, which has
   the kit (#502): one file of made-up data for every state, and nothing
   else to copy or wire up. Usually three layouts. Push the branch; it's
   kept as the record. It never becomes a PR, so it skips the change review
   (the `change` skill's Prototype rule).
   - **The web app:** `<screen>.prototype.tsx`, beside the screen in
     `packages/web/src/screens/`, default-exports `prototype({ layouts,
     cases })` (`screens/Prototype.tsx`), each case drawing itself for a
     layout from made-up data, in the real frames through `AreaLayout`'s
     `PrototypeFrame`. It's at `/prototype/<screen>`, signed out, with
     `?layout=&case=`.
   - **The landing site:** `src/prototypes/<screen>.ts` default-exports
     `prototype({ layouts, cases })` (`src/prototype.ts`), a Spanish case
     with `lang: "es"`, and `src/prototypes/<screen>.astro` draws one, given
     `layout` and `case`. It's at `/prototype/<screen>/`, each case a page
     of its own, a Spanish one under `/es/`.
   - **Looking at it:** `pnpm dev` draws a bar in the corner
     (`PrototypeBar`): ↑/↓ for layouts and ←/→ for cases, a link to the
     list of them all, and a fold to a small pill when it covers what's
     under it. With no case, the address is that list, a grid of every
     layout × case (`PrototypeIndex`). When another dev server may be
     running, give yours a port under 10000 with `--strictPort`: the test
     runs lease theirs from 10000 up (`packages/server/tests/ports.ts`), and
     a port already taken then fails at once rather than moving on. The
     screen-layout lint is off in a prototype, and the copies check skips
     its words.
   - **Shots:** `pnpm pr:shots --prototype <screen>` shoots every layout ×
     case at rest, with no bar, at a phone's width and each where the
     frames change (`WIDTHS` in
     `packages/server/tests/e2e/prototype-shots.ts`), and shows them case
     by case in an `index.md` (`packages/web/README.md`), for the
     `ux-reviewer` and the pick.
   - A package a prototype adds stays on its branch, as main would carry a
     dependency nothing uses, which `pnpm lint:unused` (knip) turns down;
     one the pick needs comes in with the build.
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

Steps 2 and 3 are for a new UX question: a new flow, or a new look for a
screen. Any other change (one to how a flow behaves, a wording change, one
that only applies these rules) has no prototype to pick from: its design
is reviewed before its code, as the `ui` skill's Settling a screen sizes
it, and it still gets a row in `docs/ux-log.md`.

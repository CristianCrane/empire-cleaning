# Screens

Every screen of the web app (`packages/web`), what it holds and in what
order, and how screens of a kind differ. It's the map the standard screen
layouts (#426) are built from, and what later screens are checked against.
The landing site isn't here.

- **The routes** come from `packages/web/src/router.tsx`, the one source of
  paths. This doc says what each is for.
- **The rules** each screen is meant to keep are in `docs/ux.md`, by their
  names there, with their Storybook patterns. This doc says which one each
  screen keeps, and where it departs.
- **Keep it true.** A new route, or a change to a screen's order of parts,
  updates its entry here in the same PR (`docs/ux.md`, Changing a screen).
- The owner's review copy of this map, with screenshots, is drawn from this
  file. A correction goes here first.

## Areas and sign-in

| Area | Who | Where |
|---|---|---|
| Office | Office Staff | `/office/…`, a sidebar from `lg`, a top bar and side drawer on a phone |
| Client portal | Clients | `/portal/…`, a tab bar on a phone |
| Cleaner area | Cleaners | `/cleaner/…`, a tab bar on a phone |
| Signed out | anyone | `/sign-in`, `/sign-in/link`, `/confirm-email`, `/welcome`, `/people` |

How sign-in and the areas' guards behave is in `packages/web/README.md`,
Areas and sign-in.

## How to read an entry

Each entry gives the route, the file under `packages/web/src/screens/`, the
`docs/ux.md` rule it's meant to keep (with its decisions-log row, where one
exists), then its parts top to bottom:

- **Header**: breadcrumbs, the title (h1), its status badge, the subtitle
  under it, and anything else on the title's row.
- **Actions**: where what you can do sits. The kinds:
  - *Menu*: an outlined `Actions ▾` `MenuButton` on the title's row.
  - *Header Buttons*: loose Buttons on the title's row.
  - *Section actions*: text Buttons on a Section's title line.
  - *Action cards*: a Section around a Card holding an `ActionRow` (its text,
    its Button).
  - *Footer*: `ActionFooter`, fixed at the foot above the tab bar.
  - *Notice actions*: the one action a Notice holds.
- **Notices**: the alerts above the body, in order.
- **Body**: the parts in order. *Card* is a titled `Section` around a `Card`;
  *Section* is a titled `Section` around a `List`, `Table` or other content
  with no Card.
- **History**: where what happened to the record is shown, if anywhere.
- **Departs**: where it differs from its rule or from the others of its type.
- **#424**: the owner's reports (#424) that land on this screen, by id.

## Route index

43 paths in `router.tsx`, plus two screens with no path. Three paths only
redirect and draw nothing.

| Path | Screen | File | Proposed type |
|---|---|---|---|
| `/` | redirect to the Account's area, or `/sign-in` | `router.tsx` | none |
| `/sign-in` | Sign in, by emailed link or Google (`?error=` says why a link failed, `?next=` the page after) | `SignIn.tsx` | Message page |
| `/sign-in/link` | Sign-in link | `SignInLink.tsx` | Message page |
| `/confirm-email` | Confirm email | `ConfirmEmail.tsx` | Message page |
| `/welcome` | Welcome: an Account connected to nothing requests a Quote to become a Client | `Welcome.tsx` | Form page |
| `/people` | Demo people, test site only: sign in as one (`?as=` first name, `?next=` the page after) | `PeopleScreen.tsx` | none: test tool |
| (no match) | Not found | `NotFound.tsx` | Message page |
| (an error) | Something went wrong, inside its area | `PageError.tsx` | Message page |
| `/office` | Today: Needs attention, counted and listed | `office/Dashboard.tsx` | Home |
| `/office/schedule` | Schedule: booked Jobs and free Staff hours over a range of days (`?from=&to=`) | `office/ScheduleScreen.tsx` | Calendar |
| `/office/jobs` | Jobs (`?tab=&q=`) | `office/JobsScreen.tsx` | List |
| `/office/jobs/$jobId` | Job: its crew, a move asked for, moving or cancelling it; once done, price changes and correcting it | `office/JobScreen.tsx` | Record |
| `/office/quotes` | Quotes (`?status=&q=`) | `office/QuotesScreen.tsx` | List |
| `/office/quotes/new` | New quote (`?clientId=`) | `office/NewQuoteScreen.tsx` | Form page |
| `/office/quotes/$quoteId` | Quote: its story, the Current quote, recording acceptance, the add-a-card email | `office/QuoteScreen.tsx` | Record |
| `/office/quotes/$quoteId/draft` | Draft quote: the change being written, priced afresh, sent or deleted (redirects to the Quote with no draft) | `office/QuoteScreen.tsx` | Form page |
| `/office/requests` | redirect to `/office/quotes` (ADR-0017) | `router.tsx` | none |
| `/office/requests/$requestId` | redirect to the Quote it became | `router.tsx` | none |
| `/office/clients` | Clients (`?standing=&q=`) | `office/ClientsScreen.tsx` | List |
| `/office/clients/$clientId` | Client: contact details, homes, Condition correction; for a business, weekly billing and Bills | `office/ClientDetail.tsx` | Record |
| `/office/properties/$propertyId` | Property (a home or premises) | `office/PropertyScreen.tsx` | Record |
| `/office/service-plans/$planId` | Ended cleaning plan (redirects to the Property while it runs) | `office/ServicePlanScreen.tsx` | Record |
| `/office/site-visits/$visitId` | Site visit | `office/SiteVisitScreen.tsx` | Record |
| `/office/bills/$billId` | Bill: voiding it while unpaid, recording a payment made another way | `office/BillScreen.tsx` | Record |
| `/office/staff` | Staff: everyone, and inviting someone | `office/StaffScreen.tsx` | List |
| `/office/staff/$staffId` | Staff member: their usual week, days off and extra days; deactivating them | `office/StaffMemberScreen.tsx` | Record |
| `/office/price-list` | Prices: the Price List, and the Services each extra goes with | `office/PriceListScreen.tsx` | Settings |
| `/office/services` | Services | `office/ServicesScreen.tsx` | List |
| `/office/services/new` | New service | `office/ServicesScreen.tsx` | Form page |
| `/office/services/$serviceKey` | Service | `office/ServicesScreen.tsx` | Form page |
| `/cleaner` | Your jobs: today and coming up | `cleaner/CleanerHome.tsx` | Home |
| `/cleaner/offers` | Offers | `cleaner/CleanerOffers.tsx` | List |
| `/cleaner/jobs/$jobId` | Job (theirs), where the Offer email leads: take or drop it, complete it, record no access | `cleaner/CleanerJobScreen.tsx` | Record |
| `/cleaner/open/$jobId` | Cleaner needed (a Job open to them) | `cleaner/CleanerNeededScreen.tsx` | Record |
| `/portal` | Home: what's next | `portal/PortalHome.tsx` | Home |
| `/portal/cleans` | Cleans (`?tab=`) | `portal/PortalCleans.tsx` | List |
| `/portal/payments` | Payments (`?all=`) | `portal/PortalPayments.tsx` | Home |
| `/portal/details` | Your details: contact details, homes and access instructions | `portal/PortalDetails.tsx` | Settings |
| `/portal/payment-method` | Your card: add or replace it, where the add-a-card email leads | `portal/PortalPaymentMethod.tsx` | Form page |
| `/portal/request` | Request a quote, for a new home or one of theirs | `portal/PortalRequest.tsx` | Form page |
| `/portal/jobs/$jobId` | Clean: moving or cancelling it (with what it costs), its receipt, approving a price change, paying; where those emails lead | `portal/PortalJob.tsx` | Record |
| `/portal/quotes/$quoteId` | Your quote, where its email leads: accept it in one step, or decline | `portal/PortalQuote.tsx` | Record |
| `/portal/plans/$planId` | Your plan | `portal/PortalPlan.tsx` | Record |
| `/portal/properties/$propertyId` | A home | `portal/PortalProperty.tsx` | Record |
| `/portal/bills/$billId` | Bill, where its emails lead: printing it, paying by card or bank while due | `portal/PortalBill.tsx` | Record |

40 screens have a path, and with Not found and Something went wrong that's
42. People is a test-site tool, left out of the types.

## Proposed types

Six types, each built from `docs/ux.md`'s rules by their names. Where a type
joins rules, it says which; slice 2 (#426) settles them by editing
`docs/ux.md`, not by keeping a second list here.

| Type | From `docs/ux.md` | Story | Screens |
|---|---|---|---|
| **Record** | joins "A details page: alerts, then the details, then what you can do", "When every part of a record matters at once, two columns" and "A record that moves through steps is its story" | DetailsPageStory, AllAtOnceInTwoColumnsStory, RecordsAsStoriesStory | 15 |
| **List** | "A growing work list is a Table"; "Dated things a person scans are grouped by month"; "Sections, not Cards, around Lists and Tables" | WorkListsAsTables | 7 |
| **Home** | joins "A home screen answers what's next" and "A money page answers what's owed first" | WhatsNextFirstStory, OwedFirstStory | 4 |
| **Form page** | "Forms ask quietly, a few questions at a time"; "A price beside the figures that make it" | QuietFormsInSteps | 7 |
| **Settings** | "Settings are read, then changed part by part" | none yet | 2 |
| **Message page** | "A message page"; already a layout in code, `MessagePage.tsx` | MessagePagesStory | 5 |

The Schedule keeps "Schedules are calendars" and is one of a kind (a
seventh type of one, **Calendar**).

### Record (15)

A page about one thing. The three rules it joins share their top: alerts,
then the thing. They differ in the body: one column of details then action
cards (the Client's and Cleaner's pages), two columns with History right
(the Office's Job and Property), or the whole page as a Timeline (the
Office's Quote). What every one hand-builds and differs on is the header
and where actions go (see the differences table): there is no page
component, so each of 19 files builds its own breadcrumbs, title row and
subtitle, and 20 files repeat the facts grid by hand
(`<dl className="grid gap-x-6 …">`, 24 copies).

Office: Job, Quote, Client, Property, Ended cleaning plan, Site visit, Bill,
Staff member. Client portal: Clean, Your quote, Your plan, A home, Bill.
Cleaner: Job, Cleaner needed.

### List (7)

Title in the bar, at most one primary Button for making a new one, then a
search, Tabs by status and a Table or month-grouped List. Office: Jobs,
Quotes, Clients, Staff, Services. Client portal: Cleans. Cleaner: Offers.

### Home (4)

The question the person came with, answered in one card with the page's one
primary, then what else. Office: Today. Client portal: Home, Payments.
Cleaner: Your jobs.

### Form page (7)

Breadcrumbs and a title, then the form in Sections of Cards, a sticky price
aside from `xl` where there's a price, and the save or send at its foot.
Office: New quote, Draft quote, New service, Service. Client portal:
Request a quote, Your card. Signed out: Welcome.

### Settings (2)

Facts and rows, each part changed in its own dialog. Office: Prices. Client
portal: Your details.

### Message page (5)

A narrow centred card: a large `IconTile`, the title, one line, at most one
Button, home a text link. Not found, Something went wrong, Sign-in link,
Confirm email, and Sign in (its own variant: the logo above, a form inside).

## Differences table

How the same part is done across screens of a type. "Rule" is what
`docs/ux.md` says, where it says anything.

| Part | Rule | Variants found |
|---|---|---|
| Where a Record's actions sit | none for the header; action cards after the details; Section actions as text Buttons | *Menu*: Office Job only (#406). *Header Buttons*: Office Quote (Book site visit, Turn down quote), Draft quote (Delete draft), Office Bill (Record payment, Void, Print), Client Bill (Print), Staff member (Deactivate), Client (New quote, primary). *Section actions*: Site visit (Move, Cancel), Property (Correct), Office plan (Change terms), Client (Edit contact), Staff member (Edit). *Action cards after details*: Clean (Move, Cancel), Your plan (Ask to change, End plan), Office plan (End plan), Your quote (Accept, with Decline inside). *Action cards before details*: Cleaner needed (Take it), Cleaner Job while offered (Take). *Footer*: Cleaner Job (Drop out, No access, Complete). *Hand-built sticky bar*: Draft quote (Send). *Form footer*: Service (Retire, Save) |
| Where the destructive action sits | red | Menu item (Cancel job), header text Button (Deactivate, Void, Turn down quote, Delete draft), filled danger in an action card (End plan), form footer (Retire), text Button inside an action card (Decline), Section action (Cancel site visit) |
| The page's one primary | at most one | In the header (Client: New quote; lists: New quote, Invite staff, New service), in the hero card (Client Home, Cleaner Home), in the owed card (Payments), in the footer (Cleaner Job: Complete), in a sticky bar (Draft: Send). Client Home and Payments add a secondary header Button (Request a quote, Your card) |
| Title | none | The thing's name (Client, Staff member, Service), its address (Property, A home: the street), what and where (Office Job: "Service at street"; Quote: "kind for client"), a fixed word (Site visit, Cleaning plan, Your plan, Bill N), the Service (Clean, Cleaner Job, Cleaner needed) |
| Subtitle | none | The time (Office Job), "address · summary · View property" with a link (Quote, Draft), the client (Property), "client · address" (Site visit, Ended plan), "client · week" (Office Bill), the week (Client Bill), the address (Clean, Your plan), the full address under its own street (A home), "updated · open until" (Your quote), "Version N, saved by …" (Service), none (Client, Staff member) |
| Status badge | "A status is the same colour everywhere" | After the title on most Records; two badges on the Draft ("Not sent yet") and Quote; none on Property and Client; an Avatar before the title on Staff member |
| Breadcrumbs | none | On every Record and Form page, each trail starting somewhere else: from the list (Jobs › Job; Quotes › client › home › kind; Clients › client › home), from the client with no list (client › home › Site visit, client › home › Cleaning plan), skipping the home (Clients › client › Bill), from a Client's page (Your details › street; Payments › Bill N; Home › Your quote; Your cleans › date and time), from a Cleaner's (Offers or Your jobs › day and time) |
| The details card | one card answering when, large, with an `IconTile` or `DateTile`, facts in even columns, each icon, value, muted line | Icon-led Facts (Property, Site visit, Clean, Cleaner Job, A home, Your plan); label-first `LabelledFact` with no icons (Office Job); a `dt`/`dd` list with no icons (Client); an invoice (Bills); facts columns by container width in the Office (`@md`, `@3xl`) and by screen width for Clients and Cleaners (`sm`, `lg`) |
| Two columns | from `xl` | From `lg` on Office Job and Property; one column on every other Record, Office Quote included |
| History | a `Timeline` in the right column | A Section with a Timeline and no Card (Office Job); a Section around a Card holding the Timeline (Property); the whole page a Timeline (Office Quote); none on Client, Site visit, Staff member, Office plan or any Client or Cleaner page |
| Notices | first; one action each | Office Job stacks up to seven (`WhatsNext`), and its payment-retry Notice draws a second Notice inside itself; Your details puts a warning Notice inside a Section, above its Card; Payments puts its Notices after the owed card; Draft and Quote add a plan-change Notice after `WhatsNext` |
| Title in the bar | "The heading hidden on a phone where the bar says it" | Lists, Today, Your jobs, Offers, Cleans, Payments, Your details and Prices use `inBar`; Client Home doesn't; no Record does |
| The bar at the foot | none (`ActionFooter` exists) | `ActionFooter` (Cleaner Job); a hand-built `sticky bottom-0` bar hidden behind the phone's tab bar (Draft quote, #425); an in-flow `Actions` row (Service, New service) |
| Explaining text | "Less is more" | Long Section descriptions on Prices (every Section), the Draft's parts (Proposed time, prices worked out), Office Job's Price changes, Services' intro paragraph, the Office plan's billing sentence |
| Space between parts | `gap-6` | `gap-4` on Staff and Request a quote |

## The owner's reports, placed

Each report in #424, by id, and the parts of the map it touches.

| Report | Screen | Part |
|---|---|---|
| WEB-2 | Office Job | details card: the time sits in it as a label-first fact, not large and first |
| WEB-3 | Office Job | Crew Section: a dropped-out row replaced |
| WEB-4 | Office Job | History: the Timeline wants a Card, as Property's has |
| WEB-5 | Office Job | Notices: too many; a Notice in a Notice; the plan offer before payment |
| WEB-6 | Office Job | Price changes Section into Money; less text |
| WEB-7 | every Record | where actions sit: one Menu on every Record |
| WEB-8, WEB-A | Office Quote, Draft | the Property's facts inside "What was asked" |
| WEB-9 | Draft quote | its one action (Send) in the same place as every Record's |
| WEB-B | Office Quote | the suggested-price line in the Current quote |
| WEB-C | Draft quote | the "prices worked out" text |
| WEB-D | Draft quote | Proposed time's description |
| WEB-E | Draft quote | the bar at the foot, behind the tab bar (#425) |
| WEB-F | Office Bill | the header Buttons into a Menu |
| WEB-G | Office Bill | the subtitle repeats the breadcrumbs' client |
| WEB-H | Client | the contact card's facts need icons |
| WEB-J | Property, Office plan | End plan into the plan's card; no billing sentence |
| WEB-K | Prices | too much text |

## Each screen

### Record

#### Office > Job

`/office/jobs/$jobId` · `office/JobScreen.tsx` · keeps: two columns (#146),
Actions ▾ (#406)

- Header: Jobs › Job; "Service at street" and its status; the time under it.
- Actions: Menu (Move job, Ask for a new time, Cancel job in red).
- Notices: Completed, Ended, Move asked for (answer), Cleaners needed,
  Price changes to review, Unpaid (retry, which draws its own Notice), Plan
  offer.
- Body, left: Job details (Card: label-first facts, then How it went with
  Undo); Crew (Section: List, Offer); Price changes (Section: Table); Money
  (Card).
- History: right column from `lg`, a Section with a Timeline, no Card.
- Departs: `lg` not `xl`; label-first facts; up to seven Notices; nested
  Notice.
- #424: WEB-2, WEB-3, WEB-4, WEB-5, WEB-6, WEB-7.

#### Office > Quote

`/office/quotes/$quoteId` · `office/QuoteScreen.tsx` · keeps: a record as
its story (#145)

- Header: Quotes › client › home › kind; "kind for client", status, Draft
  badge; "address · summary · View property".
- Actions: Header Buttons while unsent (Book site visit, Turn down quote).
- Notices: `WhatsNext`, then the plan-change Notice.
- Body: a Timeline, Now on top holding Current quote (Card), then each
  moment; What was asked folded (`details` around a Card).
- History: the page itself.
- Departs: header Buttons, not a Menu; one column at every width.
- #424: WEB-7, WEB-8, WEB-A, WEB-B.

#### Office > Client

`/office/clients/$clientId` · `office/ClientDetail.tsx` · keeps: title
outside the Card (#119), a fact under Contact details (#175)

- Header: Clients › name; the name; no subtitle, no status.
- Actions: Header Button (New quote, the primary); Section action (Edit).
- Body: Contact details (Card: a `dt`/`dd` list, no icons); Properties
  (Section: List); Billing (Card, a business); Bills (Section: List).
- History: none.
- Departs: no status; facts without icons; the page's primary in the header.
- #424: WEB-7, WEB-H.

#### Office > Property

`/office/properties/$propertyId` · `office/PropertyScreen.tsx` · keeps: two
columns, history right (#155)

- Header: Clients › client › address; the address; the client under it.
- Actions: Section actions (Correct details; the plan's Change terms).
- Notices: see it first (premises with no findings); new terms (open the Quote).
- Body, left: Details (Card: `IconTile`, facts); the cleaning plan (Card,
  then Ending the plan, an action card in red) or an action card to set one
  up; Site visit.
- History: right column from `lg`, a Section around a Card holding the
  Timeline.
- Departs: `lg` not `xl`; History in a Card where Job's isn't; no status.
- #424: WEB-4, WEB-7, WEB-J.

#### Office > Ended cleaning plan

`/office/service-plans/$planId` · `office/ServicePlanScreen.tsx` · keeps: a
details page

- Header: client › home › Cleaning plan; "Cleaning plan"; "client ·
  address".
- Body: Cleaning plan (Card: facts, billing sentence); Ended (Card); Jobs
  (Section: List).
- Departs: no status badge though it has Ended.

#### Office > Site visit

`/office/site-visits/$visitId` · `office/SiteVisitScreen.tsx` · keeps: one
card, findings at its foot (#156)

- Header: client › home › Site visit; "Site visit" and its status; "client ·
  address".
- Actions: Section actions (Move, Cancel); an `ActionRow` inside the card
  (Record findings).
- Notices: they've been, add what they found (warning); cancelled.
- Body: Visit details (Card: `DateTile`, facts, then what it found).
- Departs: the action row inside the details card, not its own card.
- #424: WEB-7.

#### Office > Bill

`/office/bills/$billId` · `office/BillScreen.tsx` · keeps: one card, read
like an invoice (#157)

- Header: the letterhead (print only); Clients › client › Bill; "Bill N" and
  its status; "client · week".
- Actions: Header Buttons, text (Record payment, Void, Print).
- Notices: the Client's standing.
- Body: the Bill (Card).
- #424: WEB-F, WEB-G.

#### Office > Staff member

`/office/staff/$staffId` · `office/StaffMemberScreen.tsx` · keeps: the month
as a calendar (#160)

- Header: Staff › name; an Avatar, the name, their status.
- Actions: Header Button (Deactivate, red text); Section action (Edit).
- Notices: can't sign in any more; only cleaners have working hours.
- Body: Details (Card: facts); Working hours (Card: a month calendar).
- #424: WEB-7.

#### Client portal > Clean

`/portal/jobs/$jobId` · `portal/PortalJob.tsx` · keeps: alerts, clean
details, then action cards (ux-portal)

- Header: Your cleans › date and time; the Service and its status; the
  address.
- Notices: Unpaid (pay), price change to approve.
- Body: Details (Card: `DateTile`, facts; then cancelled, no access or the
  receipt); Move (action card); Cancel (action card).

#### Client portal > Your quote

`/portal/quotes/$quoteId` · `portal/PortalQuote.tsx` · keeps: read like a
Quote, paying under it (#165)

- Header: Home › Your quote; the title and its status; "address · updated ·
  open until".
- Notices: the Client's standing.
- Body: the Quote (Card); Accept (action card, Decline a text Button in it).

#### Client portal > Your plan

`/portal/plans/$planId` · `portal/PortalPlan.tsx` · keeps: headline, then
facts across (ux-portal)

- Header: Your details › street › Your plan; "Your plan" and its status; the
  address.
- Notices: on hold.
- Body: Details (Card); Upcoming (Section: List); Ask to change (action
  card); Ending (action card, red).

#### Client portal > A home

`/portal/properties/$propertyId` · `portal/PortalProperty.tsx` · keeps: a
list of homes, each with its own page (ux-portal)

- Header: Your details › street; the street and its standing; the full
  address.
- Actions: Section action (Edit access).
- Body: Details (Card); Plans (Section: List, or an action card); Quotes
  (Section: List).
- Departs: the subtitle repeats the title's street.

#### Client portal > Bill

`/portal/bills/$billId` · `portal/PortalBill.tsx` · keeps: one card, read
like an invoice (#157)

- Header: letterhead; Payments › Bill N; "Bill N" and its status; the week.
- Actions: Header Button (Print, text).
- Notices: standing.
- Body: Pay (Section, while due); the Bill (Card).
- Departs: paying before the bill, where Your quote puts it after.

#### Cleaner > Job

`/cleaner/jobs/$jobId` · `cleaner/CleanerJobScreen.tsx` · keeps: the
details page, actions in a bar at the foot (ux-cleaner)

- Header: Offers or Your jobs › day and time; the Service and its status.
- Actions: Footer (Drop out, No access, Complete); while offered, an action
  card first (Take).
- Notices: release closed.
- Body: Take (action card, while offered); Completed or No access; Details
  (Card).
- Departs: the only Record with a Footer; no subtitle.

#### Cleaner > Cleaner needed

`/cleaner/open/$jobId` · `cleaner/CleanerNeededScreen.tsx` · keeps: Cleaner
needed (#148)

- Header: Offers › date and time; the Service and an Open badge.
- Body: Take it (action card, first); Details (Card).
- Departs: the action before the details.

### List

#### Office > Jobs

`/office/jobs` · `office/JobsScreen.tsx` · keeps: Table + Tabs (#146)

- Header: "Jobs" in the bar; no action.
- Body: search; Tabs Upcoming · Past · Cancelled · All; Table; Show more.
- Empty: the Table's empty row.

#### Office > Quotes

`/office/quotes` · `office/QuotesScreen.tsx` · keeps: Table + filters (#109)

- Header: "Quotes" in the bar; New quote (primary).
- Body: search; Tabs by status; Table.

#### Office > Clients

`/office/clients` · `office/ClientsScreen.tsx` · keeps: Table + status Tabs
(#117)

- Header: "Clients" in the bar; no action.
- Body: search (focused on load); Tabs; Table; Show more.

#### Office > Staff

`/office/staff` · `office/StaffScreen.tsx` · keeps: a Section's List (#160)

- Header: "Staff" in the bar; Invite staff (primary, a dialog).
- Body: List.
- Departs: `gap-4`; a List, no search or Tabs.

#### Office > Services

`/office/services` · `office/ServicesScreen.tsx` · keeps: a work list

- Header: "Services" in the bar; New service (primary); an intro paragraph.
- Body: Table; Retired (Section, Show or Hide).
- Departs: the intro paragraph under the title.

#### Client portal > Cleans

`/portal/cleans` · `portal/PortalCleans.tsx` · keeps: Tabs, by month, date
tiles (ux-portal)

- Header: "Your cleans" in the bar.
- Body: Tabs Upcoming · Past; month headings; Lists with `DateTile`s;
  `EmptyState`; Show more.

#### Cleaner > Offers

`/cleaner/offers` · `cleaner/CleanerOffers.tsx` · keeps: only theirs
(ux-cleaner)

- Header: "Offers" in the bar.
- Body: Offered to you (Section: List); Open to you (Section: List);
  `EmptyState`.

### Home

#### Office > Today

`/office` · `office/Dashboard.tsx` · keeps: action first, count tiles that
filter (#94, ux-office-today)

- Header: "Today" in the bar.
- Body: Needs attention (Section: `CountTiles`, then a List of to-do rows,
  each led by what to do).
- Departs: no one card, no primary; it's a to-do list more than a home.

#### Client portal > Home

`/portal` · `portal/PortalHome.tsx` · keeps: what's next, date tile,
shortcut tiles (ux-portal)

- Header: "Hi, name", not in the bar; Request a quote (secondary).
- Notices: warnings, then info.
- Body: the next clean (a Card with `DateTile` and the primary); a line on
  what's after; `ShortcutTiles`.
- Departs: the only area home whose title isn't in the bar.

#### Client portal > Payments

`/portal/payments` · `portal/PortalPayments.tsx` · keeps: what you owe
first, latest few then See all, fixed header Button (ux-portal)

- Header: "Payments" in the bar; Your card (secondary).
- Body: what you owe (Card: `IconTile`, the primary); Notices of payments
  clearing; History (Section: List, Statement, See all).
- Departs: Notices after the card, not first.

#### Cleaner > Your jobs

`/cleaner` · `cleaner/CleanerHome.tsx` · keeps: next up large, then coming
up (ux-cleaner)

- Header: "Your jobs" in the bar.
- Body: Next up (Card: `DateTile`, Open job, the primary) or `EmptyState`;
  Coming up (Section: List); Done today (Section: List).

### Form page

#### Office > New quote

`/office/quotes/new` · `office/NewQuoteScreen.tsx` · keeps: one page, the
price beside it (#164)

- Header: Quotes › New quote; the title; a subtitle.
- Body: Find the client (Section: List), then the Quote form, with the
  price so far in a sticky aside from `xl`.

#### Office > Draft quote

`/office/quotes/$quoteId/draft` · `office/QuoteScreen.tsx` · keeps: a Draft
page of its own (#145)

- Header: …› Draft quote; "Draft quote for client" and "Not sent yet";
  "address · summary · View property".
- Actions: Header Button (Delete draft); a hand-built sticky bar (the price,
  save state, Send to client, the primary).
- Notices: `WhatsNext`; first clean note.
- Body: What was asked (open); the draft (one Card: Plan, weekdays, Service
  and prices, Area, Extras, Terms, Proposed time).
- Departs: the bar isn't `ActionFooter` and hides behind the tab bar.
- #424: WEB-8, WEB-A, WEB-9, WEB-C, WEB-D, WEB-E.

#### Office > Service, New service

`/office/services/$serviceKey`, `/office/services/new` ·
`office/ServicesScreen.tsx` · keeps: one form, its example a worked-out
Quote (#163)

- Header: Services › name; the name, Retired badge; "Version N, saved by …".
- Body: What it is, How long it takes, Price, Booking, Sales tax (Cards);
  the example Quote in a sticky aside from `xl`.
- Actions: a form footer in the flow (Retire in red, Save).
- Departs: Retire in the form's footer, where Records keep theirs in the
  header.

#### Client portal > Request a quote

`/portal/request` · `portal/PortalRequest.tsx` · keeps: steps, quiet choices
(#114)

- Header: breadcrumbs; the title.
- Notices: info.
- Body: the Quote form in a Card.
- Departs: `gap-4`.

#### Client portal > Your card

`/portal/payment-method` · `portal/PortalPaymentMethod.tsx` · keeps: on the
Payment Method page (ux-portal)

- Header: breadcrumbs; the title; what it's for.
- Notices: the card failed (Try again), or saved, or info.
- Body: the card form (Section).

#### Welcome

`/welcome` · `Welcome.tsx` · keeps: in steps, what's next beside (#168)

- Its own page: the logo and Sign out, a Card of steps, a Notice.

### Settings

#### Office > Prices

`/office/price-list` · `office/PriceListScreen.tsx` · keeps: read, change a
part in a dialog (#161)

- Header: "Prices" in the bar; the version and a link.
- Notices: a placeholder.
- Body: Extras (Section: List); Types of business (Section: List);
  Condition, Quote defaults, Sales tax on fees (Cards of facts, each Edit in
  a dialog).
- Departs: every Section carries a long description.
- #424: WEB-K.

#### Client portal > Your details

`/portal/details` · `portal/PortalDetails.tsx` · keeps: a list of homes;
read, then Edit (ux-portal)

- Header: "Your details" in the bar.
- Body: Contact (Section action Edit; a warning Notice, then a Card of
  facts); Your homes (Section: List).
- Departs: a Notice inside a Section.

### Message page

`MessagePage.tsx` draws Not found, Something went wrong (Try again),
Sign-in link (Sign in) and Confirm email (three states). Sign in
(`SignIn.tsx`) is its own page in the same shape: the logo above a narrow
card holding the title, a warning Notice (`?error=`), Continue with Google
and the email form.

### Calendar

#### Office > Schedule

`/office/schedule` · `office/ScheduleScreen.tsx` · keeps: three days at
first, then the span last chosen (ux-office-today)

- Header: "Schedule" in the bar.
- Body: the range bar; a legend of badges; the calendar.

# Screens

Every screen of the web app (`packages/web`), and what it holds in what
order. It's the map the standard screen layouts (#426) are built from, and
what later screens are checked against. The landing site isn't here.

- **The routes** come from `packages/web/src/router.tsx`, the one source of
  paths. The Route index says what each is for, its file and its type.
- **The rules** each screen is meant to keep are in `docs/ux.md`, by their
  names there. Each entry says which one.
- **Keep it true.** A new route adds its row to the Route index and its entry
  under Each screen; a change to a screen's parts or their order changes its
  entry (`docs/ux.md`, Changing a screen). Each fact is in one place: the
  index holds path, file and type, the entry holds the parts.
- **For slice 2** holds this map's first findings: the proposed types, how
  screens of a type differ and where the owner's reports land. It's input to
  slice 2 (#426), and goes once slice 2 settles the types in `docs/ux.md`;
  keeping the map true doesn't include it.
- The owner's review copy of this map, with screenshots, is drawn from this
  file. A correction goes here first.

## Areas

| Area          | Who                                                 | Where        |
| ------------- | --------------------------------------------------- | ------------ |
| Office        | Office Staff                                        | `/office/…`  |
| Client portal | Clients                                             | `/portal/…`  |
| Cleaner area  | Cleaners                                            | `/cleaner/…` |
| Signed in     | an Account connected to nothing                     | `/welcome`   |
| Signed out    | anyone                                              | `/sign-in`, `/sign-in/link`, `/confirm-email`, `/people` |

Every area has the same frame (`packages/ui/src/AppLayout.tsx`): a sidebar
from `md`; under `md`, a top bar with ☰ and a drawer, and a tab bar at the
foot. How sign-in and the areas' guards behave is in `packages/web/README.md`,
Areas and sign-in.

## How to read an entry

Each entry gives the `docs/ux.md` rule the screen is meant to keep (with its
decisions-log row, where one exists), then its parts top to bottom:

- **Header**: breadcrumbs, the title (h1), its status badge, the subtitle
  under it, and anything else on the title's row.
- **Actions**: where what you can do sits. The kinds:
  - _Menu_: an outlined `Actions ▾` `MenuButton` on the title's row.
  - _Header Buttons_: loose Buttons on the title's row.
  - _Section actions_: text Buttons on a Section's title line.
  - _Action cards_: a Section around a Card holding an `ActionRow` (its text,
    its Button).
  - _Footer_: `ActionFooter`, fixed at the foot above the tab bar.
- **Notices**: the alerts above the body, in order.
- **Body**: the parts in order. _Card_ is a titled `Section` around a `Card`;
  _Section_ is a titled `Section` around a `List`, `Table` or other content
  with no Card.
- **History**: where what happened to the record is shown, if anywhere.

## Route index

"Screen" names the entry under Each screen. Three paths only redirect and
draw nothing; Not found and Something went wrong have no path.

| Path                             | Screen                          | For                                                                                                      | File                              | Type         |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------ |
| `/`                              | none                            | redirects to the Account's area, or `/sign-in`                                                           | `router.tsx`                      | none         |
| `/sign-in`                       | Sign in                         | sign in by emailed link or Google (`?error=` says why a link failed, `?next=` the page after)           | `SignIn.tsx`                      | Message page |
| `/sign-in/link`                  | Message pages                   | the emailed link's page, whose one Button signs in                                                      | `SignInLink.tsx`                  | Message page |
| `/confirm-email`                 | Message pages                   | confirming a new email address                                                                           | `ConfirmEmail.tsx`                | Message page |
| (no match)                       | Message pages                   | Not found                                                                                                | `NotFound.tsx`                    | Message page |
| (an error)                       | Message pages                   | Something went wrong, inside its area                                                                    | `PageError.tsx`                   | Message page |
| `/welcome`                       | Welcome                         | an Account connected to nothing requests a Quote to become a Client                                      | `Welcome.tsx`                     | Form page    |
| `/people`                        | People                          | test site only: sign in as a demo person (`?as=` first name, `?next=` the page after)                    | `PeopleScreen.tsx`                | none         |
| `/office`                        | Office > Today                  | Needs attention, counted and listed                                                                      | `office/Dashboard.tsx`            | Home         |
| `/office/schedule`               | Office > Schedule               | booked Jobs and free Staff hours over a range of days (`?from=&to=`)                                     | `office/ScheduleScreen.tsx`       | Calendar     |
| `/office/jobs`                   | Office > Jobs                   | every Job (`?tab=&q=&shown=`)                                                                            | `office/JobsScreen.tsx`           | List         |
| `/office/jobs/$jobId`            | Office > Job                    | its crew, a move asked for, moving or cancelling it; once done, price changes and correcting it          | `office/JobScreen.tsx`            | Record       |
| `/office/quotes`                 | Office > Quotes                 | every Quote (`?status=&q=`)                                                                              | `office/QuotesScreen.tsx`         | List         |
| `/office/quotes/new`             | Office > New quote              | a Quote taken on the phone (`?clientId=`)                                                                | `office/NewQuoteScreen.tsx`       | Form page    |
| `/office/quotes/$quoteId`        | Office > Quote                  | its story, the Current quote, recording acceptance, the add-a-card email                                 | `office/QuoteScreen.tsx`          | Record       |
| `/office/quotes/$quoteId/draft`  | Office > Draft quote            | the change being written, priced afresh, sent or deleted (redirects to the Quote with no draft)          | `office/QuoteScreen.tsx`          | Form page    |
| `/office/requests`               | none                            | redirects to `/office/quotes` (ADR-0017)                                                                 | `router.tsx`                      | none         |
| `/office/requests/$requestId`    | none                            | redirects to the Quote it became                                                                         | `router.tsx`                      | none         |
| `/office/clients`                | Office > Clients                | every Client (`?tab=&q=&shown=`)                                                                         | `office/ClientsScreen.tsx`        | List         |
| `/office/clients/$clientId`      | Office > Client                 | contact details, homes, Condition correction; for a business, weekly billing and Bills                   | `office/ClientDetail.tsx`         | Record       |
| `/office/properties/$propertyId` | Office > Property               | a home or premises: its details, its cleaning plan, its Site Visit, its history                          | `office/PropertyScreen.tsx`       | Record       |
| `/office/service-plans/$planId`  | Office > Ended cleaning plan    | a plan that has Ended (redirects to the Property while it runs)                                          | `office/ServicePlanScreen.tsx`    | Record       |
| `/office/site-visits/$visitId`   | Office > Site visit             | moving or cancelling it, recording what it found                                                         | `office/SiteVisitScreen.tsx`      | Record       |
| `/office/bills/$billId`          | Office > Bill                   | voiding it while unpaid, recording a payment made another way                                            | `office/BillScreen.tsx`           | Record       |
| `/office/staff`                  | Office > Staff                  | everyone, and inviting someone                                                                           | `office/StaffScreen.tsx`          | List         |
| `/office/staff/$staffId`         | Office > Staff member           | their usual week, days off and extra days; deactivating them                                             | `office/StaffMemberScreen.tsx`    | Record       |
| `/office/price-list`             | Office > Prices                 | the Price List, and the Services each extra goes with                                                    | `office/PriceListScreen.tsx`      | Settings     |
| `/office/services`               | Office > Services               | every Service, retired ones folded                                                                       | `office/ServicesScreen.tsx`       | List         |
| `/office/services/new`           | Office > Service, New service   | a new Service                                                                                            | `office/ServicesScreen.tsx`       | Form page    |
| `/office/services/$serviceKey`   | Office > Service, New service   | a Service's figures, with a worked example                                                               | `office/ServicesScreen.tsx`       | Form page    |
| `/cleaner`                       | Cleaner > Your jobs             | today and coming up                                                                                      | `cleaner/CleanerHome.tsx`         | Home         |
| `/cleaner/offers`                | Cleaner > Offers                | Jobs offered or open to them                                                                             | `cleaner/CleanerOffers.tsx`       | List         |
| `/cleaner/jobs/$jobId`           | Cleaner > Job                   | a Job they're on, where the Offer email leads: take or drop it, complete it, record no access            | `cleaner/CleanerJobScreen.tsx`    | Record       |
| `/cleaner/open/$jobId`           | Cleaner > Cleaner needed        | a Job open to them, to take                                                                              | `cleaner/CleanerNeededScreen.tsx` | Record       |
| `/portal`                        | Client portal > Home            | what's next                                                                                              | `portal/PortalHome.tsx`           | Home         |
| `/portal/cleans`                 | Client portal > Cleans          | upcoming and past cleans (`?tab=`)                                                                       | `portal/PortalCleans.tsx`         | List         |
| `/portal/payments`               | Client portal > Payments        | what's owed, then what was paid (`?all=`)                                                                | `portal/PortalPayments.tsx`       | Home         |
| `/portal/details`                | Client portal > Your details    | contact details and homes                                                                                | `portal/PortalDetails.tsx`        | Settings     |
| `/portal/payment-method`         | Client portal > Your card       | add or replace it, where the add-a-card email leads                                                      | `portal/PortalPaymentMethod.tsx`  | Form page    |
| `/portal/request`                | Client portal > Request a quote | for a new home or one of theirs                                                                          | `portal/PortalRequest.tsx`        | Form page    |
| `/portal/jobs/$jobId`            | Client portal > Clean           | moving or cancelling it (with what it costs), its receipt, approving a price change, paying; where those emails lead | `portal/PortalJob.tsx` | Record |
| `/portal/quotes/$quoteId`        | Client portal > Your quote      | where its email leads: accept it in one step, or decline                                                 | `portal/PortalQuote.tsx`          | Record       |
| `/portal/plans/$planId`          | Client portal > Your plan       | its terms, what's coming, asking to change or ending it                                                  | `portal/PortalPlan.tsx`           | Record       |
| `/portal/properties/$propertyId` | Client portal > A home          | its details and access, its plans and quotes                                                             | `portal/PortalProperty.tsx`       | Record       |
| `/portal/bills/$billId`          | Client portal > Bill            | where its emails lead: printing it, paying by card or bank while due                                     | `portal/PortalBill.tsx`           | Record       |

## Each screen

### Office

#### Office > Today

Keeps: action first, count tiles that filter (#94, ux-office-today).

- Header: "Today" in the bar.
- Body: Needs attention (Section: `CountTiles`, then a List of to-do rows,
  each led by what to do).

#### Office > Schedule

Keeps: schedules are calendars; three days at first, then the span last
chosen (ux-office-today).

- Header: "Schedule" in the bar.
- Body: the range bar; a legend of badges; the calendar.

#### Office > Jobs

Keeps: Table + Tabs (#146).

- Header: "Jobs" in the bar.
- Body: search; Tabs Upcoming · Past · Cancelled · All; Table; Show more.

#### Office > Job

Keeps: two columns (#146), Actions ▾ (#406).

- Header: Jobs › Job; "Service at street" and its status; the time under it.
- Actions: Menu (Move job, Ask for a new time, Cancel job in red).
- Notices: Completed, Ended, Move asked for (answer), Cleaners needed, Price
  changes to review, Unpaid (retry, which draws its own Notice), Plan offer.
- Body, left: Job details (Card: label-first facts with icons, then How it
  went with Undo); Crew (Section: List, Offer); Price changes (Section:
  Table); Money (Card).
- History: the right column from `lg`, a Section with a Timeline, no Card.

#### Office > Quotes

Keeps: Table + filters (#109).

- Header: "Quotes" in the bar; New quote (primary).
- Body: search; Tabs by status; Table.

#### Office > New quote

Keeps: one page, the price beside it (#164).

- Header: Quotes › New quote; the title; a subtitle.
- Body: Find the client (Section: List), then the Quote form, with the price
  so far in a sticky aside from `xl`.

#### Office > Quote

Keeps: a record as its story (#145).

- Header: Quotes › client › home › kind; "kind for client", its status, and
  a second badge while a change is being drafted; "address · summary · View
  property".
- Actions: Header Buttons while unsent (Book site visit, Turn down quote).
- Notices: `WhatsNext`, then the plan-change Notice.
- Body: a Timeline, Now on top holding Current quote (Card), then each
  moment; What was asked folded (`details` around a Card).
- History: the page itself.

#### Office > Draft quote

Keeps: a Draft page of its own (#145).

- Header: … › Draft quote; "Draft quote for client" and "Not sent yet";
  "address · summary · View property".
- Actions: Header Button (Delete draft); a hand-built sticky bar (the price,
  save state, Send to client, the primary).
- Notices: the client still sees the quote as sent (once it's been sent);
  the plan-change Notice.
- Body: What was asked (open); the first clean (folded); the draft (one Card:
  Plan, weekdays, Service and prices, Area, Extras, Terms, Proposed time).

#### Office > Clients

Keeps: Table + status Tabs (#117).

- Header: "Clients" in the bar.
- Body: search (focused on load); Tabs; Table; Show more.

#### Office > Client

Keeps: title outside the Card (#119), a fact under Contact details (#175).

- Header: Clients › name; the name.
- Actions: Header Button (New quote, the primary); Section actions (Edit
  contact details, Edit billing).
- Body: Contact details (Card: a `dt`/`dd` list, no icons); Properties
  (Section: List); Billing (Card, a business); Bills (Section: List).

#### Office > Property

Keeps: two columns, history right (#155).

- Header: Clients › client › address; the address; the client under it.
- Actions: Section actions (Correct details; the plan's Change terms).
- Notices: see it first (premises with no findings); new terms (open the
  Quote).
- Body, left: Home details (Card: `IconTile`, facts); the cleaning plan
  (Card, with its billing sentence), then Ending the plan (an action card in
  red), or an action card to set one up; Site visit.
- History: the right column from `lg`, a Section around a Card holding the
  Timeline.

#### Office > Ended cleaning plan

Keeps: a details page.

- Header: client › home › Cleaning plan; "Cleaning plan"; "client · address".
- Body: Cleaning plan (Card: its Ended badge, facts, billing sentence); Ended
  (Card); Jobs (Section: List).

#### Office > Site visit

Keeps: one card, findings at its foot (#156).

- Header: client › home › Site visit; "Site visit" and its status; "client ·
  address".
- Actions: Section actions (Move, Cancel); an `ActionRow` inside the card
  (Record findings).
- Notices: they've been, add what they found (warning); cancelled.
- Body: Visit details (Card: `DateTile`, facts, then what it found).

#### Office > Bill

Keeps: one card, read like an invoice (#157).

- Header: the letterhead (print only); Clients › client › Bill; "Bill N" and
  its status; "client · week".
- Actions: Header Buttons, text (Record payment, Void, Print).
- Notices: the Client's standing.
- Body: the Bill (Card).

#### Office > Staff

Keeps: a Section's List (#160).

- Header: "Staff" in the bar; Invite staff (primary, a dialog).
- Body: List.

#### Office > Staff member

Keeps: the month as a calendar (#160).

- Header: Staff › name; an Avatar, the name, their status.
- Actions: Header Button (Deactivate, red text); Section actions (Edit; Edit
  usual week).
- Notices: can't sign in any more; only cleaners have working hours.
- Body: Details (Card: facts); Working hours (Card: a month calendar).

#### Office > Prices

Keeps: read, change a part in a dialog (#161).

- Header: "Prices" in the bar; the version and a link.
- Notices: a placeholder.
- Body: Extras (Section: List); Types of business (Section: List);
  Condition, Quote defaults, Sales tax on fees (Cards of facts, each Edit in a
  dialog). Every Section has a long description.

#### Office > Services

Keeps: a work list.

- Header: "Services" in the bar; New service (primary); an intro paragraph.
- Body: Table; Retired (Section, Show or Hide).

#### Office > Service, New service

Keeps: one form, its example a worked-out Quote (#163).

- Header: Services › name; the name, Retired badge; "Version N, saved by …".
- Body: What it is, How long it takes, Price, Booking, Sales tax (Cards); the
  example Quote in a sticky aside from `xl`.
- Actions: a form footer in the flow (Retire in red, Save).

### Cleaner area

#### Cleaner > Your jobs

Keeps: next up large, then coming up (ux-cleaner).

- Header: "Your jobs" in the bar.
- Body: Next up (Card: `DateTile`, Open job, the primary) or `EmptyState`;
  Coming up (Section: List); Done today (Section: List).

#### Cleaner > Offers

Keeps: only theirs (ux-cleaner).

- Header: "Offers" in the bar.
- Body: Offered to you (Section: List); Open to you (Section: List);
  `EmptyState`.

#### Cleaner > Job

Keeps: the details page, actions in a bar at the foot (ux-cleaner).

- Header: Offers or Your jobs › day and time; the Service and its status.
- Actions: while offered, an action card first (Take); once theirs, a Footer
  (Drop out, No access, Complete).
- Notices: not everyone has confirmed (warning); too late to drop out.
- Body: Take (action card, while offered); Completed or No access; Details
  (Card).

#### Cleaner > Cleaner needed

Keeps: Cleaner needed (#148).

- Header: Offers › date and time; the Service and an Open badge.
- Body: Take it (action card, first); Details (Card).

### Client portal

#### Client portal > Home

Keeps: what's next, date tile, shortcut tiles (ux-portal).

- Header: "Hi, name", not in the bar; Request a quote (secondary).
- Notices: warnings, then info.
- Body: the next clean (a Card with `DateTile` and the primary); a line on
  what's after; `ShortcutTiles`.

#### Client portal > Cleans

Keeps: Tabs, by month, date tiles (ux-portal).

- Header: "Your cleans" in the bar.
- Body: Tabs Upcoming · Past; month headings; Lists with `DateTile`s;
  `EmptyState`; Show more.

#### Client portal > Payments

Keeps: what you owe first, latest few then See all, fixed header Button
(ux-portal).

- Header: "Payments" in the bar; Your card (secondary).
- Body: what you owe (Card: `IconTile`, the primary); Notices of payments
  clearing; History (Section: List, Statement, See all).

#### Client portal > Your details

Keeps: a list of homes; read, then Edit (ux-portal).

- Header: "Your details" in the bar.
- Body: Contact details (Section action Edit; a warning Notice, then a Card
  of facts); Your homes (Section: List).

#### Client portal > Your card

Keeps: on the Payment Method page (ux-portal).

- Header: Payments › Your card; the title; what it's for.
- Notices: the card failed (Try again), or saved, or info.
- Body: the card form (Section).

#### Client portal > Request a quote

Keeps: steps, quiet choices (#114).

- Header: Home › Request a quote; the title.
- Notices: info.
- Body: the Quote form in a Card.

#### Client portal > Clean

Keeps: alerts, clean details, then action cards (ux-portal).

- Header: Your cleans › date and time; the Service and its status; the
  address.
- Notices: Unpaid (pay), price change to approve.
- Body: Details (Card: `DateTile`, facts; then cancelled, no access or the
  receipt); Move (action card); Cancel (action card).

#### Client portal > Your quote

Keeps: read like a Quote, paying under it (#165).

- Header: Home › Your quote; the title and its status; "address · updated ·
  open until".
- Notices: the Client's standing.
- Body: the Quote (Card); Accept (action card, Decline a text Button in it).

#### Client portal > Your plan

Keeps: headline, then facts across (ux-portal).

- Header: Your details › street › Your plan; "Your plan" and its status; the
  address.
- Notices: on hold.
- Body: Details (Card); Upcoming (Section: List); Ask to change (action
  card); Ending (action card, red).

#### Client portal > A home

Keeps: a list of homes, each with its own page (ux-portal).

- Header: Your details › street; the street and its standing; the full
  address.
- Actions: Section action (Edit access).
- Body: Details (Card); Plans (Section: List, or an action card); Quotes
  (Section: List).

#### Client portal > Bill

Keeps: one card, read like an invoice (#157).

- Header: letterhead; Payments › Bill N; "Bill N" and its status; the week.
- Actions: Header Button (Print, text).
- Notices: standing.
- Body: Pay (Section, while due); the Bill (Card).

### Signed out and signed in

#### Sign in

Keeps: Google first (#168).

- Its own page: the logo above a narrow card holding the title, a warning
  Notice (`?error=`), Continue with Google and the email form.

#### Message pages

Keeps: a message page; centred, home a link (#168); one Button that does it
(sign-in-button).

- `MessagePage.tsx`: a narrow centred card, a large `IconTile`, the title,
  one line, at most one Button, home a text link. Not found; Something went
  wrong (Try again); Sign-in link (Sign in); Confirm email (three states).

#### Welcome

Keeps: in steps, what's next beside (#168).

- Its own page, no breadcrumbs: the logo and Sign out, a Card of steps, a
  Notice.

#### People

Keeps: a page of the demo people, test site only (ux-switch-person).

- A list of people to sign in as, and a form for anyone else.

## For slice 2

This map's first findings (#427), the input to slice 2 (#426). They go once
slice 2 settles the types in `docs/ux.md`; keeping the map true doesn't
include them. Counts are as of the map's first commit.

### Proposed types

Each built from `docs/ux.md`'s rules by their names. Where a type joins
rules, or moves a screen out of a rule that names it, it says so; slice 2
settles them by editing `docs/ux.md`, not by keeping a second list here.

| Type             | From `docs/ux.md`                                                                                                                                                                  | Story                                                                         | Screens |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| **Record**       | joins "A details page: alerts, then the details, then what you can do", "When every part of a record matters at once, two columns" and "A record that moves through steps is its story" | DetailsPageStory, AllAtOnceInTwoColumnsStory, RecordsAsStoriesStory           | 15      |
| **List**         | "A growing work list is a Table"; "Dated things a person scans are grouped by month"; "Sections, not Cards, around Lists and Tables"                                                | WorkListsAsTables, SectionsNotCardsAroundLists                                | 7       |
| **Home**         | joins "A home screen answers what's next" and "A money page answers what's owed first"; Today keeps "Lead a to-do row with what to do"                                             | WhatsNextFirstStory, OwedFirstStory, ActionFirstToDoRows                      | 4       |
| **Form page**    | "Forms ask quietly, a few questions at a time"; "A price beside the figures that make it"; takes Service out of "Settings are read, then changed part by part", which names it      | QuietFormsInSteps                                                             | 7       |
| **Settings**     | "Settings are read, then changed part by part", less Service (to Form page) and Staff (its member's page to Record), which it names                                                | none yet                                                                      | 2       |
| **Message page** | "A message page"; already a layout in code, `MessagePage.tsx`                                                                                                                      | MessagePagesStory                                                             | 5       |
| **Calendar**     | "Schedules are calendars"                                                                                                                                                          | SchedulesAsCalendars                                                          | 1       |

#### Record

A page about one thing. The three rules it joins share their top: alerts,
then the thing. They differ in the body: one column of details then action
cards (the Client's and Cleaner's pages), two columns with History right
(the Office's Job and Property), or the whole page as a Timeline (the
Office's Quote). What every one hand-builds and differs on is the header and
where actions go: there is no page component, so each of 19 files builds its
own breadcrumbs, title row and subtitle, and 20 files repeat the facts grid
by hand (`<dl className="grid gap-x-6 …">`, 24 copies).

Office: Job, Quote, Client, Property, Ended cleaning plan, Site visit, Bill,
Staff member. Client portal: Clean, Your quote, Your plan, A home, Bill.
Cleaner: Job, Cleaner needed.

#### List

Title in the bar, at most one primary Button for making a new one, then a
search, Tabs by status and a Table or month-grouped List. Office: Jobs,
Quotes, Clients, Staff, Services. Client portal: Cleans. Cleaner: Offers.

#### Home

The question the person came with, answered in one card with the page's one
primary, then what else. Office: Today. Client portal: Home, Payments.
Cleaner: Your jobs.

#### Form page

Breadcrumbs and a title, then the form in Sections of Cards, a sticky price
aside from `xl` where there's a price, and the save or send at its foot.
Office: New quote, Draft quote, New service, Service. Client portal: Request
a quote, Your card. Signed in: Welcome.

#### Settings

Facts and rows, each part changed in its own dialog. Office: Prices. Client
portal: Your details.

#### Message page

A narrow centred card: a large `IconTile`, the title, one line, at most one
Button, home a text link. Not found, Something went wrong, Sign-in link,
Confirm email, and Sign in (its own variant: the logo above, a form inside).

#### Calendar

The Schedule, one of a kind.

### Differences table

How the same part is done across screens of a type. "Rule" is what
`docs/ux.md` says, where it says anything.

| Part | Rule | Variants found |
| --- | --- | --- |
| Where a Record's actions sit | none for the header; action cards after the details; Section actions as text Buttons | _Menu_: Office Job only (#406). _Header Buttons_: Office Quote (Book site visit, Turn down quote), Draft quote (Delete draft), Office Bill (Record payment, Void, Print), Client Bill (Print), Staff member (Deactivate), Client (New quote, primary). _Section actions_: Site visit (Move, Cancel), Property (Correct), Office plan (Change terms), Client (Edit contact details, Edit billing), Staff member (Edit, Edit usual week). _Inside the details card_: Site visit (Record findings). _Action cards after details_: Clean (Move, Cancel), Your plan (Ask to change, End plan), Office plan (End plan), Your quote (Accept, with Decline inside). _Before the details_: Cleaner needed (Take it), Cleaner Job while offered (Take), Client Bill (Pay). _Footer_: Cleaner Job (Drop out, No access, Complete). _Hand-built sticky bar_: Draft quote (Send). _Form footer_: Service (Retire, Save) |
| Where the destructive action sits | red | Menu item (Cancel job), header text Button (Deactivate, Void, Turn down quote, Delete draft), filled danger in an action card (End plan), form footer (Retire), text Button inside an action card (Decline), Section action (Cancel site visit) |
| The page's one primary | at most one | In the header (Client: New quote; lists: New quote, Invite staff, New service), in the hero card (Client Home, Cleaner Home), in the owed card (Payments), in the footer (Cleaner Job: Complete), in a sticky bar (Draft: Send); none on Today. Client Home and Payments add a secondary header Button (Request a quote, Your card) |
| A Home's answer | one card | One card (Client Home, Cleaner Home, Payments); `CountTiles` and a to-do List (Today) |
| A List's body | a Table, Tabs and a search | Table, Tabs, search (Jobs, Quotes, Clients); Table alone (Services); a List alone (Staff); Lists by month under Tabs (Cleans); two Sections of Lists (Offers) |
| Title | none | The thing's name (Client, Staff member, Service), its address (Property, A home: the street), what and where (Office Job: "Service at street"; Quote: "kind for client"), a fixed word (Site visit, Cleaning plan, Your plan, Bill N), the Service (Clean, Cleaner Job, Cleaner needed) |
| Subtitle | none | The time (Office Job), "address · summary · View property" with a link (Quote, Draft), the client (Property), "client · address" (Site visit, Ended plan), "client · week" (Office Bill, the client also in its breadcrumbs), the week (Client Bill), the address (Clean, Your plan), the full address under its own street (A home), "updated · open until" (Your quote), "Version N, saved by …" (Service), none (Client, Staff member, Cleaner Job, Cleaner needed) |
| Status badge | "A status is the same colour everywhere" | After the title on most Records; a second badge on the Quote while a change is drafted; "Not sent yet" on the Draft; none on Property and Client; on the Ended plan only inside its card; an Avatar before the title on Staff member |
| Breadcrumbs | none | On every Record and Form page but Welcome, each trail starting somewhere else: from the list (Jobs › Job; Quotes › client › home › kind; Clients › client › home), from the client with no list (client › home › Site visit, client › home › Cleaning plan), skipping the home (Clients › client › Bill), from a Client's page (Your details › street; Payments › Bill N; Home › Your quote; Your cleans › date and time), from a Cleaner's (Offers or Your jobs › day and time) |
| The details card | one card answering when, large, with an `IconTile` or `DateTile`, facts in even columns, each icon, value, muted line | Icon-led Facts (Property, Site visit, Clean, Cleaner Job, A home, Your plan); label-first `LabelledFact`, icon then label then value (Office Job); a `dt`/`dd` list with no icons (Client); an invoice (Bills). The facts' columns follow the card's width (`@md`, `@3xl`: the Office, Your plan, Your quote, the Client's Bill), the screen's (`sm`, `lg`: Clean, A home, Cleaner Job; `sm`, `xl`: Your details) or `sm` alone (Cleaner needed) |
| Two columns | from `xl` | From `lg` on Office Job and Property; one column on every other Record, Office Quote included |
| History | a `Timeline` in the right column | A Section with a Timeline and no Card (Office Job); a Section around a Card holding the Timeline (Property); the whole page a Timeline (Office Quote); none on Client, Site visit, Staff member, Office plan or any Client or Cleaner page |
| Notices | first; one action each | Office Job stacks up to seven (`WhatsNext`), and its payment-retry Notice draws a second Notice inside itself; Your details puts a warning Notice inside a Section, above its Card; Payments puts its Notices after the owed card; the Quote adds a plan-change Notice after `WhatsNext` |
| Title in the bar | "The heading hidden on a phone where the bar says it" | Lists, Today, Schedule, Your jobs, Offers, Cleans, Payments, Your details and Prices use `inBar`; Client Home doesn't; no Record does |
| The bar at the foot | none (`ActionFooter` exists) | `ActionFooter` (Cleaner Job); a hand-built `sticky bottom-0` bar hidden behind the phone's tab bar (Draft quote, #425); an in-flow `Actions` row (Service, New service) |
| Explaining text | "Less is more" | Long Section descriptions on Prices (every Section), the Draft's parts (Proposed time, prices worked out), Office Job's Price changes, Services' intro paragraph, the Office plan's billing sentence |
| Space between parts | none | `gap-6` on most; `gap-4` on Staff, Schedule and Request a quote; `gap-8` on Today |

### The owner's reports, placed

Each report in #424, by id, and the part it touches.

| Report       | Screen                 | Part                                                                           |
| ------------ | ---------------------- | ------------------------------------------------------------------------------ |
| WEB-2        | Office Job             | details card: the time sits in it as a label-first fact, not large and first   |
| WEB-3        | Office Job             | Crew Section: a dropped-out row replaced                                       |
| WEB-4        | Office Job             | History: the Timeline wants a Card, as Property's has                          |
| WEB-5        | Office Job             | Notices: too many; a Notice in a Notice; the plan offer before payment         |
| WEB-6        | Office Job             | Price changes Section into Money; less text                                    |
| WEB-7        | every Record           | where actions sit: one Menu on every Record                                    |
| WEB-8, WEB-A | Office Quote, Draft    | the Property's facts inside "What was asked"                                   |
| WEB-9        | Draft quote            | its one action (Send) in the same place as every Record's                      |
| WEB-B        | Office Quote           | the suggested-price line in the Current quote                                  |
| WEB-C        | Draft quote            | the "prices worked out" text                                                   |
| WEB-D        | Draft quote            | Proposed time's description                                                    |
| WEB-E        | Draft quote            | the bar at the foot, behind the tab bar (#425)                                 |
| WEB-F        | Office Bill            | the header Buttons into a Menu                                                 |
| WEB-G        | Office Bill            | the subtitle repeats the breadcrumbs' client                                   |
| WEB-H        | Client                 | the contact card's facts need icons                                            |
| WEB-J        | Property, Office plan  | End plan into the plan's card; no billing sentence                             |
| WEB-K        | Prices                 | too much text                                                                  |

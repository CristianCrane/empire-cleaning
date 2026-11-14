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
- **Types**: each screen's is in the Route index, one of `docs/ux.md`'s
  Screen types, and it renders through that type's layout (ADR-0031).
  People, on the test site alone, has none.
- **For the layout slices** holds this map's first findings that the
  layouts still settle: how screens of a type differ, and where the owner's
  reports land. It goes once every type has its layout (#437); keeping the
  map true doesn't include it.
- The owner's review copy of this map, with screenshots, is drawn from this
  file. A correction goes here first.

## Areas

| Area          | Who                             | Where                                                    |
| ------------- | ------------------------------- | -------------------------------------------------------- |
| Office        | Office Staff                    | `/office/…`                                              |
| Client portal | Clients                         | `/portal/…`                                              |
| Cleaner area  | Cleaners                        | `/cleaner/…`                                             |
| Signed in     | an Account connected to nothing | `/welcome`                                               |
| Signed out    | anyone                          | `/sign-in`, `/sign-in/link`, `/confirm-email`, `/people` |

The Office, Client portal and Cleaner area share one frame
(`packages/ui/src/layouts/AppLayout.tsx`): a sidebar
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
- **Notices**: the alerts above the body, in order. **Alerts**: a Record's,
  as `RecordPage` draws them (two shown, the most pressing first).
- **Body**: the parts in order. _Card_ is a titled `Section` around a `Card`;
  _Section_ is a titled `Section` around a `List`, `Table` or other content
  with no Card.
- **History**: where what happened to the record is shown, if anywhere.

## Route index

"Screen" names the entry under Each screen. Some paths only
redirect (Screen: none); Not found and Something went wrong have no path.

| Path                             | Screen                          | For                                                                                                                  | File                              | Type         |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------ |
| `/`                              | none                            | redirects to the Account's area, or `/sign-in`                                                                       | `router.tsx`                      | none         |
| `/sign-in`                       | Sign in                         | sign in by emailed link or Google (`?error=` says why a link failed, `?next=` the page after)                        | `SignIn.tsx`                      | Message page |
| `/sign-in/link`                  | Message pages                   | the emailed link's page, whose one Button signs in                                                                   | `SignInLink.tsx`                  | Message page |
| `/confirm-email`                 | Message pages                   | confirming a new email address                                                                                       | `ConfirmEmail.tsx`                | Message page |
| (no match)                       | Message pages                   | Not found                                                                                                            | `NotFound.tsx`                    | Message page |
| (an error)                       | Message pages                   | Something went wrong, inside its area                                                                                | `PageError.tsx`                   | Message page |
| `/welcome`                       | Welcome                         | an Account connected to nothing requests a Quote to become a Client                                                  | `Welcome.tsx`                     | Form page    |
| `/people`                        | People                          | test site only: sign in as a demo person (`?as=` first name, `?next=` the page after)                                | `PeopleScreen.tsx`                | none         |
| `/office`                        | Office > Today                  | Needs attention, counted and listed                                                                                  | `office/Dashboard.tsx`            | Home         |
| `/office/schedule`               | Office > Schedule               | booked Jobs and free Staff hours over a range of days (`?from=&to=`)                                                 | `office/ScheduleScreen.tsx`       | Calendar     |
| `/office/jobs`                   | Office > Jobs                   | every Job (`?tab=&q=&shown=`)                                                                                        | `office/JobsScreen.tsx`           | List         |
| `/office/jobs/$jobId`            | Office > Job                    | its crew, a move asked for, moving or cancelling it; once done, price changes and correcting it                      | `office/JobScreen.tsx`            | Record       |
| `/office/quotes`                 | Office > Quotes                 | every Quote (`?tab=&q=`)                                                                                             | `office/QuotesScreen.tsx`         | List         |
| `/office/quotes/new`             | Office > New quote              | a Quote taken on the phone (`?clientId=`)                                                                            | `office/NewQuoteScreen.tsx`       | Form page    |
| `/office/quotes/$quoteId`        | Office > Quote                  | its story, the Current quote, recording acceptance, the add-a-card email                                             | `office/QuoteScreen.tsx`          | Record       |
| `/office/quotes/$quoteId/draft`  | Office > Draft quote            | the change being written, priced afresh, sent or deleted (redirects to the Quote with no draft)                      | `office/QuoteScreen.tsx`          | Form page    |
| `/office/requests`               | none                            | redirects to `/office/quotes` (ADR-0017)                                                                             | `router.tsx`                      | none         |
| `/office/requests/$requestId`    | none                            | redirects to the Quote it became                                                                                     | `router.tsx`                      | none         |
| `/office/clients`                | Office > Clients                | every Client (`?tab=&q=&shown=`)                                                                                     | `office/ClientsScreen.tsx`        | List         |
| `/office/clients/$clientId`      | Office > Client                 | contact details, homes, Condition correction; for a business, weekly billing and Bills                               | `office/ClientDetail.tsx`         | Record       |
| `/office/properties/$propertyId` | Office > Property               | a home or premises: its details, its cleaning plan, its Site Visit, its history                                      | `office/PropertyScreen.tsx`       | Record       |
| `/office/service-plans/$planId`  | Office > Ended cleaning plan    | a plan that has Ended (redirects to the Property while it runs)                                                      | `office/ServicePlanScreen.tsx`    | Record       |
| `/office/site-visits/$visitId`   | Office > Site visit             | moving or cancelling it, recording what it found                                                                     | `office/SiteVisitScreen.tsx`      | Record       |
| `/office/bills/$billId`          | Office > Bill                   | voiding it while unpaid, recording a payment made another way                                                        | `office/BillScreen.tsx`           | Record       |
| `/office/staff`                  | Office > Staff                  | everyone, and inviting someone (`?tab=`)                                                                             | `office/StaffScreen.tsx`          | List         |
| `/office/staff/$staffId`         | Office > Staff member           | their usual week, days off and extra days; deactivating them                                                         | `office/StaffMemberScreen.tsx`    | Record       |
| `/office/price-list`             | Office > Prices                 | the Price List, and the Services each extra goes with                                                                | `office/PriceListScreen.tsx`      | Settings     |
| `/office/services`               | Office > Services               | every Service, retired ones on a Tab (`?tab=`)                                                                       | `office/ServicesScreen.tsx`       | List         |
| `/office/services/new`           | Office > Service, New service   | a new Service                                                                                                        | `office/ServicesScreen.tsx`       | Form page    |
| `/office/services/$serviceKey`   | Office > Service, New service   | a Service's figures, with a worked example                                                                           | `office/ServicesScreen.tsx`       | Form page    |
| `/cleaner`                       | Cleaner > Your jobs             | today and coming up                                                                                                  | `cleaner/CleanerHome.tsx`         | Home         |
| `/cleaner/offers`                | Cleaner > Offers                | Jobs offered or open to them (`?tab=`)                                                                               | `cleaner/CleanerOffers.tsx`       | List         |
| `/cleaner/jobs/$jobId`           | Cleaner > Job                   | a Job they're on, where the Offer email leads: take or drop it, complete it, record no access                        | `cleaner/CleanerJobScreen.tsx`    | Record       |
| `/cleaner/open/$jobId`           | Cleaner > Cleaner needed        | a Job open to them, to take                                                                                          | `cleaner/CleanerNeededScreen.tsx` | Record       |
| `/portal`                        | Client portal > Home            | what's next                                                                                                          | `portal/PortalHome.tsx`           | Home         |
| `/portal/cleans`                 | Client portal > Cleans          | upcoming and past cleans (`?tab=`)                                                                                   | `portal/PortalCleans.tsx`         | List         |
| `/portal/payments`               | Client portal > Payments        | what's owed, then what was paid (`?all=`)                                                                            | `portal/PortalPayments.tsx`       | Home         |
| `/portal/details`                | Client portal > Your details    | contact details and homes                                                                                            | `portal/PortalDetails.tsx`        | Settings     |
| `/portal/payment-method`         | Client portal > Your card       | add or replace it, where the add-a-card email leads                                                                  | `portal/PortalPaymentMethod.tsx`  | Form page    |
| `/portal/request`                | Client portal > Request a quote | for a new home or one of theirs                                                                                      | `portal/PortalRequest.tsx`        | Form page    |
| `/portal/jobs/$jobId`            | Client portal > Clean           | moving or cancelling it (with what it costs), its receipt, approving a price change, paying; where those emails lead | `portal/PortalJob.tsx`            | Record       |
| `/portal/quotes/$quoteId`        | Client portal > Your quote      | where its email leads: accept it in one step, or decline                                                             | `portal/PortalQuote.tsx`          | Record       |
| `/portal/plans/$planId`          | Client portal > Your plan       | its terms, what's coming, asking to change or ending it                                                              | `portal/PortalPlan.tsx`           | Record       |
| `/portal/properties/$propertyId` | Client portal > A home          | its details and access, its plans and quotes                                                                         | `portal/PortalProperty.tsx`       | Record       |
| `/portal/bills/$billId`          | Client portal > Bill            | where its emails lead: printing it, paying by card or bank while due                                                 | `portal/PortalBill.tsx`           | Record       |

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

Keeps: Table + Tabs (#146). Renders through `ListPage` (#433).

- Header: "Jobs" in the bar; on a phone, the search's icon.
- Body: Tabs Upcoming · Past · Cancelled, the search at the end of their
  line from md; by month: a Table from md, dated rows on a phone, a badge
  only for Needs cleaners; Show more (N left).

#### Office > Job

Keeps: Actions ▾ (#406). Renders through `RecordPage` (#432).

- Header: Jobs › Job; "Service at street" and its status.
- Actions: Menu (Move job, Ask for a new time, Mark not done once done;
  Cancel job in red).
- Alerts: Ended, Move asked for (answer), Cleaners needed (offer), Price
  changes to review, Unpaid (retry; a failed retry is a Toast), Plan offer
  (once the First Clean is paid); two shown.
- Body: Job details (`DetailsCard`: `DateTile`, the time large, icon facts);
  How it went; Crew (Section: List, those on it only); Money (Card: its
  facts, price changes, How it's worked out folded).
- History: a Card, on the right from `xl`, at the foot below; a drop-out is
  told here.

#### Office > Quotes

Keeps: Table + filters (#109). Renders through `ListPage` (#433).

- Header: "Quotes" in the bar; on a phone, the search's icon; New quote
  (primary).
- Body: Tabs Requested · Draft · Sent · Expired, the search at the end of
  their line from md; a sortable Table from md, rows on a phone; Show more
  (N left).

#### Office > New quote

Keeps: one page, the price beside it (#164).

- Header: Quotes › New quote; the title; a subtitle.
- Body: Find the client (Section: List), then the Quote form, with the price
  so far in a sticky aside from `xl`.

#### Office > Quote

Keeps: a record as its story (#145). Renders through `RecordPage` (#432).

- Header: Quotes › client › home › kind; "kind for client", its status, and
  a second badge while a change is being drafted.
- Actions: Menu while unsent (Book a site visit; Turn down in red).
- Alerts: what's next (`alertsFor`), the plan change.
- Body: a Timeline, Now on top holding Current quote (Card), then each
  moment; What was asked folded (`Fold`), the home's facts in it.
- History: the page itself.

#### Office > Draft quote

Keeps: a Draft page of its own (#145). A Form page; its layout comes with
the Form slice.

- Header: … › Draft quote; "Draft quote for client" and "Not sent yet".
- Actions: Header Button (Delete draft); an `ActionFooter` (the price, save
  state, Send).
- Notices: the client still sees the quote as sent (once it's been sent);
  the plan change.
- Body: What was asked (open, the home's facts in it); the first clean
  (folded); the draft (one Card: Plan, weekdays, Service and prices, Area,
  Extras, Terms, Proposed time).

#### Office > Clients

Keeps: Table + status Tabs (#117). Renders through `ListPage` (#433).

- Header: "Clients" in the bar; on a phone, the search's icon.
- Body: Tabs Active · Quoting · Past, the search at the end of their line
  from md; a Table from md, rows on a phone; Show more (N left).

#### Office > Client

Keeps: title outside the Card (#119). Renders through `RecordPage` (#432).

- Header: Clients › name; the name.
- Actions: Menu (New quote, Edit contact details).
- Body: Contact details (`DetailsCard`: icon facts); Properties (Section:
  List); Billing (Card, a business; its Edit on its title line); Bills
  (Section: List).

#### Office > Property

Keeps: two columns, history right (#155). Renders through `RecordPage` (#432).

- Header: Clients › client › address; the address.
- Actions: Menu (New quote, Correct details).
- Alerts: on hold, see it first (premises with no findings), rooms missing,
  new terms (open the Quote).
- Body: Home details (`DetailsCard`: `IconTile`, icon facts); Cleaning plan
  (Section: Change terms and End plan in red on its title line, the plan's
  card), or an `ActionRow` to set one up; Site visit.
- History: a Card, on the right from `xl`, at the foot below.

#### Office > Ended cleaning plan

Keeps: the Record. Renders through `RecordPage` (#432).

- Header: Clients › client › home › Cleaning plan; "Cleaning plan" and its
  Ended badge.
- Actions: none once Ended; opened from Today while it runs, Menu (Change
  terms; End plan in red).
- Body: the plan (`DetailsCard`); visits waiting; Jobs (Section: List).

#### Office > Site visit

Keeps: the Record; findings are part of the visit (#156). Renders through `RecordPage` (#432).

- Header: Clients › client › home › Site visit; "Site visit" and its status.
- Actions: Menu while booked (Move or change; Cancel visit in red).
- Alerts: they've been, add what they found (warning); cancelled.
- Body: Visit details (`DetailsCard`: `DateTile`, icon facts); What it found
  (an `ActionRow` to record it while booked, its facts once done).

#### Office > Bill

Keeps: one card, read like an invoice (#157). Renders through `RecordPage` (#432).

- Header: the letterhead (print only, before the layout); Clients › client ›
  Bill N; "Bill N" and its status; the week.
- Actions: Menu (Record a payment, Print; Cancel bill in red).
- Alerts: the Client's standing.
- Body: the Bill (`DetailsCard`: what it comes to, icon facts, the lines).

#### Office > Staff

Keeps: a List, no Card (#160). Renders through `ListPage` (#433).

- Header: "Staff" in the bar; Invite staff (primary, a dialog).
- Body: Tabs Active · Deactivated (`?tab=`); a Table from md, rows on a
  phone, a badge only for Invited.

#### Office > Staff member

Keeps: the month as a calendar (#160). Renders through `RecordPage` (#432).

- Header: Staff › name; the name and their status.
- Actions: Menu (Edit details; Deactivate in red).
- Alerts: can't sign in any more; only cleaners have working hours.
- Body: Details (`DetailsCard`: the Avatar, roles, email, icon facts);
  Working hours (Card: a month calendar, Edit usual week on its title line).

#### Office > Prices

Keeps: read, change a part in a dialog (#161).

- Header: "Prices" in the bar; the version and a link.
- Notices: a placeholder.
- Body: Extras (Section: List); Types of business (Section: List);
  Condition, Quote defaults, Sales tax on fees (Cards of facts, each Edit in a
  dialog). Every Section has a long description.

#### Office > Services

Keeps: a work list. Renders through `ListPage` (#433).

- Header: "Services" in the bar; New service (primary).
- Body: Tabs Offered · Retired (`?tab=`); a Table from md, rows on a phone.

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

Keeps: only theirs (ux-cleaner). Renders through `ListPage` (#433).

- Header: "Offers" in the bar.
- Body: Tabs Offered to you · Open to you (`?tab=`); by month, dated rows
  led by the postcode; with nothing in either, one quiet line.

#### Cleaner > Job

Keeps: the Record, Complete in a bar at the foot (ux-cleaner). Renders through `RecordPage` (#432).

- Header: Offers or Your jobs › day and time; the Service and its status.
- Actions: once theirs, Menu or one Button (No access; Drop out of this job
  in red, before it starts); a Footer (Complete).
- Alerts: not everyone has confirmed (warning); too late to drop out.
- Body: Job details (`DetailsCard`: the time large, the address and
  directions, how we get in and the rest as icon facts); while offered, Take
  (Confirm, and Not for me beside it); Completed or No access.

#### Cleaner > Cleaner needed

Keeps: Cleaner needed (#148). Renders through `RecordPage` (#432).

- Header: Offers › date and time; the Service and an Open badge.
- Body: Job details (`DetailsCard`); Can you take it? (Confirm, Not for me).

### Client portal

#### Client portal > Home

Keeps: what's next, date tile, shortcut tiles (ux-portal).

- Header: "Hi, name", not in the bar; Request a quote (secondary).
- Notices: warnings, then info.
- Body: the next clean (a Card with `DateTile` and the primary); a line on
  what's after; `ShortcutTiles`.

#### Client portal > Cleans

Keeps: Tabs, by month, date tiles (ux-portal). Renders through `ListPage`
(#433).

- Header: "Your cleans" in the bar.
- Body: Tabs Upcoming · Past; by month, dated rows led by the kind of clean
  (the home too, for a Client with more than one); with nothing in either,
  one quiet line; Show more (N left).

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
- Notices: the card failed (Try again, its problem a Toast), or saved, or
  info.
- Body: the card form (Section).

#### Client portal > Request a quote

Keeps: steps, quiet choices (#114).

- Header: Home › Request a quote; the title.
- Notices: info.
- Body: the Quote form in a Card.

#### Client portal > Clean

Keeps: the Record (ux-portal). Renders through `RecordPage` (#432).

- Header: Your cleans › date and time; the Service and its status.
- Actions: while booked, Menu (Pick a new time; Skip or Cancel in red, its
  dialog saying what it costs); once cancelled, a Button to the plan or to
  request a quote.
- Alerts: Unpaid (pay), price change to review, a move asked for (withdraw)
  or turned down.
- Body: Details (`DetailsCard`: the time large, the address, icon facts, and
  while it's still free, until when it's free to move or cancel);
  cancelled, no access or the receipt.

#### Client portal > Your quote

Keeps: read like a Quote, paying under it (#165). Renders through `RecordPage` (#432).

- Header: Home › Your quote; the title and its status; "updated · open
  until", while it applies.
- Alerts: how it ended (accepted, declined, expired), what it does to the
  plan, booked up (decline).
- Body: Quote details (`DetailsCard`: what it comes to, icon facts); Accept
  (Decline beside it). While it's being prepared: what they asked for.

#### Client portal > Your plan

Keeps: headline, then facts across (ux-portal). Renders through `RecordPage` (#432).

- Header: Your details › street › Your plan; "Your plan" and its status.
- Actions: Menu (Ask to change; End plan in red).
- Alerts: on hold.
- Body: the plan (`DetailsCard`); Upcoming (Section: List).

#### Client portal > A home

Keeps: a list of homes, each with its own page (ux-portal). Renders through `RecordPage` (#432).

- Header: Your details › street; the street and its standing.
- Actions: one Button (Edit how we get in).
- Body: Details (`DetailsCard`: the full address, icon facts); Plans
  (Section: List, or an `ActionRow`); Quotes (Section: List).

#### Client portal > Bill

Keeps: one card, read like an invoice (#157). Renders through `RecordPage` (#432).

- Header: letterhead; Payments › Bill N; "Bill N" and its status; the week.
- Actions: one Button (Print).
- Alerts: standing.
- Body: Pay (Section, while due); the Bill (`DetailsCard`).

### Signed out and signed in

#### Sign in

Keeps: Google first (#168).

- `SignInPage`: the logo above a narrow card holding the title, a warning
  Notice (`?error=`), Continue with Google and the email form.

#### Message pages

Keeps: a message page; centred, home a link (#168); one Button that does it
(sign-in-button).

- `MessagePage`: a narrow centred card, a large `IconTile`, the title,
  one line, at most one Button, home a text link. Not found; Something went
  wrong (Try again); Sign-in link (Sign in); Confirm email (three states).

#### Welcome

Keeps: in steps, what's next beside (#168).

- Its own page, no breadcrumbs: the logo and Sign out, a Card of steps, a
  Notice.

#### People

Keeps: a page of the demo people, test site only (ux-switch-person).

- A list of people to sign in as, and a form for anyone else.

## For the layout slices

This map's first findings (#427) that the layout slices (#432 to #437)
still settle; the types they came with are `docs/ux.md`'s Screen types.
They go once every type has its layout (#437); keeping the map true doesn't
include them. Counts are as of the map's first commit.

### Differences table

How the same part is done across screens of a type. "Rule" is what
`docs/ux.md` says, where it says anything.

| Part                              | Rule                                                                                                                  | Variants found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where a Record's actions sit      | none for the header; action cards after the details; Section actions as text Buttons                                  | _Menu_: Office Job only (#406). _Header Buttons_: Office Quote (Book site visit, Turn down quote), Draft quote (Delete draft), Office Bill (Record payment, Void, Print), Client Bill (Print), Staff member (Deactivate), Client (New quote, primary). _Section actions_: Site visit (Move, Cancel), Property (Correct), Office plan (Change terms), Client (Edit contact details, Edit billing), Staff member (Edit, Edit usual week). _Inside the details card_: Site visit (Record findings). _Action cards after details_: Clean (Move, Cancel), Your plan (Ask to change, End plan), Office plan (End plan), Your quote (Accept, with Decline inside). _Before the details_: Cleaner needed (Take it), Cleaner Job while offered (Take), Client Bill (Pay). _Footer_: Cleaner Job (Drop out, No access, Complete). _Hand-built sticky bar_: Draft quote (Send). _Form footer_: Service (Retire, Save) |
| Where the destructive action sits | red                                                                                                                   | Menu item (Cancel job), header text Button (Deactivate, Void, Turn down quote, Delete draft), filled danger in an action card (End plan), form footer (Retire), text Button inside an action card (Decline), Section action (Cancel site visit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| The page's one primary            | at most one                                                                                                           | In the header (Client: New quote; lists: New quote, Invite staff, New service), in the hero card (Client Home, Cleaner Home), in the owed card (Payments), in the footer (Cleaner Job: Complete), in a sticky bar (Draft: Send); none on Today. Client Home and Payments add a secondary header Button (Request a quote, Your card)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A Home's answer                   | one card                                                                                                              | One card (Client Home, Cleaner Home, Payments); `CountTiles` and a to-do List (Today)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A List's body                     | a Table, Tabs and a search                                                                                            | Table, Tabs, search (Jobs, Quotes, Clients); Table alone (Services); a List alone (Staff); Lists by month under Tabs (Cleans); two Sections of Lists (Offers)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Title                             | none                                                                                                                  | The thing's name (Client, Staff member, Service), its address (Property, A home: the street), what and where (Office Job: "Service at street"; Quote: "kind for client"), a fixed word (Site visit, Cleaning plan, Your plan, Bill N), the Service (Clean, Cleaner Job, Cleaner needed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Subtitle                          | none                                                                                                                  | The time (Office Job), "address · summary · View property" with a link (Quote, Draft), the client (Property), "client · address" (Site visit, Ended plan), "client · week" (Office Bill, the client also in its breadcrumbs), the week (Client Bill), the address (Clean, Your plan), the full address under its own street (A home), "updated · open until" (Your quote), "Version N, saved by …" (Service), none (Client, Staff member, Cleaner Job, Cleaner needed)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Status badge                      | "A status is the same colour everywhere"                                                                              | After the title on most Records; a second badge on the Quote while a change is drafted; "Not sent yet" on the Draft; none on Property and Client; on the Ended plan only inside its card; an Avatar before the title on Staff member                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Breadcrumbs                       | none                                                                                                                  | On every Record and Form page but Welcome, each trail starting somewhere else: from the list (Jobs › Job; Quotes › client › home › kind; Clients › client › home), from the client with no list (client › home › Site visit, client › home › Cleaning plan), skipping the home (Clients › client › Bill), from a Client's page (Your details › street; Payments › Bill N; Home › Your quote; Your cleans › date and time), from a Cleaner's (Offers or Your jobs › day and time)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The details card                  | one card answering when, large, with an `IconTile` or `DateTile`, facts in even columns, each icon, value, muted line | Icon-led Facts (Property, Site visit, Clean, Cleaner Job, A home, Your plan); label-first `LabelledFact`, icon then label then value (Office Job); a `dt`/`dd` list with no icons (Client); an invoice (Bills). The facts' columns follow the card's width (`@md`, `@3xl`: the Office, Your plan, Your quote, the Client's Bill), the screen's (`sm`, `lg`: Clean, A home, Cleaner Job; `sm`, `xl`: Your details) or `sm` alone (Cleaner needed)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Two columns                       | from `xl`                                                                                                             | From `lg` on Office Job and Property; one column on every other Record, Office Quote included                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| History                           | a `Timeline` in the right column                                                                                      | A Section with a Timeline and no Card (Office Job); a Section around a Card holding the Timeline (Property); the whole page a Timeline (Office Quote); none on Client, Site visit, Staff member, Office plan or any Client or Cleaner page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Notices                           | first; one action each                                                                                                | Office Job stacks up to seven (`WhatsNext`), and its payment-retry Notice draws a second Notice inside itself; Your details puts a warning Notice inside a Section, above its Card; Payments puts its Notices after the owed card; the Quote adds a plan-change Notice after `WhatsNext`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Title in the bar                  | "A section is named once on a phone"                                                                                  | Lists, Today, Schedule, Your jobs, Offers, Cleans, Payments, Your details and Prices use `inBar`; Client Home doesn't; no Record does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| The bar at the foot               | "A bar at the foot of a page is an `ActionFooter`"                                                                    | `ActionFooter` (Cleaner Job); a hand-built `sticky bottom-0` bar hidden behind the phone's tab bar (Draft quote, #425); an in-flow `Actions` row (Service, New service)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Explaining text                   | "Few words"                                                                                                           | Long Section descriptions on Prices (every Section), the Draft's parts (Proposed time, prices worked out), Office Job's Price changes, Services' intro paragraph, the Office plan's billing sentence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Space between parts               | none                                                                                                                  | `gap-6` on most; `gap-4` on Staff, Schedule and Request a quote; `gap-8` on Today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### The owner's reports, placed

Each report in #424, by id, and the part it touches.

| Report       | Screen                | Part                                                                         |
| ------------ | --------------------- | ---------------------------------------------------------------------------- |
| WEB-2        | Office Job            | details card: the time sits in it as a label-first fact, not large and first |
| WEB-3        | Office Job            | Crew Section: a dropped-out row replaced                                     |
| WEB-4        | Office Job            | History: the Timeline wants a Card, as Property's has                        |
| WEB-5        | Office Job            | Notices: too many; a Notice in a Notice; the plan offer before payment       |
| WEB-6        | Office Job            | Price changes Section into Money; less text                                  |
| WEB-7        | every Record          | where actions sit: one Menu on every Record                                  |
| WEB-8, WEB-A | Office Quote, Draft   | the Property's facts inside "What was asked"                                 |
| WEB-9        | Draft quote           | its one action (Send) in the same place as every Record's                    |
| WEB-B        | Office Quote          | the suggested-price line in the Current quote                                |
| WEB-C        | Draft quote           | the "prices worked out" text                                                 |
| WEB-D        | Draft quote           | Proposed time's description                                                  |
| WEB-E        | Draft quote           | the bar at the foot, behind the tab bar (#425)                               |
| WEB-F        | Office Bill           | the header Buttons into a Menu                                               |
| WEB-G        | Office Bill           | the subtitle repeats the breadcrumbs' client                                 |
| WEB-H        | Client                | the contact card's facts need icons                                          |
| WEB-J        | Property, Office plan | End plan into the plan's card; no billing sentence                           |
| WEB-K        | Prices                | too much text                                                                |

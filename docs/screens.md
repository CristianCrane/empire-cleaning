# Screens

Every screen of the web app (`packages/web`), and what it holds in what
order. It's the map the standard screen layouts (#426) are built from, and
what later screens are checked against. The landing site isn't here.

- **The routes** come from `packages/web/src/router.tsx`, the one source of
  paths. The Route index says what each is for, its file and its type.
- **The rules** each screen is meant to keep are in `docs/ux.md`, by their
  names there. Each entry says which one.
- **Keep it true**, as `docs/ux.md`'s Changing a screen says. Each fact is
  in one place: the index holds path, file and type, the entry holds the
  parts.
- **Types**: each screen's is in the Route index, one of `docs/ux.md`'s
  Screen types, and it renders through that type's layout (ADR-0031).
  People, on the test site alone, has none.
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
from `lg`, folded to a rail of named icons from `md`; under `md`, a top bar with ☰
and a drawer, and a tab bar at the foot. While the next page takes a moment to load, a bar runs across the top
and the page on show fades (`docs/ux.md`, Navigation). How sign-in and the areas' guards behave is in `packages/web/README.md`,
Areas and sign-in.

## How to read an entry

Each entry gives the `docs/ux.md` rule the screen is meant to keep (with its
row in `docs/ux-log.md`, where one exists), then its parts top to bottom:

- **Header**: breadcrumbs, the title (h1), its status badge, the subtitle
  under it, and anything else on the title's row.
- **Actions**: where what you can do sits. The kinds:
  - _Split button_: the page's next step, filled, on the title's row, the
    rest behind its arrow ("More actions"); from md it sticks at the top
    once the window's top reaches it, and on a phone a Record's is pinned
    at the foot.
  - _Menu_: a quiet ⋯ ("More actions") on the title's row, when nothing is
    next and there are two or more; it sticks from md as the split button
    does.
  - _Header Buttons_: loose Buttons on the title's row (a lone action, red
    outlined when it destroys).
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
| (no match)                       | Message pages                   | Not found, inside its area (after the area's sign-in check) when the path is in one                                  | `NotFound.tsx`                    | Message page |
| (an error)                       | Message pages                   | Something went wrong, inside its area                                                                                | `PageError.tsx`                   | Message page |
| `/welcome`                       | Welcome                         | an Account connected to nothing requests a Quote to become a Client                                                  | `Welcome.tsx`                     | Form page    |
| `/people`                        | People                          | test site only: sign in as a demo person (`?as=` first name, `?next=` the page after)                                | `PeopleScreen.tsx`                | none         |
| `/office` | Office > Today | the first to-do, then to-dos and the day counted by kind (`?open=`) | `office/Dashboard.tsx` | Home |
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
| `/cleaner` | Cleaner > Your jobs | next up, then coming up and done today counted (`?open=`) | `cleaner/CleanerHome.tsx` | Home |
| `/cleaner/offers`                | Cleaner > Offers                | Jobs offered or open to them (`?tab=`)                                                                               | `cleaner/CleanerOffers.tsx`       | List         |
| `/cleaner/jobs/$jobId`           | Cleaner > Job                   | a Job they're on, where the Offer email leads: take or drop it, complete it, record no access                        | `cleaner/CleanerJobScreen.tsx`    | Record       |
| `/cleaner/open/$jobId`           | Cleaner > Cleaner needed        | a Job open to them, to take                                                                                          | `cleaner/CleanerNeededScreen.tsx` | Record       |
| `/portal`                        | Client portal > Home            | what's next                                                                                                          | `portal/PortalHome.tsx`           | Home         |
| `/portal/cleans`                 | Client portal > Cleans          | upcoming and past cleans (`?tab=`)                                                                                   | `portal/PortalCleans.tsx`         | List         |
| `/portal/payments` | Client portal > Payments | what's owed, then every payment (`?open=`) | `portal/PortalPayments.tsx` | Home |
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

Keeps: action first, count tiles (#94, ux-office-today). Renders through
`HomePage` (#435).

- Header: "Hi, name", not in the bar.
- Body: the first to-do (`AnswerCard`, led by what to do, the primary), or
  all clear; tiles On today, Jobs, Quotes and Money (`?open=`), each
  opening its rows in place, to-do rows led by what to do; On today's rows
  the day's Jobs, then Open the Schedule.

#### Office > Schedule

Keeps: schedules are calendars; a day at first on a phone, three days
wider, then the span last chosen; a block leads with its client's name,
its state a mark (#493 G4.1). Renders through `CalendarPage` (#437).

- Header: "Schedule" in the bar.
- Body: the range bar; a key, each state drawn as a block; the calendar.

#### Office > Jobs

Keeps: Table + Tabs (#146). Renders through `ListPage` (#433).

- Header: "Jobs" in the bar; on a phone, the search's icon.
- Body: Tabs Upcoming · Past · Cancelled, the search at the end of their
  line from md; by month: a Table from md, dated rows on a phone, a badge
  only for Needs cleaners; Show more (N left).

#### Office > Job

Keeps: its actions in one place on the title row (#406; a ⋯ since #493). Renders through `RecordPage` (#432).

- Header: Jobs › Job; "Service at street" and its status.
- Actions: Menu (Move job, Ask for a new time, Mark not done once done;
  Cancel job in red).
- Alerts: Ended, Move asked for (answer), Cleaners needed (offer), Price
  changes to review, Unpaid (retry; a failed retry is a Toast), Plan offer
  (once the First Clean is paid); two shown.
- Body: Job details (`DetailsCard`: `DateTile`, the time large, icon facts);
  How it went; Crew (Section: List, those on it only); Money (Card: its
  facts, price changes, How it's worked out folded).
- History: a Card, last, at every width; a drop-out is told here.

#### Office > Quotes

Keeps: Table + filters (#109). Renders through `ListPage` (#433).

- Header: "Quotes" in the bar; on a phone, the search's icon; New quote
  (primary).
- Body: Tabs Requested · Draft · Sent · Expired, the search at the end of
  their line from md; a sortable Table from md (Client · Address · Service
  · Total · Waiting, Address from lg, no Total on Requested until a search
  spans the Tabs),
  rows on a phone, the Table's cells as one line under the Client; Show
  more (N left).

#### Office > New quote

Keeps: one page, the price beside it (#164).

Renders through `FormPage` (#434).

- Header: Quotes › New quote; the title; About this page (folded).
- Body: one Card: Who's calling (Find the client, a List), then the Quote
  form's steps, each open. Quote, the price so far, leads: first on a phone, a
  sticky aside from `xl`, its working folded.
- Actions: Draft a quote, once someone's calling: the header's primary
  from md, the price so far beside it in the header that sticks below
  `xl`; an `ActionFooter` (the price so far, Draft a quote) on a phone.

#### Office > Quote

Keeps: a record as its story (#145). Renders through `RecordPage` (#432).

- Header: Quotes › client › home › kind; "kind for client", its status, and
  a second badge while a change is being drafted.
- Actions: its next step the primary (`useNow`): Draft the quote (asked),
  Book a site visit (its Service seen first), Carry on with the draft,
  Record acceptance (sent, with a card or a plan change), Change quote
  (its time filled up); behind the arrow Book a site visit (optional),
  Turn down, Change quote, Record acceptance (while a change is drafted).
  Turn down alone, outlined in red, while its visit is booked; Change
  quote alone when sent with no card, or expired; none once declined,
  accepted or turned down.
- Alerts: only why, where the badge, the facts and the story don't say it:
  the visit to book or booked, the draft not sent, no card to record a yes
  by phone (its one action, Email a link to add a card), the time filled
  up, the plan an acceptance started or changed; the home's plan, the plan
  change.
- Body: a Timeline, Now on top holding Current quote (Card; once a
  one-off is accepted, only the Service booked, "Booked for" its time), then
  each moment; What was asked folded (`Fold`), the home's facts in it.
- History: the page itself.

#### Office > Draft quote

Keeps: a Draft page of its own (#145). Renders through `FormPage` (#434).

- Header: … › Draft quote; "Draft quote for client".
- Actions: from md, Send, the header's primary, Delete draft behind its
  arrow, save state beside it, the price too in the header that sticks
  below `xl`; on a phone, Delete draft (outlined in red) on the title row
  and an `ActionFooter` (the price, save state, Send).
- Alerts: the client still sees the quote as sent (once it's been sent);
  the plan change.
- Body: one Card: What was asked and the first clean (folded); Service
  (its Type, its own price; the recommended Service's behind a fold) or Plan and
  each weekday (its Cleaners, its own price, then its proposed time); Extras and Terms
  (folded); Proposed time: the open times to pick from, a week's days over
  the viewed day's start times, the date and time fields behind "Type a
  date and time"; folded to the time ("Not picked yet" before one), open
  on load unless it's set, has room and can be sent. Quote leads:
  first on a phone, a sticky aside from `xl`; a one-off's own price, the
  Service recommended for a first visit one folded line under it ("Also
  offered: …"); a plan's week first; under each option's price, why the
  client can't pick it at the time proposed, if they can't (said once, under the one asked for, when the Service offered has the same problem); each price's working folded. The
  header that sticks and a phone's foot name the one-off's own price.

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

Keeps: one page of Sections, its History last (#493). Renders through `RecordPage` (#432).

- Header: Clients › client › address; the address.
- Actions: on hold, its next step the primary (See bill N, or See the job),
  the rest behind its arrow; otherwise Menu (New quote, Correct details).
- Alerts: on hold (why), see it first (premises with no findings), rooms missing,
  new terms (open the Quote).
- Body: Home details (`DetailsCard`: `IconTile`, icon facts); Cleaning plan
  (Section: Change terms and End plan in red on its title line, the plan's
  card), or an `ActionRow` to set one up; Site visit.
- History: a Card, last, at every width.

#### Office > Ended cleaning plan

Keeps: the Record. Renders through `RecordPage` (#432).

- Header: Clients › client › home › Cleaning plan; "Cleaning plan" and its
  Ended badge.
- Actions: none once Ended; opened from Today while it runs, Menu (Change
  terms; End plan in red), behind the primary while on hold (See bill N, or
  See the job).
- Alerts: on hold (why), in its badge's tone: warning, or info for a
  payment we try again ourselves.
- Body: the plan (`DetailsCard`); visits waiting; Jobs (Section: List).

#### Office > Site visit

Keeps: the Record; findings are part of the visit (#156). Renders through `RecordPage` (#432).

- Header: Clients › client › home › Site visit; "Site visit" and its status.
- Actions: once it's been, a Split button (Record findings; behind its arrow
  Move or change, Cancel visit in red); booked before then, Menu (Move or
  change; Cancel visit in red).
- Alerts: they've been, a quote waits on what they found (warning);
  cancelled.
- Body: Visit details (`DetailsCard`: `DateTile`, icon facts, the quote
  it's for); What it found (an `ActionRow` to record it before it's been,
  absent once it's been until it's recorded, its facts once done).

#### Office > Bill

Keeps: one card, read like an invoice (#157). Renders through `RecordPage` (#432).

- Header: the letterhead (print only, before the layout); Clients › client ›
  Bill N; "Bill N" and its status (its week is a fact).
- Actions: once its payment didn't go through (our charge, or the Client's
  on its page) or it's late, Record a payment the primary, Print and Cancel
  bill in red behind its arrow; otherwise Menu (Record a payment, Print;
  Cancel bill in red). While a payment on it is going through, Record a
  payment and Cancel bill are greyed, each saying under it "Not while its
  payment is going through", or "Not while Casey is paying this bill" while
  the Client's bank asks them to approve theirs.
- Alerts: that, while a payment is going through (info), or the Client's
  bank asks them to approve theirs (warning: who, how much, and when it's
  called off); the Client's payment on its page that didn't go through, when
  and why; why it's unpaid; or its bank payment on its way.
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

Keeps: read, change a part in a dialog (#161). Renders through
`SettingsPage` (#436).

- Header: "Prices" in the bar; the version, one muted line.
- Alerts: the starting figures, Keep these figures.
- Body: Condition, Quote defaults, Sales tax on fees (one card, a summary
  row each, opening its dialog: what it's for, its figures, what saving
  does); Extras and Types of business (`SettingsList`: rows each opening
  its dialog, the retired folded under "Retired (N)").

#### Office > Services

Keeps: a work list. Renders through `ListPage` (#433).

- Header: "Services" in the bar; New service (primary).
- Body: Tabs Offered · Retired (`?tab=`); a Table from md, rows on a phone.

#### Office > Service, New service

Keeps: one form, its example a worked-out Quote (#163). Renders through
`FormPage` (#434).

- Header: Services › name; the name, Retired badge; "Version N, saved by …";
  Retire or Offer again.
- Body: one Card: What it is (one line on a Service, open on a new one),
  How long it takes, Price, Booking (one line), Sales tax; the example
  Quote in a sticky aside from `xl`, after the card below it.
- Actions: Save service, or Add service, at the card's foot.

### Cleaner area

#### Cleaner > Your jobs

Keeps: next up large, then coming up (ux-cleaner). Renders through
`HomePage` (#435).

- Header: "Hi, name", not in the bar.
- Body: Now or Next up (`AnswerCard`: `DateTile`, Directions, Open job the
  primary), or nothing booked with See offers; tiles Coming up and Done
  today (`?open=`, dated rows in place) and Offers (a link).

#### Cleaner > Offers

Keeps: only theirs (ux-cleaner). Renders through `ListPage` (#433).

- Header: "Offers" in the bar.
- Body: Tabs Offered to you · Open to you (`?tab=`); by month, dated rows
  led by the postcode; with nothing in either, one quiet line.

#### Cleaner > Job

Keeps: the Record, layout D (#493). Renders through `RecordPage` (#432).

- Header: Offers (while offered, lit in the nav too) or Your jobs › day
  and time; the Service and its stage's badge (Available, Today, On site,
  Done, Couldn't get in; none before the day).
- Actions: the split button. Offered: Confirm; Not for me. Theirs:
  Directions; Call the office, Drop out in red (absent inside 48 hours).
  On site: Mark done (greyed till the crew's confirmed); Couldn't get in,
  Call the office.
- Alerts: not everyone has confirmed (warning, calling the office).
- Body: Job details (`DetailsCard`: a `DateTile`, the times large, the
  address; How long, Client, the client's number once they've confirmed,
  on the Job's day, Extras as a count, How we get in last and full width,
  the same); Extras
  (`ExtrasSection`); Crew (`CrewSection`). Once over, Completed or
  Couldn't get in first, the Job folded under it.

#### Cleaner > Cleaner needed

Keeps: Cleaner needed (#148). Renders through `RecordPage` (#432).

- Header: Offers › date and time; the Service and an Available badge.
- Actions: the split button, Confirm; Not for me.
- Body: Job details (`DetailsCard`: a `DateTile`, the times large, the
  ZIP code; How long, Crew as how many, never who).

### Client portal

#### Client portal > Home

Keeps: what's next, date tile, shortcut tiles (ux-portal). Renders through
`HomePage` (#435).

- Header: "Hi, name", not in the bar; Request a quote (secondary), unless
  the card asks something out of the usual (money owed that asks, a price
  change, a crew who couldn't get in) or is Request a quote itself.
- Body: an alert saying why, when the card needs a reason (`Alerts`:
  money late, a price change, the morning a crew couldn't get in, a plan
  paused with nothing to do); the card (`AnswerCard`): what's owed when it asks
  something of them (the amount, Pay or Update your card), else a price
  change to answer (what it adds, Review the price change), else that
  morning's How we get in, else a quote ready, else the next clean
  (`DateTile`, the primary), else the plan paused (its way to it outlined) or where they stand;
  news (info Notices); up to four link tiles, what else waits on them
  first (a quote, a price change with what it adds and by when), then
  shortcuts.

#### Client portal > Cleans

Keeps: Tabs, by month, date tiles (ux-portal). Renders through `ListPage`
(#433).

- Header: "Cleans" in the bar.
- Body: Tabs Upcoming · Past; by month, dated rows led by the kind of clean
  (the home too, for a Client with more than one); with nothing in either,
  one quiet line; Show more (N left).

#### Client portal > Payments

Keeps: what you owe first, fixed header Button (ux-portal). Renders through
`HomePage` (#435).

- Header: "Payments" in the bar; Your card (secondary), standing aside while the card asks something of them (its tile stays).
- Body: what you owe (`AnswerCard`: `IconTile`, the primary; for a payment we try again ourselves, Payment pending, one line (and one while it pauses a plan), its link outlined; a Bill whose payment on its page didn't go through leads, in red, saying why) or all paid;
  Notices of payments clearing; tiles All payments (`?open=history`, the
  Statement by month in place) and Your card (a link).

#### Client portal > Your details

Keeps: a list of homes; read, then Edit (ux-portal). Renders through
`SettingsPage` (#436).

- Header: "Your details" in the bar.
- Alerts: a new email waiting on its link.
- Body: Contact details (one card, its summary row opening its dialog);
  Your homes (`SettingsList`: rows each opening its page).

#### Client portal > Your card

Keeps: on the Payment Method page (ux-portal). Renders through `FormPage`
(#434).

- Header: Payments › Your card; the title; "How your card is used", folded.
- Notices: the card failed (Try again, its problem a Toast), or saved, or
  info.
- Body: one Card: the card field; what saving agrees to, and Save card, at
  its foot.

#### Client portal > Request a quote

Keeps: steps, quiet choices (#114). Renders through `FormPage` (#434).

- Header: Home › Request a quote; the title.
- Notices: info.
- Body: the Quote form in its steps, in the Card.

#### Client portal > Clean

Keeps: the Record (ux-portal). Renders through `RecordPage` (#432).

- Header: Cleans › date and time; the Service and its status.
- Actions: the next step the primary, the first that asks something: Update
  your card (Unpaid, unless we try again ourselves), Review the price change
  (the one that lapses first, its dialog titled by what it's for), Check how
  we get in (after the crew couldn't), Pick a new time (booked); the rest
  behind its arrow (Skip or Cancel last, in red, its dialog saying what it
  costs; the plan or Request a quote after a No Access). Nothing next while
  a move is asked (Cancel or Skip its one action, outlined in red) or once
  cancelled (a Button to the plan or to request a quote).
- Alerts: each only why: Unpaid (one we try again ourselves info, its
  its badge "Payment pending", its line "Nothing you need to do.", as it asks nothing), a price change (one that isn't the next
  step keeping its own Review), a move asked for (Withdraw request, its one action) or
  turned down, the crew couldn't get in (red: when, why, what it cost).
- Body: Details (`DetailsCard`: a date tile, the time large, the address,
  icon facts, a row only with something in it (price, how long (no crew
  count) and the deposit paid only while it's booked, its extras and plan while booked or done),
  and while it's still free,
  until when it's free to move or cancel); cancelled, or the receipt (the
  quoted price only when a change makes the total differ, the rest by that
  name, a weekly Bill it went on by its number, linked, with its badge;
  what's still to come by the badge's word, Unpaid or Payment pending, and the
  card it was charged to only once nothing is, or the rest goes on a weekly
  Bill).

#### Client portal > Your quote

Keeps: read like a Quote, paying under it (#165). Renders through `RecordPage` (#432).

- Header: Home › Your quote; the title and its status (Ready while it's
  theirs to answer, Fully booked once its day filled up); "updated · open
  until", while it applies.
- Actions: turned down, Request a quote the primary; booked up, Decline
  this quote its one action (a Button); else none.
- Alerts: each only why: how it ended (accepted, declined, expired, turned
  down), what it does to the plan, booked up.
- Body: Quote details (`DetailsCard`: what it comes to, icon facts, how
  long its crew is there, on each option too, a plan's each weekday's
  joined by "+", or once when they match, no cleaning hours or crew on its
  weekday cards); Accept
  (Decline beside it, quiet; its confirm not red). While it's being
  prepared: what they asked for.

#### Client portal > Your plan

Keeps: headline, then facts across (ux-portal). Renders through `RecordPage` (#432).

- Header: Your details › street › Your plan; "Your plan" and its status.
- Actions: on hold, its next step the primary (Pay bill N, or Update your
  card), the rest behind its arrow, unless it's a payment we try again
  ourselves; otherwise Menu (Ask to change; End plan in red).
- Alerts: on hold (why), in its badge's tone: warning, or info for a
  payment we try again ourselves, which says there's nothing to do.
- Body: the plan (`DetailsCard`); Upcoming (Section: List).

#### Client portal > A home

Keeps: a list of homes, each with its own page (ux-portal). Renders through `RecordPage` (#432).

- Header: Your details › street; the street and its standing.
- Actions: one Button (Edit how we get in).
- Body: Details (`DetailsCard`: the full address, icon facts); Plans
  (Section: List, or an `ActionRow`); Quotes (Section: List).

#### Client portal > Bill

Keeps: one card, read like an invoice (#157). Renders through `RecordPage` (#432).

- Header: letterhead; Payments › Bill N; "Bill N" and its status (its week is a fact).
- Actions: while the server says it can be paid (`payable`), Pay this bill
  the primary (its form in a dialog), Print behind its arrow; otherwise one
  Button (Print), as while a payment is going through (#533, #534). While
  their bank asks them to approve their payment, Pay this bill stays, to
  start over.
- Alerts: their bank asking them to approve their payment (warning); their
  payment on its page that didn't go through, and why (danger, the badge
  Unpaid); why it's unpaid (Update your card, a text Button); or its bank
  payment on its way.
- Body: the Bill (`DetailsCard`).

### Signed out and signed in

#### Sign in

Keeps: Google first (#168).

- `SignInPage`: the logo above a narrow card holding the title, a warning
  Notice (`?error=`), Continue with Google and the email form; under it the
  line for someone new, then the landing site's Privacy policy and Terms of
  service (#462).

#### Message pages

Keeps: a message page; centred, home a link (#168); one Button that does it
(sign-in-button).

- `MessagePage`: a narrow centred card, a large `IconTile`, the title,
  one line, at most one Button, home a text link. Not found; Something went
  wrong (Try again); Sign-in link (Sign in); Confirm email (three states).

#### Welcome

Keeps: in steps (#168); what's next said once, in the line under the
title (#493 G5.3). Renders through `FormPage` (#434).

- Its own page, no breadcrumbs: the logo, who's signed in and Sign out,
  and under them, the same size: asked for a quote with another email?
  Sign out and use that one. The title, what to do here.
- Body: the Quote form in its steps, in the Card.

#### People

Keeps: a page of the demo people, test site only (ux-switch-person).

- A list of people to sign in as, and a form for anyone else.

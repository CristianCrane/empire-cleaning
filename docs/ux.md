# UX rules and decisions

How Empire Cleaning's screens are meant to look and behave, and why. Read
this before changing any screen in `packages/web`, `packages/ui`,
`packages/quote-request` or `packages/landing`.

- **The rules** below are what every screen keeps. Most have a live example
  in Storybook under **Patterns** (`packages/ui/src/Patterns.stories.tsx`),
  named in brackets.
- **The decisions log** at the foot says what each screen was, the options
  tried, which won and why. Check it before reworking a screen, so a choice
  isn't undone by accident.
- **Changing a screen** says how a new UX question is settled.

They came out of a screen-by-screen UX pass (#96). These aren't ADRs: they
can change, through the same loop.

## Principles

- **Least Client friction.** In every Client-facing choice, pick the option
  with the fewest steps for the Client (passwordless sign-in, self-serve
  choices instead of round trips to the Office), and call out any trade-off
  that adds steps.
- **Answer the question the person came with first.** A home screen says
  what's next; a money page, whether anything is owed; a Cleaner's list,
  where they're working.
- **Figures the owner edits are concrete.** Hours per room, not
  multipliers pointing at figures elsewhere; when figures combine, show a
  worked example beside them (the Service page's Example Quote).
- **Less is more.** Rows and pages carry only what drives the decision;
  details belong on the detail page. Offer to cut rather than add.
- **Hide what can't happen yet.** No step shown before it applies; a
  blocked step's unblocking action sits in the Notice that explains it.

## Rules

### Page structure

- **Sections, not Cards, around Lists and Tables.** A title sits on the
  page, above an untitled Card or a List; never a Card titled inside, never
  a box in a box. ("Sections Not Cards Around Lists")
- **A details page: alerts, then the details, then what you can do.**
  Notices first; one details card answering when, large, with an
  `IconTile` or `DateTile`, then its facts in even columns across (each an
  icon, a value and a muted line saying what it is; three text styles, no
  more); then each thing they can do as its own card, its text and Button
  on one row (`ActionRow`). ("A details page: alerts, details, actions")
- **When every part of a record matters at once, two columns.** Notices on
  top; the record, its people and its money left; its history right as a
  `Timeline`. One column on a phone. The two-column grid starts at `xl`.
  ("All at once in two columns")
- **A price beside the figures that make it** sits in a sticky aside from
  `xl`, after the fields below it (the Service page, New Quote).
- **A record that moves through steps is its story**: a `Timeline`, newest
  first, **Now** on top holding the record as it stands. Work in progress
  (a Draft) has a page of its own. ("Records as stories")
- **A home screen answers what's next**: one card, read left to right
  behind a `DateTile`, with the page's one primary Button; `ShortcutTiles`
  under it. Lists of past things live on their own pages. ("A home screen
  answers what's next")
- **A money page answers what's owed first**: one card (success, warning or
  danger), its one Button; history after it, the latest few then See all.
  ("A money page answers what's owed")
- **Settings are read, then changed part by part**: facts and rows, each
  part changed in its own dialog (Price List, Staff). A form the owner
  tweaks to see what it does stays one form, with its example beside it
  (Service).
- **A message page** (Not found, Something went wrong): centred in one
  narrow card, a large `IconTile`, the title, one line, at most one Button
  (what fixes it), the way home a text link under it. No details a Client
  can't use. ("A message page: one Button, home a link")

### Buttons and actions

- **At most one primary Button per page.** Two primaries means neither is.
  Everything else is secondary, text or quiet.
- **Buttons are ranked by fill**: primary filled, secondary outlined,
  `text` for a Section's actions, `danger-text` beside them, `danger`
  alone, `quiet` only to back out. Nothing pressable looks inert.
  ("Clickable catches the eye")
- **A Section's actions are text Buttons** on the title's line, no taller
  than it; on a phone they wrap under the title.
- **Destructive actions are red** (End plan, Void, Deactivate, Decline).
- **A third-party sign-in button keeps its owner's branding**: Continue with
  Google is Google's own button (their colours in light and dark, their
  logo, Roboto), not ours. Only the 44px touch height is ours.

### Notices

- **A Notice holds at most one action**, a text Button (or `ButtonLink`) on
  the right of its text, never primary. Two things to say or do are two
  Notices. ("Notices hold one action")
- **Tone means what a status's does**: warning for something waiting on
  someone, danger for something that failed or is late, info for what
  they're waiting on us for, success for done.

### Dialogs and rows

- **A row holds no Buttons.** Pressing it opens one dialog that does the
  work. ("Rows open one dialog, two Buttons")
- **A dialog has at most two Buttons**, one filled (primary, or danger) and
  one quiet (Cancel, or an alternative like Dismiss), plus the ✕.
- **Never a dialog on a dialog.** A second look (Remove, Turn down) is a
  step inside the same dialog; a picker sits in the dialog itself, the
  dialog made wide if it needs room.

### Lists and tables

- **Lead a to-do row with what to do** (Send a Quote, Assign Staff), a
  toned `IconTile` for the kind; rows that only show things keep the name
  as the title. ("Action First To Do Rows")
- **A growing work list is a Table**, a `Tab` per status with counts and a
  search, both in the URL; 50 at a time with Show more once it can grow
  without end. ("Work Lists As Tables")
- **Lean rows**: the fewest columns that drive the decision (who, where,
  status, money, age); no cell that means something different from row to
  row; no colour without a visible label.
- **Dated things a person scans are grouped by month**, a small `DateTile`
  leading each row; a row is badged only when it isn't plain.
- **An empty place offers what fills it** (`EmptyState` with its action),
  never a card in a card. ("Empty states offer the action")

### Forms

- **Forms ask quietly, a few questions at a time**: tinted fields with a
  bottom line; `SegmentedControl`, `ChipGroup` or `ChoiceTiles` for short
  choices; optional fields behind "+ Add …"; long forms in steps, who's
  asking last. The Office on the phone gets one page in the order of a call
  instead. ("Quiet Forms In Steps")
- **Every search field shows a magnifying glass.**

### Time and schedules

- **Schedules are calendars**: a week on the Schedule, one day on Today, a
  month on a Cleaner's availability. Jobs are timed events (start and
  duration), ready for a Google Calendar sync. ("Schedules As Calendars")
- **Every place a time is chosen uses the calendar picker**, with the day
  and time fields kept as the keyboard path. The Office picks on the
  Schedule (`office/SchedulePicker.tsx`, inline in a wide dialog); a Client
  picks a day on a month, then that day's open times
  (`screens/AvailabilityPicker.tsx`). Clients never see the Schedule or
  anyone else's Jobs.

### Status and colour

- **A status is the same colour everywhere**: info just so, success done
  or running as it should, warning needs someone, danger went wrong,
  neutral not going ahead. ("Status colours")
- **One icon per concept, app-wide** (`screens/icons.ts`): a Quote is
  `ClipboardPenLine`.

## Changing a screen

1. **Ask the question.** What is the screen for, and what's wrong with it
   now?
2. **Prototype it** on a `prototype-<screen>` branch: a signed-out route
   (`/prototype/<screen>?case=&layout=`) with made-up data for every state,
   ↑/↓ to switch layouts and ←/→ to switch cases (`PrototypeSwitcher`).
   Usually three layouts. Push the branch; it's kept as the record.
3. **Pick one** with the user, and note any tweaks.
4. **Build it** on a `ux-<screen>` branch, with its tests (e2e on phone and
   desktop, axe in light and dark, the layout test at every width).
5. **Record it**: a row in the decisions log below; a new rule above, and a
   pattern in Storybook, if it carries over to other screens.

A change that only applies these rules needs no prototype; it still gets a
row in the log.

## Decisions log

Newest last. "Built in" is the PR (or branch) that shipped it.

| Screen | Question | Variants | Picked | Why | Prototype | Built in |
|---|---|---|---|---|---|---|
| Office > Schedule | How should the Schedule look? | Week calendar / crew lanes / month + agenda | **Week calendar** | See the whole week at a glance and go straight to a Job; should look and behave like a calendar, for a possible Google Calendar sync (#53) | [`prototype-schedule-views`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-schedule-views) | #54 |
| Office > Today | Which sections need a Card? (a Card around a List read as two boxes) | Current / Sections with boxed lists / Flush card / Open rows | **Sections with boxed lists** | One box per section; the heading marks the section, not a surface. Added `Section` to the design system | [`prototype-today-cards`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-today-cards) | #94 |
| Office > Today | How does the Office tell Needs attention items apart? (every row looked alike, the kind only in a badge) | Current / Grouped by kind / Action first / Work areas | **Action first** | The row's title says what to do (Send a Quote, Assign Staff, Collect the Bill); a toned `IconTile` says what kind it is; the Client leads the description | [`prototype-attention-items`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-attention-items) | #94 |
| Office > Today | What should lead to the full Schedule, and how is it clear these are today's Jobs? | Current / Day calendar + Week button / Day calendar + heading link / Day agenda + link below | **Day calendar + Week button** | "Today's Schedule" on the Schedule's own calendar locked to today; a secondary Week button with a calendar icon replaces the bare "Schedule" link. The header line was dropped: the calendar's day header carries the date and hours | [`prototype-today-schedule`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-today-schedule) | #94 |
| Office > Quotes | Which grouping, sort and filters let the Office see what to do next across open Quotes? | Current / By next step / Table + filters / Board | **Table + filters** | Dense and sortable; a Tab per status with counts, plus a search by Client or address. The list holds only open Quotes, so it loads whole and searches in the browser, without pages. Trimmed after building to Client, Property (address only), Status, Total, Waiting: columns that varied by row (Condition vs weekdays) or carried unexplained colour read as noise | [`prototype-quotes-list`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-quotes-list) | #109 |
| Quote form (landing, portal, New Quote) | How to make the form less noisy (a box per field and per option, lines everywhere)? | Current / Quiet choices / + tuck optional fields / + steps; fields outlined / soft / soft + line | **Steps, quiet choices, tucked optional fields, soft + line fields** | Few questions at once: what and where, about the place, then who's asking. Short choices are a `SegmentedControl` or `ChipGroup`, optional fields wait behind "+ Add …". Fields app-wide are a tinted box with a bottom line: without the line they vanish on the grey page and lack contrast | [`prototype-quote-form`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-quote-form) | #114 |
| Quote form, first step | How to ask the type of home without two segmented controls back to back? | Two segmented controls / icon tiles / icon pills / plain radios / one question as icon tiles | **One question as icon tiles** | House, Apartment, Townhouse and Business premises as `ChoiceTiles`: business premises are just another kind of place, so one question replaces two, and icons make it quick to scan. The unit stays in view, beside the ZIP code | [`prototype-home-type`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-home-type) | #114 |
| Office > Clients | Tweaks (no prototype) | — | **Avatars, search icon, one box, email · phone** | Each row leads with the Client's avatar and keeps how to reach them without the Property count; the List loses its Card (Sections not Cards); every search field shows a magnifying glass | — | #116 |
| Office > Clients | How does the list cope as Clients pile up over the years? | Everyone / Show more / Active only + search everyone / Table + status Tabs | **Table + status Tabs** | Opens on Active (a Service Plan, or a Job coming up or in the last 90 days), with Quoting, Past and All and their counts; the server works out the Tabs and pages 50 at a time, Show more adds 50. A search looks through All unless a Tab is picked. Same pattern as the Quotes table | [`prototype-clients-list`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-clients-list) | #117 |
| Office > Client | How do a Section's title and its actions (Edit) look? | Card titled inside / title outside an untitled Card; actions: outlined, quiet, text link, tonal (all with icons) | **Title outside the Card; text action, tinted on hover** | Every title on the page sits on the page, Lists in Sections and other content in an untitled Card below its title. Secondary actions read as brand-colour text with an icon (C at rest, D on hover): the new `text` Button. Main page actions keep primary and gain an icon | [`prototype-section-actions`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-section-actions) | #119 |
| App-wide | Which icon stands for a Quote? | Inbox and Phone (mixed) / FileText / Calculator / ClipboardPenLine / FilePenLine / HandCoins | **ClipboardPenLine** | A Quote is written up on the spot; one `QuoteIcon` in `screens/icons.ts` for the nav, New Quote, Today's rows and Request a Quote, so they always match | [`prototype-quote-icon`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-quote-icon) | #119 |
| Office > Property | How does a Property show its details first, without its plan, visits and history piled on? | Current / Tabs per kind / Details \| History / that with read-then-Edit details / all in Tabs with empty states | **Details \| Service Plan \| Site Visit \| History, empty states offering the action** | Details first, as the Office opens a home for them. The plan and the visit show in full in their Tabs (no hop to another page); with none, an EmptyState offers the action, or an info Notice says what Quote is in the way. History is one Table. Tab kept in the URL | [`prototype-property-page`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-property-page) | #120 |
| App-wide | How do Buttons and statuses say how much they matter? | (tweaks, no prototype) | **Brand-coloured Buttons ranked by fill; one colour per status** | Nothing pressable looks inert: primary filled, secondary outlined, text for Section actions, danger-text beside them, danger alone; quiet only to back out. A status is the same colour everywhere: info just so, success done or running as it should, warning needs someone, danger went wrong, neutral not going ahead | — | #120 |
| Office > Quote | How does the page say what to do next with a Quote, whatever its status? | Current / Next step up top / Two columns / Tabs / Timeline | **Timeline** | A Quote moves through steps, so its page is its story, newest first: **Now** holds the Current Quote, below it what happened (asked, Site Visit done, Revisions sent, expired, accepted). What to do sits above it in Notices. The page's order never changes with the status | [`prototype-quote-page`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-quote-page) | #145 |
| Office > Quote | Where is a Revision written, and the Suggested Price shown? | (iterated, no prototype) | **A Draft page of its own** | The Quote page showed the Suggested Price and an editor before anything could be done with them. The Draft is written at `/office/quotes/:id/draft`, one card ruled into parts, each price's Suggested Price working folded under it, the First Clean as a note above; Delete the Draft in its header. Business premises aren't drafted until they're seen | — | #145 |
| Office > Quote | Too many cards: details, prices, Deposit, First Clean | (iterated) | **One card, "Current Quote"** | Terms, each Service's price and the Deposit in one card ruled into parts; the First Clean only where a Revision is drafted | — | #145 |
| App-wide | How do Notices and primary actions work? | (iterated) | **One text action per Notice, on its right; one primary per page** | A Notice is passing news, never the page's main action: at most one action, a text Button on the right of its text; two things to say are two Notices. A page has at most one primary Button | — | #145 |
| Office > Job | How does the page show a Job, whatever its state, without a Card per concern? | Current / Timeline / Tabs / Two columns | **Two columns** | Every part of a Job matters as much as the others, so it's all in one view without scrolling: Notices on top, the Job, Crew, Adjustments and Money on the left, History as a Timeline on the right, with room to grow. The title is "<Service> at <home>", the time under it; Move Job, Ask for a new time and Cancel Job are an ActionBar of icons beside it, named in tooltips. Notices for what the Office must do are warning | [`prototype-job-page`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-job-page) | #146 |
| Office > Job | How do Adjustments read at a glance? (one sentence ran together the Add-on, done or not, and the price, clipping it; three Buttons a row) | Current / Table / Rows, price on the right / Grouped by what it does | **Table** | What, Change, Price (signed) and Status each in a column. A row holds no Buttons: it opens one dialog that reviews, corrects or removes it | [`prototype-job-adjustments`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-job-adjustments) | #146 |
| App-wide | How many Buttons does a dialog have? | (iterated) | **Two at most, filled and quiet, plus a ✕** | One filled (primary, or danger) and one quiet: Cancel, or an alternative like Dismiss, with the ✕ cancelling. Never a dialog on a dialog: a second look is a step in the same one. The Account dialog's area switches became rows | — | #146 |
| Office > Jobs | Where does the owner find a Job, as a top-level thing? (Jobs were only reached from the Schedule, and their breadcrumbs started there) | (asked, no prototype) | **A Jobs page in the nav: Table + Tabs Upcoming · Past · Cancelled · All; breadcrumbs Jobs › Job** | The Clients pattern: a Tab per where they stand with counts, search by Client or address, 50 at a time with Show more, in the URL. Needs attention stays on Today. The Client and home are links in the Job card, so the breadcrumbs only lead back to Jobs | — | #146 |
| Client portal > Home | What does a Client see first, when Home stacked up to seven Cards of lists (Bills, plans, Site Visits, upcoming and past Jobs, Quotes, homes)? | Current / Sections, what needs you first / Next clean + Tabs / Needs you + Coming up + history Tabs / those combined / What's next | **What's next** | The combined page had too many concepts competing. Home answers one question: the soonest thing booked, or, with nothing booked, where they stand, worked out for 15 cases (new, Quote being prepared, Site Visit needed or booked, Quote ready, first clean, plan clean, move pending, today, plan paused, past Client, Expired, Declined, Turned Down). What's waiting on them is warning Notices above it, even several; what they wait on us for, an info Notice after those | [`prototype-portal-home`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-home) | ux-portal |
| Client portal > Home | How does the what's-next card use a wide screen? (everything left-aligned left a gap on the right) | Full-width card / focused column / horizontal with a date tile / centred | **Horizontal, date tile** | Reads left to right like a calendar invite: a `DateTile` (or a large `IconTile` with nothing booked), the answer, and its Button, always primary, the page's one; Request a Quote in the header drops to secondary, and goes when the card asks for a Quote | [`prototype-portal-home`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-home) | ux-portal |
| Client portal > Home | What fills the rest of Home? | Coming up list / shortcuts as tiles / shortcuts as rows | **Shortcut tiles** | A Client often signs in to do one thing: Move or skip, How we get in, Your card, Call us, varying by case, each with a hint (the card on file, the Access Instructions) so a glance often answers. `ShortcutTiles` in the design system | [`prototype-portal-home`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-home) | ux-portal |
| Client portal | Where do the Client's lists go, once Home doesn't hold them? | (talked through) | **Nav: Home · Cleans · Payments · Your details** | Homes and their Service Plans go under Your details (most Clients have one home; revisit if that changes). Quotes get no list: an open one is on Home, an accepted one is linked from what it booked, closed ones under their home. Bills were to be a nav item for weekly-billed Clients only; they became part of Payments, which every Client has (below) | [`prototype-portal-home`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-home) | next |
| Client portal > Cleans | How does a Client find their cleans, coming and done, as a plan piles them up? | Tabs + rows / one page by month / Tabs, by month, date tiles | **Tabs, by month, date tiles** | Upcoming (with Site Visits) and Past, in the URL; month headings make a year of fortnightly cleans scannable, and a small `DateTile` leads each row, echoing Home. Only what isn't plain gets a badge (Move asked, Needs your OK, Unpaid, No Access, Skipped, Cancelled); Past rows say what it cost, 10 at a time. Past now includes Cancelled, Skipped and No Access cleans with their fees | [`prototype-portal-cleans`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-cleans) | ux-portal |
| Client portal > Payments | Where does money go: Bills inside Service Plans, a Tab on Cleans, or a place of its own? | (talked through) | **Payments, for every Client** | Cleans answers what happened at my home; Payments, what I've paid, owe and pay with. A Bill covers all of a weekly-billed Client's Jobs, one-off ones included, so it can't live in a plan. Every Client has a card and payments, so the nav has one shape; the Payment Method moves here from Your details | [`prototype-portal-payments`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-payments) | ux-portal |
| Client portal > Payments | How does the page lead? | Card, then sections / Tabs: Bills, History / What you owe first | **What you owe first** | One card, shaped like Home's: Nothing owed (success), what's due (warning) or what failed or is late (danger), with its one Button (Update your card, Pay Bill …). Bills have no section of their own: a due one is the card, a paid one a History row, a clearing bank debit an info Notice | [`prototype-portal-payments`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-payments) | ux-portal |
| Client portal > Payments | How does the history read without being tedious? | Rows by month / statement with month totals / latest few, then See all / months folded / one row per clean | **Latest few, then See all** | The card answers "am I paid up?"; the last 5 payments, one line each, answer "what was that charge?"; See all opens every payment by month with totals. A row is the day, what it was for (the Service, Deposit for…, Extra on…, Refund on…, No Access fee, Bill EC-…), and the amount, refunds as −$; a second line only when the day doesn't say which clean. A failed Charge isn't a row: nothing moved | [`prototype-portal-payments`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-payments) | ux-portal |
| Client portal > Payments | Where does changing the card go, when the card's Button changes with what's owed? | A link under the card that hides when the Button covers it / a fixed header Button | **Fixed header Button** | "Payment Method", secondary, the same in every case, so nothing moves around; the card just says "Paying with Visa ending 4242" | [`prototype-portal-payments`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-payments) | ux-portal |
| Client portal > Service Plan | How does the plan read, when its details were a column of sentences (and the page boxed Lists in Cards)? | Labels, short values / icon rows / key-figure boxes; then headline + facts across / three groups / schedule list | **Headline, then facts across** | Sections title on the page, Cards only around what isn't a List. Plan details answers when, large, with every weekday in that one place; then price, time on site, extras and Deposit in even columns across the width, each an icon, a value and a muted line saying what it is. Three text styles, no more: labels-beside-values and same-weight icon rows read as noise, boxes inside the card as clutter. Ended is red (stopped), for the Office too | [`prototype-portal-plan`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-plan) | ux-portal |
| Client portal > Job | How does a Job read, when it was a Card per concern (the clean, moving it, cancelling it, a payment, extra work, the receipt)? | (iterated) Cards each / one card with every part / details card + action cards | **Alerts, Clean details, then action cards** | The plan's shape: Clean details answers when, large, then price, time on site, extras and Deposit (or a link to its Service Plan) across, with the receipt in the same card once it's done. Moving and cancelling are action cards below, as Change your plan is: title outside, text and Button on one row (`ActionRow`, a wide gap between). What needs an answer is an alert above it all: extra work to approve is warning, its Review opening a dialog (Approve filled, Decline quiet); a failed charge is danger, its one action Update Payment Method | — | ux-portal |
| Client portal > Payment Method | Where does a Client retry a failed charge, once the Job page's alert has one action? | Drop it (saving a card retries) / on the Payment Method page | **On the Payment Method page** | A charge can fail for a passing reason (no funds that day, a bank hold), and typing the same card again just to retry is friction. Every failed charge leads here: a danger Notice says what and for which clean, its one action Try this card again; or they save a different card, which tries it too | — | ux-portal |
| Client portal > Your details | What does Your details show, when several homes stacked a near-identical Access Instructions form each, and a home's plan and Quotes were nowhere? | Edit in place / Read, then Edit | **A list of homes, each with its own page; read, then Edit** | Contact details read as facts (name, email, phone), changed in a dialog from Edit in the section's header. Your homes (or Your premises) is a List, a row each: the address, its size, and where it stands (Service Plan and its weekdays, On Hold, Quote to answer, Booked, Quote asked for, Nothing booked). A home's page reads like the plan's and the Job's: what it is, large, then floor area, Condition and how we get in across, changed in a dialog; then its Service Plans (or an action card to Request a Quote) and Quotes as rows. A plan's breadcrumbs are Your details › its home › the plan; How we get in on Home and a No Access clean lead to the home's page | [`prototype-portal-details`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-portal-details) | ux-portal |
| Client portal | Do any Cards still title themselves inside? | (sweep) | **No: every titled Card is a Section around a Card** | The Bill, Quote, Payment Method and On Hold Cards follow the rest: title (and description) on the page, the box holding only its content | — | ux-portal |
| Cleaner > Your Jobs | What does a Cleaner see first, when Your Jobs stacked Today, Coming up and Open to you in three Cards? | Next up first / by day / Tabs; then without offers | **Only theirs: next up large, then coming up** | A Cleaner opens it to know where they're working. The next Job is one large card, its time the headline, then the address, with Directions and Open Job always in the same spot; the rest are rows, day and time first, and what's done today. Places that aren't theirs yet were noise there, even as alerts: they're under **Offers**, a nav item with a count, holding what the Office offered them and what's open to them. By day was cluttered; an empty state is never a card in a card | [`prototype-cleaner`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-cleaner) | ux-cleaner |
| Cleaner > Job | How does a Job read on site, when it was a Card per concern (Your place, Where, The clean, Who) and the actions came first? | Action cards / a bar at the foot | **The details page, actions in a bar at the foot** | Its time large, the address with Directions, how to get in in a box of its own (what's needed at the door), then on site, Add-ons, crew and the Client (tap to call) across. Complete Job (a dialog), Couldn't get in and Release my place sit in an `ActionFooter`, in reach without scrolling; an offered place is a card to Confirm or say Not for me. An Open Place reads the same way, without the address | [`prototype-cleaner`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-cleaner) | ux-cleaner |
| Office > a home | How does the Office read a home, when it was four Tabs (Details, Service Plan, Site Visit, History) and Details was an open form? | Tabs, each read first / one page of Sections / two columns, history right | **Two columns, history right** | The Job's shape: what to know in Notices on top; its details (what it is large, floor area, Condition, how we get in and Office notes across, changed in a **Correct** dialog), its Service Plan (the portal's plan card) and its Site Visit (a row opening its page; every Site Visit now has one) on the left; its History as a Timeline on the right. A visit waiting to be booked is a to-do row opening one dialog, Book filled and Skip quiet. A Section's actions are text Buttons on the title's line, no taller than it, so the columns' boxes start level; End plan is red. Facts follow the card's width (a container query) | [`prototype-office-home`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-office-home) | #155 |
| Office > Site Visit | How does a Site Visit read, when it was label-and-value rows under a date heading and a separate Findings card? | Details card then Findings / one card, findings at its foot / two columns, Quote and history right | **One card, findings at its foot** | Findings are part of the visit. When, large, behind a `DateTile` (an `IconTile` for findings with no visit); who visits, how long, how we get in and the Quote it's for across; under a divider, Record findings, or What it found (what it is, Condition, when recorded, Office notes). Move or change and Cancel visit are text Buttons in the header, wrapping under the title on a phone. Once it has been, a warning Notice says so and Record findings is the page's primary; before, it's secondary | [`prototype-site-visit`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-site-visit) | #156 |
| Office and Client > Bill | How does a weekly Bill read, when it was a titled Details Card of label-and-value rows and a titled lines Card? | Details card then lines / one card, read like an invoice / two columns, lines left | **One card, read like an invoice** | A Bill is one document, and it's printed. What it comes to, large (struck through once voided), and where that stands; its week, when it was made, how it's paid, and due by, how it was paid or why it was voided, across; under a divider, each line with its amount on the right, a Job's linking to it, then the tax in it and the total. The Office's Record a payment, Void (red) and Print are text Buttons beside the title. The Client's Bill page shares it | [`prototype-bill`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-bill) | #157 |
| Office > Staff | Does the Staff list need its Card? | (pattern) | **No: a Section's List** | Sections, not Cards, around Lists | — | #160 |
| Office > Staff member | How does a Cleaner's availability read, when it was seven always-open hour fields and a list of days with a Remove Button in each row? | Week strip and a list / the month as a calendar / two columns | **The month as a calendar** | Schedules are calendars. Each day shows its hours; days that differ are tinted (amber off, blue extra), past days dimmed; a day opens one dialog (Save day, and Back to the usual week if it differs). The usual week is edited in a dialog from the header. Details read as facts with an **Edit** dialog for name and roles (new: email stays, the Office keeps an active member, the Cleaner role stays while they hold a place on a Job to come). Deactivate is red, beside the name. Cleaners setting their own days: #159; days off over held Jobs: #158 | [`prototype-staff`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-staff) | #160 |
| Office > Price List | How does the Price List read, when it was one long form saved at its foot, with Retire/Remove Buttons on every Add-on and type of premises? | One form, tidied / read, change a part in a dialog / two columns, figures right | **Read, change a part in a dialog** | Settings are read far more than changed. Add-ons and types of premises are rows (hours · goes with · tax-exempt; a Retired badge) opening one dialog, retired there by unticking Offered. Condition, Quote defaults and the tax on fees are facts with an **Edit** dialog. Each save is a new version. The placeholder notice's one action keeps the starting figures as they are | [`prototype-price-list`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-price-list) | #161 |
| Office > Service | A Service's figures (hours per room, rate, Minimum Charge, tax) are hard to judge on their own: how does the owner see what a tweak does? | One form, example beside it / read, change a part in a dialog / two columns | **One form, its example a worked-out Quote** | The owner tweaks figures to see what they do, so the form stays one column (the user: "easier and intuitive to the owner") and the example is the point: an **Example Quote** beside it from xl, sticky, after Price below. It reads as a Quote: total, place, time on site, then each line of the working-out. She can try a 1, 2 or 4 bed home (or 1,000/2,000/5,000 sq ft and a type of premises) and each Condition. Once a price figure changes, "Your changes: +$x on this Quote" heads it and the saved values stand struck through beside the new. It is worked out by the real Suggested Price, now in models | [`prototype-services`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-services) | #163 |
| Office > New Quote | Someone phones: the Office took their request through the Clients' form in steps (Next, Next, Next), and couldn't say a price until the Draft. | Find them, then the steps / one page, in the order of a call / one page, the price beside it | **One page, the price beside it** | On the phone the Office is fast and the caller asks "how much?". Who's calling first (search, the Client found, or a new caller's details), then what they need, where, the place, one **Draft a Quote**. Beside it, what it comes to so far: the real Suggested Price the Draft then starts with, read as a Quote (`WorkedOutQuote`, shared with the Service page); for business premises a first idea, priced after the Site Visit. Clients' and Guests' forms keep their steps | [`prototype-new-quote`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-new-quote) | #164 |
| Client > Quote | The page a Client accepts on showed each clean twice (price cards, then a radio list where they pay) and an outlined Decline beside paying. | Tap a card, pay below / read like a Quote / a checkout, paying on the right | **Read like a Quote, paying under it** | "The most organized and focused." One **Quote details** card: the total, when, where and on site, the clean chosen by its card (a plan's days instead), then the money line by line. The user first wanted paying inside it, then, seeing Stripe's fields (card, expiry, CVC, country, ZIP), its own **Pay and book** section under it, the actions right-aligned: Decline this Quote (text) beside Accept and pay. No full billing address: Stripe asks the ZIP a card check needs. While open, the header says until when | [`prototype-quote`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-quote) | #165 |
| Client portal > dialogs | Do the portal's dialogs keep the dialog rules? All did (cancel or skip, approve extra work, ask to change, end plan, contact details, how we get in, decline) except Choose a new time: two dropdowns whose "Pick on the calendar" opened a second dialog. | One wide dialog with the week / a page of its own / a month, then the day's times | **A month, then the day's times** | The booking shape people know, and it fits a phone. In the dialog itself: a month where only days with room can be picked, then that day's open times as buttons (their clean's own time marked), "Move it to …", the cost, Send request. The dropdowns stay under "Or choose from a list", the keyboard path. The Office's dialogs that picked from the Schedule over themselves (Move this Job, Choose a new time, Book a plan's visit, Book or Move a Site Visit) are now wide, the week in them under the day and time fields (#167) | [`prototype-move`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-move) | #166, #167 |
| Sign in | Our email link led and Google sat under it in our green outline; a sent link had no way to send it again; nothing told someone new how to start. | One card, tidied / beside what it's for / Google first | **Google first** | Google's own button (their colours in light and dark, Roboto), the emailed link under it; "Send it again" and a spam hint once sent; a line for someone new. A third-party sign-in button keeps its owner's branding. | [`prototype-sign-in`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-sign-in) | #168 |
| Welcome | One card held the intro, a Notice, the whole form and a full-width Sign out. | One column in steps / one page, what's next beside / in steps, what's next beside | **In steps, what's next beside** | Signed in as / Sign out at the top; the form in its steps; "What happens next" (1-2-3) and the different-email Notice beside it from xl. | [`prototype-sign-in`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-sign-in) | #168 |
| Not found, Something went wrong | A card with a title, a line and two Buttons (or the way home a link inside the sentence). | Today's, a Button home / centred with an icon / centred, home a link | **Centred, home a link** | a large icon, the title, a line, at most one Button (Try again), "Go to your home page" a link under it. | [`prototype-sign-in`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-sign-in) | #168 |
| Later items | On Hold was a card of ButtonLinks; a plan clean's price didn't say it was discounted; extra and refund rows named only the clean. | (followed existing rules) | **Applied the rules** | On Hold is a danger Notice per Unpaid Job or Bill, each with its one action; a plan clean's price line says its plan discount; extra and refund rows name the item ("Extra: 1 extra hour", "Refund: Inside the fridge, taken off"), recorded on each Charge and Refund. | — | #169 |
| Landing > reviews | How do real Google reviews show on the landing page (#180)? Then: the order of its sections. | Six in a grid / one featured and three / a sideways strip | **One at a time, Previous and Next, centred** | B's single large quote, without the small boxes beside it ("too much text"), centred (left-aligned read awkwardly). Five reviews of similar length, so the strip doesn't leave a gap under the shorter ones. Every review is in the HTML for search engines and with JavaScript off; a few lines of script add Previous, Next (wrapping round) and "2 of 5"; it never moves on its own. Sections now: Hero, What we clean, Why Empire, What our Clients say, Save 10%, How it works (just above the form it starts), Request a Quote. Every section title is centred (the title only; the content keeps its alignment) | [`prototype-reviews`](https://github.com/CristianCrane/empire-cleaning/tree/prototype-reviews) | #180 |

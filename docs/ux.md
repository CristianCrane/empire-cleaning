# UX rules

The rules every screen keeps, whatever its area. Storybook's Patterns (`packages/ui/src/Patterns.stories.tsx`) shows most of them live.

## Principles

- **Least Client friction.** Pick what takes the Client the fewest steps, and name any trade-off that adds one.
- **Figures the owner edits are concrete** (hours per room, not multipliers elsewhere); a combined figure has a worked example beside it.
- **Clear, focused, simple, peaceful**: the owner's design principles (2026-11-13).
- **A screen leads with what its reader came for**: a home, what's next; a money page, whether anything is owed; a Cleaner's list, where they're working. Behind a tap: "How it's worked out", folds, and rarer actions behind the arrow or ⋯. Details are on the detail page, not its row.

## Screen types

Seven types, each drawn by its layout in `packages/ui/src/layouts/` (ADR-0031): Record, List, Home, Form page, Settings, Message page, Calendar. A screen never places its header, title row, actions or foot bar, nor a facts grid: `pnpm lint` (`empire/screen-layout`) fails it. A screen's type is on its screen-map entry; one that fits no type is a new type, settled as Changing a screen says.

### Record

- At most two alerts, most pressing first (danger, warning, info, success), the rest behind "Show N more". An action's failure is a Toast, not a Notice. The exception is Client portal > Your card: a retried payment turned down again is said in the alert already there ("We tried it again.", #508).
- The details card shows what it is, large, behind its tile (DateTile when, IconTile what, Avatar who), never what the title says (a Staff member's leads with their role, #548 U46). Time, address and contact are facts, not parts. It takes as many columns as its facts need, so none sits alone (`factColumns`, #553).
- Each part is a Section, its action on its title line. An empty part offers its action (`ActionRow`), unless that action is the page's next step, when the part waits. Each action shows once.
- Money is one part: one line a fact, "How it's worked out" folded. A Job's price changes are their own part, after How it went.
- History is a Timeline in a Card, newest first, last, one column at every width (#493: a side column competed with the page). It holds what happened, told there and not kept as a row elsewhere (a drop-out, a Cleaner taken off); what's booked is a part of its own, soonest first.
- A History entry says what happened, then when, then what it was about ("Standard Clean $194.89 · 2 cleaners · for Mon, Jan 12, 9:00 AM"); a Job's says more after a colon, never on a third line.
- A home's History is the exception: it lists its records (Quote, Job, Site visit), each with its state as a badge, dated when sent or when it took place; telling it as events is #555 (#548 U33).
- On a phone the next step is pinned at the foot above the tab bar, the rest behind its arrow in a sheet; wider, it's in the header. Greyed, it says why in a line above it.

### List

- The title is in a phone's bar, with no breadcrumbs, and at most one primary, for making a new one.
- Tabs are the one way it splits, each with its count, and no All (Retired and Deactivated are Tabs). The Tab, the search and how many are shown are in the URL, so Back keeps them. It opens on the first Tab holding anything, or, where the server pages (Office > Jobs, Office > Clients), on its first.
- Search is on the Office's work lists only: at the end of the Tabs' line, a field from md and an icon on a phone, never a row of its own. It searches every Tab: the Tabs step aside for "N found in every tab", rows say where each stands, with Clear search; no match says so, with Clear search.
- An Office list is a Table from md and rows on a phone; the Client's and Cleaner's are rows at every width.
- Dated rows go by month at every width. A row leads with a small DateTile, weekday and time, then what this reader tells rows apart by: the Office the Client (address and service under), a Cleaner the postcode (service under), a Client the kind of clean (the home only when they have more than one).
- A badge only off the Tab's usual case (Needs cleaners, never Staffed); a Status column only while a row has one.
- 50 rows at a time, then "Show more (N left)". Empty, the primary sits in an `EmptyState`; with nothing to add, one quiet line.

### Home

- "Hi, <first name>" heads an area's first page.
- One answer card (`AnswerCard`) holds the page's one primary; what waits on the reader leads, money owed first. A card that needs a reason gets an alert between the greeting and the card saying why; the card says what to do; each fact once (#493 D2).
- News sits under it: info Notices, never an action.
- Two to four tiles (two a row on a phone, one row from sm), each with a hint. A tile whose rows have a List page links there, else opens them in place, one at a time, pressed again to close; a tile with none is greyed; the open one is in `?open=`.
- What waits on a Client stays a tile unless the card holds it. Past lists are on their own pages.

### Form page

- One page action, at the title row's end, its failure a Toast; alerts as a Record's.
- What needs explaining is folded under a line saying what it is; nothing else explains (a field's own description stays).
- The whole form is one Card: what they came for open, every other part one line of what's set, opening in place (`FormPart`), and opening itself when a field in it is wrong. A stepped form keeps Back and Next.
- An aside says what the fields come to, sticky in a 22rem column from xl, after the card below it. With an aside the page is the content's width; without one, a form's.
- A price the form is written to reach leads, first below xl; until what sets it is known, it says what's missing, not a number. The aside holds totals only, each working folded; what sets a price stays in its part.
- The button is at the card's foot, after what saving agrees to. A form with a price or a Send makes its button the page's next step (#493 D1): from md the header's primary, whether it's saved beside it; the sticky header carries title, total (below xl only) and button; on a phone an `ActionFooter`, total and saved state left, button right.
- What's said before the button comes after the card; a line answering its press takes the focus as it shows (Notice's `answers`, #534).
- A next step beside a form that isn't its own button is the page's next step, the form's button staying secondary at its foot (#534 U23).
- Outside an area (Welcome) it's its own page: logo above, who's signed in under it on a phone and beside it from sm, centred at a form's width, no aside.
- A form the owner tweaks to see what it does stays one form, its example beside it. A form making a new version saves on press; one being written saves as it changes. The header's action and the form's save never run at once: each shows pending while the other runs.
- A save from an older version is refused and the form shows the newer one (#447): "Something changed just then. Please check it and try again.", the page reloads under it, and the form or dialog starts from what was saved, the message kept (`useDraftOf`). The screen keeps no copy of the rule: it reloads on any failed save.

### Settings

- The title is in a phone's bar, with at most one muted line, its version ("Version 7 · saved Nov 3 by Jen"), and no pointer to a page the nav has. Alerts say what's waiting, never explain; nothing on the first view explains.
- One card of summary rows, each one line of what it's set to; a tap opens its dialog: what it's for, its figures, and what saving does, above Save ("Quotes already sent keep their prices"). Read first, then changed part by part.
- A list of rows (`SettingsList`) is a Section each, Add on its title line, retired ones folded under "Retired (N)".

### Message page

- A centred narrow card: a large IconTile, title, one line, at most one Button (what fixes it), home a text link, and no detail a Client can't use. In an area it sits inside its frame; elsewhere it's its own page, logo above.
- Sign in is a form in the same card: Google first, a line for someone new under it, then the landing site's Privacy policy and Terms of service (#462).

### Calendar

- Office > Schedule's alone. It shows a day, three days or a week: a day at first on a phone (room for a client's name), three wider, then the span last chosen in that browser; a month for a Cleaner's availability (Office > Staff member). Jobs are timed events, ready for a Google Calendar sync.
- A block leads with its client's name, wrapping where it has the height, always shown (cut at a short block's foot), the time under it where there's room, read out first to a screen reader. A Job's state is a mark beside the name (its icon and colour; a Staffed Job none), its words read out; a Site Visit has its own icon, not colour alone.
- Crew names show only when someone's on it, one a line; a block draws only lines that fit whole ("Cory Cl…" names no one). The key draws each state as a block (#493 G4.1).
- A dragged block shows a picture of itself and an outline its size where it would land, snapped, in its own colours (see-through fill, dashed edge), red where the server's rules refuse it: a Job needs hours and a crew free; a Site Visit a time not passed, its visitor's hours or Office Staff, a crew free and busy with nothing else; both end by midnight. A day with no time fades.
- A Job drags while booked and not started; a Site Visit while booked, even past its time, so a missed one moves on. Either move is confirmed first.

## Page structure

- Breadcrumbs run from the area's nav section down, every step.
- The status badge says where it stands for this reader now; where two states hold, the one waiting on them (a Client's clean Needs your OK, Move asked; a visited Site Visit To record), in its rows' words (#493 G3.1, #507).
- A subtitle only when nothing else says it (Client portal > Your quote: open until when), never the title, a crumb, a fact below (a Bill's week) or the Client again.
- Page actions are one split button: the next step primary, the rest behind its arrow ("More actions": a menu from md, a sheet on a phone; the arrow outlined while the next step waits disabled). A quiet ⋯ when nothing's next; one action with nothing next stays a Button. A page whose only action destroys has no primary: that action is `danger-outline`, in the same place. Destructive actions go last, in red, after a rule.
- Short of room, the badge drops under the title, then the button, so the title breaks only where it can't fit alone (#534 U6).
- From md the header sticks once the window's top reaches the title row's actions: title, badge and the same actions, lined up with the page's column, with room for what the step rests on (a Form page's price below xl, saved state); a List's New stays on its row. Printed, the title alone.
- Every page in an area keeps AppLayout's readable column, `max-w-5xl` (960 px). A Record fills it and its `ActionFooter` lines up, as does a Form page with an aside (#493 G4.4); a Record gets no narrower cap (the user's pick, drawn on Office > Job). A Form page with no aside is a form's width, header too.
- What loads holds its room (`ChoiceTilesLoading`).
- Sections, not Cards, go around Lists and Tables: a title on the page above an untitled Card or List.
- The landing site's bands alternate plain then raised by place, not section (`band.ts`); a card takes its band's other colour; the Quote form is always on a raised band.

## Navigation

- A phone's tab bar holds at most five all-day shortcuts; the ☰ drawer (from the left, logo at its head) is the full menu, shortcuts too (#305). The Office's tab bar keeps Office > Today and Office > Schedule.
- From lg the sidebar lists every section; from md to lg a rail, each icon's name always shown (a touch tablet never hovers, and an icon alone doesn't say what it is), the current one highlighted, a rule between groups, a count in its name (Cleaner > Offers).
- Nav groups (`NavItem.group`) go busiest first, with no heading: the Office's Today and Schedule, then Work (Jobs, Quotes), People (Clients, Staff), Pricing (Services, Prices).
- The Client portal's nav is Home · Cleans · Payments · Your details, homes and plans under Your details, and no list of Quotes (#153).
- The account's parts sit at the menu's foot in every area, under a divider, one plain item each, never behind a dialog: name and email, the other language (Client portal and Cleaner area), Switch to, Show tips again, Sign out, the theme. A phone's top bar is the ☰ and the section.
- The rail is the exception (#493): the other language on it, the rest behind one Account popover at its foot, no logo or area heading.
- The language changes in one press, the other language named in its own words ("Español" / "English"), so someone who can't read the screen finds it: the sidebar's foot, the rail, the ☰'s foot. It writes every Client and Staff member the person is (ADR-0025).
- Loading in the frame: after 200 ms a thin brand bar runs and the page on show fades to half, a screen reader hearing "Loading…" once; the old page takes no press from the press that leaves it; it and its nav section stay until the next is ready; the nav stays live. A quicker load, an in-page change (search, Tab, Office > Schedule's week) or a reload after a save shows nothing.
- Links preload on hover, focus or press-down (`preload.ts`).

## Buttons and actions

- The foot bar is an `ActionFooter` the layout places, never a page's own sticky bar (that pinned under the tab bar, #425); a sheet's pinned Buttons are the sheet's. Summary left, main action right. The layout test fails a button or link under a fixed bar.
- Buttons rank by fill: primary filled, secondary outlined, `text` for a Section's actions, `danger-text` beside them, a lone destructive one `danger-outline`, `danger` filled only in its confirming dialog, `quiet` only to back out.
- A Section's actions are text Buttons on its title line, no taller; on a phone they wrap under it.
- Red is for what can't be got back: End plan, Cancel bill, Deactivate (the places it frees on Jobs don't come back). Not red: declining a quote (`quiet`, as the Client can ask again; its confirm the dialog's primary), the Office's Turn down of a move (the Job stays booked), a Service's Retire (Offer again), Office > Draft quote's Remove <weekday> (nothing sent or booked is lost). The Office's Turn down of a quote is red: it closes the Client's quote for good on the Office's word.
- An action a wait holds back stays, greyed, saying why where it's pressed (under its menu item, or above a phone's foot). A dialog opened before the wait refuses on the press, in the tone of the page's alert for it, keeping what was typed; the refusal goes once the wait is over (Office > Bill's `WhyNot`, #534).
- Continue with Google is Google's own button (its colours light and dark, logo, Roboto); only the 44 px height is ours.

## Notices

- A Notice holds at most one action, a text Button right of its text, never primary, never the page's next step; two things are two Notices.
- Tone: warning waits on someone, danger failed or late, info waits on us, success done (as Status and colour). A payment not approved at the Client's bank is a warning on the Client's pages (trying again is theirs) and danger on Office > Job and Office > Bill (nothing there is the Office's to do, and the money isn't coming) (#534).
- An alert's lead is bold only when more follows; a lead that's the whole alert is plain (`whyAlert`, #534).

## First-time help

- First-time help is a spotlight tour, never a Notice or checklist card, so nothing shifts the layout: one to three steps, each beside its target (`startTour`), once per screen, run only when every target is on screen and not greyed.
- Targets are found by the screen's own words, never `data-tour`; the tours spec fails when one isn't found.
- Each area's one line of value leads the first tour a person meets. Closing partway counts as seen; Show tips again brings them all back.

## Dialogs and rows

- A row holds no Buttons; pressing it opens one dialog. What's done to something that opens nothing (a crew member) is in the page's actions menu, named for whom ("Take Cory Cleaner off"): an ✕ by a face sat mid-card (#493).
- A dialog has at most two Buttons, one filled, one quiet, plus the ✕. Its title and Buttons stay in view while the middle scrolls; a sheet on a phone, centred from sm; its title says which dialog (#493). It places its own Actions row, with its line only while something lies under it.
- Never a dialog on a dialog: a second look is a step inside it, and a picker sits in it, the dialog made wide if need be.

## Lists and tables

- A to-do row leads with what to do (Send a quote, Find cleaners), a toned IconTile for its kind; a row that only shows keeps the name as its title.
- A row's title and line wrap, never cut; on a phone its badge sits under its text (#305).
- A row's line is parts set apart by dots, each whole (`Line`), no dot at its start or end (#548). What belongs together is one part (a Service and its price, a name and its role). Parts after the first read on in lower case (`inLine`). A text-only slot (a TimelineItem's title, an email's line) takes `lineOf`; a slot taking more than text takes `Line` ("Apartment · 2 bedrooms · 1.5 bathrooms" ran a 320px Quote sideways: `propertyParts`).
- A number stays with its word and a time with its AM/PM, by a no-break space where the words are made (web's `count`, models' time formats), on every screen and email (#548, #534 U19).
- Figures in a column (`Figures`) are at most 28rem from the card's start, each value at the column's end (the user's pick B, #548); on a phone or a narrower card, the card's width, a long label wrapping.
- Lean rows: the fewest columns that drive the decision (who, where, status, money, age), and no cell whose meaning changes from row to row.
- A dated row (`DatedItem`) says its date in words to a screen reader; the tile is only seen.
- An empty place offers what fills it (`EmptyState` with its action), never repeating its Section's description.

## Forms

- Forms ask quietly, a few at a time: tinted fields with a bottom line; SegmentedControl, ChipGroup or ChoiceTiles for short choices; optional fields behind "+ Add …"; long forms in steps, who's asking last. The Office on the phone gets one page, in a call's order.
- A form starts blank for someone new (an answer picked for them says something about their place they never said), each required answer asked before Next. A place on file starts at what's recorded; a form one person fills often (the Office's) at their usual answers (#493 G2.3).
- A form keeps a form's width (42rem, `max-w-form`) and a field its answer's (the user on #493's Welcome at 1440: "too wide for a form field to span"): a Form page with no aside and its header, a form's dialog, the landing Quote form's band. No field box or SegmentedControl track is wider. On a phone every field is full width.
- From sm a short field is sized to hold its longest answer whole (`Field.tsx`'s `width`): ~8 characters 9rem, ~14 13rem, a few words 20rem. A `FieldRow` is no wider than a form, its columns 13rem or more; ChoiceTiles are a form's width.
- A date and its start time share a `packed` FieldRow; in a dialog moving a booked time, Pick from the schedule sits under them on the same left edge (the user on #527: "breaking symmetry and balance").
- Every search field shows a magnifying glass.

## Time and schedules

- A time is picked from the free times, the day and time fields kept as the keyboard's way.
- Office > Draft quote's proposed time is picked in its part, in a tap (`office/OpenTimePicker.tsx`, #493, the user's pick B): a week's strip, a shut day saying why ("No cleaners" when no Cleaner works it, as its fix is more hours; "No room" when it's full), then the viewed day's start times with room, under "Open times on Tue, Jan 6". Back is off where the page before has no day to come.
- The time picked shows when it ends, or its problem; where the problem is the offered Service's, a line names it and the nearest time with room for both (by midnight), with "Pick that time". Paged away from it, a line and "Show it".
- A plan's new weekday comes with no time, for the weekday asked, and pages its own weekday's dates. The fields are behind "Type a date and time". The part folds to its time on load when it's set, has room and can be sent, and again when a weekday's added or removed. It pages with the kit's `Stepper`.
- The Office's dialogs moving a booked time (a Job, a plan's visit, a Site Visit) pick on the Schedule (`office/SchedulePicker.tsx`, inline in a wide dialog) until #543. Office > Draft quote's and the Client's lists of times are the kit's `TimeTiles`.
- A Client picks a day on a month, then its open times (`screens/AvailabilityPicker.tsx`). Clients never see the Schedule or anyone else's Jobs.

## Status and colour

- A status is the same colour everywhere: info; success, done or running as it should; warning, needs someone; danger, went wrong; neutral, not going ahead.
- One icon per concept, in `screens/icons.ts` (a Quote is `ClipboardPenLine`).

## The logo

- The logo is used exactly as drawn (`Logo`): never redrawn, cropped, recoloured beyond its dark version, or put in a lockup; where it doesn't fit, the screen changes.
- On a phone the top bar names the section and the logo heads the ☰ menu; the sidebar centres it; the rail has none. The landing site has no header bar: language, Sign in and theme sit top right.
- The landing site's hero leads with what we clean and where; the logo goes up into the header, smaller, and the slogan below the headline (#505).
- A section is named once on a phone: its own page hides its heading there (`Heading inBar`); a heading that says more stays (a greeting, a Job's or a Quote's name).
- The favicon is its own mark: the logo's roof and window with its skyline, no background, light or dark.

## Changing a screen

1. **Ask** what the screen is for, and what's wrong with it now.
2. **Prototype** on a `prototype-<screen>` branch off main, which has the kit (#502): made-up data for every state, usually three layouts. Push it and keep it as the record; it never becomes a PR. A package it adds stays on its branch, as main would carry a dependency nothing uses, which `pnpm lint:unused` (knip) turns down. How to make and run one: `packages/web/README.md`, Prototypes.
3. **Pick** one with the user, noting any tweaks.
4. **Build** on a `ux-<screen>` branch, through its type's layout (a change to every screen of a type is a change to its layout), with its tests: e2e on phone and desktop, axe light and dark (`expectAccessible`), the layout test at every width, and a Guest's, Client's or Cleaner's screen in Spanish too (`expectFitsInBoth`). Moving a screen onto its layout drops nothing by accident (#432's review found three drops, #434's two more); a part dropped on purpose says why in the PR.
5. **Record**, each as a note to the doc curator now, not an edit: the pick on its screen-map entry, a new screen's entry, a new rule with its why, and a Storybook pattern if it carries over.

Steps 2 and 3 are for a new flow or a new look only. Any other change has its design reviewed before its code (the `ui` skill's Settling a screen), and is still recorded.

# Office screens

Their files are in `packages/web/src/screens/office/`.

## Office > Today

`/office?open=` (`Dashboard.tsx`), Home: the first to-do, then to-dos and the day counted by kind. Keeps: the card, the server's first to-do; one waiting on the Client says so, only opening it; Money counts all owed, the card's too (#508 U8, the user's call), as an amount (#507).

## Office > Schedule

`/office/schedule?from=&to=` (`ScheduleScreen.tsx`), Calendar: booked Jobs and free Staff hours over a range of days.

## Office > Jobs

`/office/jobs?tab=&q=&shown=` (`JobsScreen.tsx`), List: every Job.

## Office > Job

`/office/jobs/$jobId` (`JobScreen.tsx`), Record: its crew, moves and cancelling; once done, price changes and corrections. Keeps: the badge is the Office's side, none if staffed before its day; Correct the condition never primary; alerts say only what the badge can't, without buttons; the client's free-to-move time named as theirs.

## Office > Quotes

`/office/quotes?tab=&q=` (`QuotesScreen.tsx`), List: every Quote. Keeps: loaded whole and searched in the browser (#109); no Total on Requested until a search spans the Tabs.

## Office > New quote

`/office/quotes/new?clientId=` (`NewQuoteScreen.tsx`), Form page: a Quote taken on the phone. Keeps: one page, the price beside it (#164).

## Office > Quote

`/office/quotes/$quoteId` (`QuoteScreen.tsx`), Record: its story (Now on top), acceptance, the add-a-card email. Keeps: under Asked, a Guest's ask's source (#185) and stated rooms or Condition, "the client said …" (#251); options' own extras (#244); a resend names what changed, not to what, in the Draft's words and order (`revisionChanges`, #548).

## Office > Draft quote

`/office/quotes/$quoteId/draft` (`QuoteScreen.tsx`), Form page: a change being written. Keeps: Send prices afresh, refused by new prices (#244); "Type" on a one-off, "Service" on a plan (#527); the one asked for leads, the recommended an aside till picked (#534 U2); a price card a plan weekday, each with its own hours.

## Office > Clients

`/office/clients?tab=&q=&shown=` (`ClientsScreen.tsx`), List: every Client. Keeps: status Tabs, opening on Active, the server paging it (#117).

## Office > Client

`/office/clients/$clientId` (`ClientDetail.tsx`), Record: contact details, homes, Condition correction; for a business, weekly billing and Bills. Keeps: the title outside the Card (#119); a Google review fact only once one's asked for (#175).

## Office > Property

`/office/properties/$propertyId` (`PropertyScreen.tsx`), Record: a home or premises, with its details, cleaning plan, Site Visit and history. Keeps: History entries dated to the day and time.

## Office > Ended cleaning plan

`/office/service-plans/$planId` (`ServicePlanScreen.tsx`), Record: a plan that has ended; while it runs, the path redirects to Office > Property.

## Office > Site visit

`/office/site-visits/$visitId` (`SiteVisitScreen.tsx`), Record: moving or cancelling it, recording what it found. Keeps: its findings are part of the visit (#156).

## Office > Bill

`/office/bills/$billId` (`BillScreen.tsx`), Record: voiding it while unpaid, recording a payment made another way. Keeps: one card, read like an invoice (#157); "Charged to their card" for the saved card, whichever press took it (#508); no alert gives the amount, which is the total.

## Office > Staff

`/office/staff?tab=` (`StaffScreen.tsx`), List: everyone, and inviting someone. Keeps: no Card (#160).

## Office > Staff member

`/office/staff/$staffId` (`StaffMemberScreen.tsx`), Record: their usual week, days off and extra days; deactivating them. Keeps: the month as a calendar (#160); its hours dialogs name the places on Jobs saving frees, and a Site Visit that blocks it (#242).

## Office > Prices

`/office/price-list` (`PriceListScreen.tsx`), Settings: the Price List, and the Services each extra goes with.

## Office > Services

`/office/services?tab=` (`ServicesScreen.tsx`), List: every Service, retired ones on a Tab.

## Office > Service, New service

`/office/services/new` and `/office/services/$serviceKey` (`ServicesScreen.tsx`), Form page: a Service's figures. Keeps: one form, its worked example a Quote (#163).

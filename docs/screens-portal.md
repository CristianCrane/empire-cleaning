# Client portal screens

Their files are in `packages/web/src/screens/portal/`.

## Client portal > Home

`/portal` (`PortalHome.tsx`), Home: what's next. Keeps: a date tile and shortcut tiles (#153); its card, alert, News and tiles in the order `whats-next.ts` holds (#493, #534).

## Client portal > Cleans

`/portal/cleans?tab=` (`PortalCleans.tsx`), List: upcoming and past cleans. Keeps: a clean's length is the plan card's while each runs as its weekday's; once one doesn't, a one-length plan gives every row its length, a several-length plan only that clean's.

## Client portal > Payments

`/portal/payments?open=` (`PortalPayments.tsx`), Home: what's owed, then every payment. Keeps: owed money asking nothing is a calm info card, "Payment pending", its link outlined; in All payments a Deposit going through is Payment pending, one refunded unbooked listed by its quote; nothing waiting, what's taken next, never "all paid up" (#508).

## Client portal > Your details

`/portal/details` (`PortalDetails.tsx`), Settings: contact details and homes. Keeps: a home's quote that waits on nothing of theirs stands as on Client portal > Home's card, in its order (#534).

## Client portal > Your card

`/portal/payment-method` (`PortalPaymentMethod.tsx`), Form page: adding or replacing it. Keeps: Try this card again for a declined card only (an expired one asks for another), one payment a press, the bank's approval asked in place (#508 U17, U18); the page's next step once their bank turned one down (#534 U23).

## Client portal > Request a quote

`/portal/request` (`PortalRequest.tsx`), Form page: for a new home or one of theirs.

## Client portal > Clean

`/portal/jobs/$jobId` (`PortalJob.tsx`), Record: moves, cancelling, its receipt, price changes, paying. Keeps: next step, the first asking something, none while a move is asked or once cancelled; a payment we retry: "Payment pending", "Nothing you need to do."; the receipt's quoted price only when a change makes the total differ.

## Client portal > Your quote

`/portal/quotes/$quoteId` (`PortalQuote.tsx`), Record: accepting it in one step, or declining. Keeps: read like a Quote, paying under it (#165); a plan's weekdays alike in all a price card draws share one card titled with each ("Mondays at 9:00 AM and Wednesdays at 1:00 PM · Standard Clean"), as two cards alike say each price twice.

## Client portal > Your plan

`/portal/plans/$planId` (`PortalPlan.tsx`), Record: its terms, what's coming, asking to change or ending it. Keeps: its headline, then facts across (#153).

## Client portal > A home

`/portal/properties/$propertyId` (`PortalProperty.tsx`), Record: its details and access, its plans and quotes. Keeps: a quote that waits on nothing of theirs is said as on Client portal > Home's card (#534).

## Client portal > Bill

`/portal/bills/$billId` (`PortalBill.tsx`), Record: printing and paying it. Keeps: one card, read like an invoice (#157); "Paid on this page" only for a card or account typed there, as a printed Bill is their record, else "Charged to your card"; a refused saved card offered a card's fix only (#508).

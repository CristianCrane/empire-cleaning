# The app works out each Cleaner's pay, and the Office sends it

The app works out each Cleaner's Pay Sheet for a Pay Week from the Jobs done and who was on them, gross, as Cleaners are contractors. The Office checks it, pays each Cleaner its own way (cash, Zelle, check), and marks the Pay Sheet paid. The app moves no money to a Cleaner. ADR-0004 stands: the Payment Gateway gains no way to send money. So does ADR-0009: a Cleaner's reported extra time still only changes the Client's price.

We chose this on 2026-11-11 over the app sending pay through Stripe Connect, the only way found for the app to send pay, at a monthly fee the business isn't ready to pay. What reopening it starts from:

- **Cost.** $2 an active account a month, plus 0.25% + $0.25 a payout: about $55 to $58 a month for 6 Cleaners paid about $600 a week each ([Connect pricing](https://stripe.com/connect/pricing)). Unconfirmed: whether a further 0.25% of payout volume is added.
- **The balance.** Transfers come from the business's Stripe balance, which its automatic payouts empty ([minimum balances](https://docs.stripe.com/payouts/minimum-balances-for-automatic-payouts)), so it needs a minimum balance, manual payouts, or a top-up of up to 5 business days before each week's pay ([top-ups](https://docs.stripe.com/connect/top-ups)).
- **1099s.** Stripe files each 1099-NEC at $2.99 a form and $1.49 for a state ([tax reporting](https://docs.stripe.com/connect/get-started-tax-reporting)).
- **Unconfirmed.** Whether Stripe allows Connect only to pay one's own contractors, for Stripe support first ([restricted businesses](https://stripe.com/legal/restricted-businesses) doesn't list it); whether onboarding asks for a full SSN or ITIN, and how its page's language is chosen ([hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding)); whether passed-on tips belong in a 1099's total, a tax preparer's to say ([calculation methods](https://docs.stripe.com/connect/calculation-methods)).
- **Other services.** QuickBooks Contractor Payments: no API or import confirmed, so the Office would type each payment again ([its page](https://quickbooks.intuit.com/payroll/contractor-payments/)). Gusto's API is for partners ([its docs](https://docs.gusto.com/app-integrations/docs/introduction)).

Two more paths were turned down:

- **Recording when a crew arrives and leaves.** A web page reads a phone's location only while open on screen, and it can be faked. Trusted Cleaners tapping Start (Timekeepers) needs one on every crew, which a solo Job lacks, and is one more tap per Job. So pay is worked from the Schedule: a Job counts from the time it was booked for to the end of its time on site, and the Office corrects one Cleaner's times when the day went otherwise.
- **Recording cash and Zelle tips.** That money is already in the crew's hands, and recording it is work for nobody's gain. Only a card Tip goes on a Pay Sheet.

## Consequences

- A Pay Sheet records that it was paid and how, on the Office's word: the app can't know the money arrived.
- The Office still does its own 1099s; a Pay Sheet shows each Cleaner's total for the year so far.
- A Tip is a Charge like any other (ADR-0004), reaching the Cleaners with their pay, less the provider's fee.
- Nothing here waits on Stripe.
- A crew is paid a Job's scheduled time unless the Office corrects it. The time a Job was marked Completed is shown beside it, so the Office can see when its estimates run short.
- Whether a No Access visit is paid is the owner's to answer (#206).
- This is worth reopening when paying by hand costs more than about $55 a month of someone's time, or the business wants pay to arrive without the Office: start with the question to Stripe support. Arrival tracking is worth it only with a native Cleaner app (ADR-0002), which can tell in the background when a phone reaches a Property and leaves.

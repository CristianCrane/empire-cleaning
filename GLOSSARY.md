# Empire Cleaning

A cleaning business serving residential and commercial clients with one-off and recurring cleaning work, from first enquiry through to delivered cleans.

## People

**Client**:
A person or business Empire Cleaning has a relationship with, from their first Quote Request onward, whether or not they have bought anything.
_Avoid_: Customer, user, lead

**Property**:
A physical location where cleaning happens, belonging to exactly one Client.
_Avoid_: Address, site, location

**Staff**:
A person working for Empire Cleaning, holding the Cleaner role, the Office Staff role, or both.
_Avoid_: Employee, admin, user

**Cleaner**:
A Staff role: carries out Jobs on site.
_Avoid_: Technician, worker, crew member

**Office Staff**:
A Staff role: prices Quotes, manages the Schedule and Assignments, and chases Unpaid Jobs. One person may hold both this and the Cleaner role.
_Avoid_: Admin, manager, dispatcher

**Guest**:
An unidentified visitor who has not signed in, typically submitting a Quote Request.
_Avoid_: Anonymous user, visitor

## Quoting

**Quote Request**:
A Client's or Guest's description of the cleaning they want, submitted to ask for pricing.
_Avoid_: Enquiry, lead, quote

**Quote**:
A priced offer from Empire Cleaning in response to a Quote Request, covering exactly one Job or one Service Plan, with a price, an estimated duration and a proposed time. A Quote Request may receive several Quotes, but a Quote, once sent, is never changed.
_Avoid_: Estimate, proposal

**Quote status**:
A Quote is _Draft_ (being written by Staff), _Sent_, or closed as _Accepted_, _Declined_, _Expired_ (its validity period, 14 days unless set otherwise, or its proposed time has passed) or _Superseded_ (replaced by a newer Quote for the same Quote Request).
_Avoid_: Pending, approved, rejected, revised

## Work

**Job**:
A single cleaning visit at one Property, booked for a confirmed date and time.
_Avoid_: Booking, appointment, clean

**Service Plan**:
An agreed recurring arrangement at one Property that generates Jobs on a set recurrence. Its terms change only by accepting a new Quote.
_Avoid_: Subscription, contract, recurring job

**Completed**:
A Job is Completed when the assigned Staff mark it done on site; this is what triggers its Balance Charge.
_Avoid_: Done, finished, closed

**No Access**:
The outcome of a Job where Staff could not get into the Property; it is not Completed and is charged like a Late Cancellation.
_Avoid_: Lockout, missed job, no-show

**Late Cancellation**:
A Client cancelling or rescheduling a Job less than 24 hours before it starts; the fee is the Job's Deposit amount.
_Avoid_: No-show, short-notice cancellation

**On Hold**:
A Service Plan that is temporarily generating no new Jobs until its Client resolves an Unpaid Job.
_Avoid_: Paused, suspended

**Ended**:
A Service Plan permanently stopped by its Client; it never generates Jobs again.
_Avoid_: Cancelled, terminated, closed

**Schedule**:
The calendar of all booked Jobs.
_Avoid_: Calendar, roster, bookings

**Assignment**:
The allocation of specific Staff to carry out a Job, made separately from, and possibly after, booking it. A Job with no Assignment is _Unassigned_ and cannot be Completed.
_Avoid_: Dispatch, crew allocation

## Payment

**Payment Method**:
A Client's saved means of payment, captured when they accept a Quote.
_Avoid_: Card, billing details

**Deposit**:
A partial payment, taken when a Quote is accepted, that must succeed before anything is booked onto the Schedule. A Job's Deposit counts towards its price; a Service Plan holds one Deposit for its whole life, applied to its final Job when it Ends.
_Avoid_: Down payment, prepayment, booking fee

**Balance**:
What is charged when a Job is Completed: its price including Adjustments, less any Deposit already paid. A negative Balance is refunded.
_Avoid_: Remainder, final payment, outstanding amount

**Charge**:
Money taken from a Client's Payment Method, either a Deposit or a Balance.
_Avoid_: Payment, invoice, bill

**Adjustment**:
A recorded change to a Job's quoted price, with a reason, made by the assigned Staff at completion; increases need the Client's approval on site.
_Avoid_: Surcharge, discount, extra

**Unpaid**:
A Completed Job whose Balance Charge has failed and not yet been recovered.
_Avoid_: Overdue, outstanding, failed payment

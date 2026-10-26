# Empire Cleaning

A cleaning business serving residential and commercial clients with one-off and recurring cleaning work, from first enquiry through to delivered cleans.

## People

**Client**:
A person or business Empire Cleaning has a relationship with, from their first Quote Request onward, whether or not they have bought anything.
_Avoid_: Customer, user, lead

**Property**:
A physical location where cleaning happens, belonging to exactly one Client. One address is one Property per Client, however it is typed; separate units in a building (apartments, floors) are separate Properties. Its price-affecting details are as first given and only Office Staff correct them.
_Avoid_: Address, site, location

**Access Instructions**:
How Staff get into and around a Property, such as gate codes, key location and pets; maintained by the Client and shown to Staff assigned to its Jobs.
_Avoid_: Entry notes, access notes, directions

**Staff**:
A person working for Empire Cleaning, holding the Cleaner role, the Office Staff role, or both. Staff exist only by invitation from Office Staff, who can also deactivate them.
_Avoid_: Employee, admin, user

**Cleaner**:
A Staff role: carries out Jobs on site.
_Avoid_: Technician, worker, crew member

**Office Staff**:
A Staff role: prices Quotes, manages the Schedule and Assignments, and chases Unpaid Jobs. One person may hold both this and the Cleaner role.
_Avoid_: Admin, manager, dispatcher

**Account**:
A sign-in identity with a proven email, created only when a person signs up by emailed link or Google, never on their behalf. Anyone may sign up. Being a Client or Staff member is separate: an Account is connected to a Client, a Staff member, or both, automatically when its proven email matches theirs, and that connection is what lets its holder act as them. Once made, a connection stays even if either email later changes. A Quote Request creates a Client, not an Account.
_Avoid_: User, login, profile

**Guest**:
An unidentified visitor who has not signed in, typically submitting a Quote Request.
_Avoid_: Anonymous user, visitor

## Quoting

**Quote Request**:
A Client's or Guest's description of the cleaning they want, submitted to ask for pricing. A Guest's first Quote Request creates their Client; one from a Guest using an existing Client's email is added to that Client, without changing their details. A Property has at most one Quote Request waiting at a time.
_Avoid_: Enquiry, lead, quote

**Turned Down**:
A Quote Request that Office Staff have closed without quoting, with a recorded reason such as out of area, out of scope or no capacity. It is final; the Client must submit a new Quote Request.
_Avoid_: Declined, rejected, refused

**Quote**:
A priced offer from Empire Cleaning in response to a Quote Request, covering exactly one Job or one Service Plan, with a price, Labour Hours, a Crew Size and a proposed time. A Quote for a First Clean offers both Clean Types, each with its own price and Labour Hours, and the Client picks one on acceptance. A Quote Request may receive several Quotes, but a Quote, once sent, is never changed.
_Avoid_: Estimate, proposal

**Price List**:
The prices and pricing rules Office Staff maintain, from which every Suggested Price is calculated. Its rates are before tax, while Clients always see prices including tax; it holds separate tax rates for one-off Jobs, Service Plan Jobs and fees, and any Add-on may be tax-exempt. Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Rate card, pricing table, tariff

**Suggested Price**:
The price the system calculates for a Quote: the Labour Hours estimated for the Property, Condition, Clean Type and Add-ons, multiplied by the residential or commercial hourly rate on the Price List, and never below the Minimum Charge. Office Staff may override it to any price, giving a reason.
_Avoid_: Estimate, calculated price, list price

**Minimum Charge**:
The lowest Suggested Price the system will produce for a Job; set on the Price List, currently $100. Office Staff may still override a price below it.
_Avoid_: Call-out fee, minimum fee, floor price

**Labour Hours**:
The total Staff time a Job is estimated to take, regardless of how many Staff do it; the basis of both the Suggested Price and Schedule availability.
_Avoid_: Duration, man-hours, job length

**Crew Size**:
The number of Staff a Quote plans to send; the Job's time on site is its Labour Hours divided by its Crew Size.
_Avoid_: Team size, headcount

**Condition**:
How dirty a Property currently is: _light_, _moderate_ or _heavy_. Stated by the Client in a Quote Request, correctable by Staff, and reported by Cleaners when they complete a Job. Service Plan Quotes assume moderate unless Staff set otherwise.
_Avoid_: State, dirtiness, level

**Add-on**:
A priced extra task, such as cleaning inside the oven, agreed on a Quote before a Job; distinct from an Adjustment made on the day. Clients choose Add-ons by name in a Quote Request and see what each costs on the Quote. Office Staff retire an Add-on rather than delete it, so requests that chose it still price it.
_Avoid_: Extra, upgrade, option

**Preferred Service Area**:
A set of postcodes close enough to Staff that Empire Cleaning prefers to work there. Distance never changes a price; whether to take on work outside these areas is Office Staff's call.
_Avoid_: Coverage area, zone, territory

**Site Visit**:
A free, scheduled visit by Staff to see a Property before quoting it; required for commercial Properties and optional for residential ones. It is not a Job.
_Avoid_: Walkthrough, inspection, assessment

**Quote status**:
A Quote is _Draft_ (being written by Staff), _Sent_, or closed as _Accepted_, _Declined_, _Expired_ (its validity period, 14 days unless set otherwise, or its proposed time has passed) or _Superseded_ (replaced by a newer Quote for the same Quote Request).
_Avoid_: Pending, approved, rejected, revised

## Work

**Job**:
A single cleaning visit at one Property, booked for a confirmed date and time.
_Avoid_: Booking, appointment, clean

**Service Plan**:
An agreed recurring arrangement at one Property that generates Standard Clean Jobs on a set recurrence. It can only start once that Property has a Completed First Clean, and its terms change only by accepting a new Quote.
_Avoid_: Subscription, contract, recurring job

**First Clean**:
The one-off Job that every Property must have Completed before a Service Plan can start there; a Deep Clean is recommended, but the Client may choose a Standard Clean.
_Avoid_: Initial clean, onboarding clean, intro clean

**Clean Type**:
How thorough a Job is: either a _Deep Clean_ (bringing a Property up to standard) or a _Standard Clean_ (routine, less thorough and cheaper).
_Avoid_: Service level, package, tier

**Completed**:
A Job is Completed when the assigned Staff mark it done on site; this is what triggers its Balance Charge.
_Avoid_: Done, finished, closed

**No Access**:
The outcome of a Job where Staff could not get into the Property; it is not Completed and is charged like a Late Cancellation.
_Avoid_: Lockout, missed job, no-show

**Reschedule Request**:
A Client's proposal to move a booked Job to a new available time, which is held for them while pending. The Job keeps its original time until Office Staff confirm the move, after which its Assignments are Offered afresh; Office Staff may instead turn it down, and the Client may withdraw it. One made less than 24 hours before the Job is a Late Reschedule (ADR-0010).
_Avoid_: Reschedule, rebooking, change request

**Late Cancellation**:
A Client cancelling a Job less than 24 hours before it starts, or moving it by a second Late Reschedule; the fee is the Job's Deposit amount (ADR-0010).
_Avoid_: No-show, short-notice cancellation

**Late Reschedule**:
A Reschedule Request made less than 24 hours before the Job starts, judged when it is made. The first one confirmed for a Job is free and its Deposit still counts towards the price; any later one confirmed for the same Job is a Late Cancellation, though the Job still moves (ADR-0010).
_Avoid_: Late move, short-notice reschedule

**On Hold**:
A Service Plan that is temporarily generating no new Jobs until its Client resolves an Unpaid Job.
_Avoid_: Paused, suspended

**Ended**:
A Service Plan permanently stopped by its Client; it never generates Jobs again.
_Avoid_: Cancelled, terminated, closed

**Schedule**:
The calendar of all booked Jobs. Office Staff may move a booked Job that hasn't started straight to a new time with room for it; this is their own action, not a Reschedule Request, so it costs the Client nothing, but like a confirmed request it Offers the Job's Assignments afresh and tells the Client and the crew.
_Avoid_: Calendar, roster, bookings

**Available Hours**:
The hours a Cleaner can work on a day: their usual hours for that weekday, unless Office Staff have set different hours for that date, such as 0 for a holiday. A day has room for a booking when its Cleaners' Available Hours, less the Labour Hours of Jobs already booked that day, cover the booking's Labour Hours. Days are Empire Cleaning's own, in New York.
_Avoid_: Capacity, shifts, roster

**Assignment**:
The allocation of a specific Staff member to carry out a Job, made separately from, and possibly after, booking it. An Assignment is _Offered_ until the Staff member _Confirms_ it or _Releases_ it; Releasing frees that place on the Job. A Job is _Unassigned_ until all its places are Confirmed, and cannot be Completed while Unassigned.
_Avoid_: Dispatch, crew allocation, accept, decline

## Payment

**Payment Method**:
A Client's saved means of payment, captured when they accept a Quote.
_Avoid_: Card, billing details

**Deposit**:
A partial payment, taken when a Quote is accepted, that must succeed before anything is booked onto the Schedule. A Job's Deposit counts towards its price; a Service Plan holds one Deposit for its whole life, applied to its final Job when it Ends.
_Avoid_: Down payment, prepayment, booking fee

**Balance**:
What is charged when a Job is Completed: its price including Adjustments, less any Deposit already paid. A negative Balance is refunded. An increase the Client approves after completion is charged then, as the rest of the Balance.
_Avoid_: Remainder, final payment, outstanding amount

**Charge**:
Money taken from a Client's Payment Method, either a Deposit or a Balance.
_Avoid_: Payment, invoice, bill

**Plan Discount**:
A reduction, 10% unless set otherwise on the Quote, on the base price of each Job a Service Plan generates, compared with the same visit as a one-off Job, including any recurring Add-ons on the plan. It does not apply to Adjustments or to the First Clean.
_Avoid_: Loyalty discount, subscription discount, recurring rate

**Adjustment**:
A recorded change to a Job's quoted price, with a reason, from what the assigned Staff report at completion: an Add-on done on the day, a quoted Add-on not done, or extra time. Staff never set amounts: each is priced from the Price List the Job's Quote used. Reductions count at once; an increase counts only once Office Staff have proposed it and the Client has approved it in the portal, within 7 days (ADR-0009).
_Avoid_: Surcharge, discount, extra

**Unpaid**:
A Completed Job whose Balance, or part of it, failed to be charged and has not yet been recovered.
_Avoid_: Overdue, outstanding, failed payment

# Empire Cleaning

A cleaning and property services business serving residential and commercial clients with one-off and recurring work, such as cleaning and painting, from a first Quote through to delivered Jobs.

## People

**Client**:
A person or business Empire Cleaning has a relationship with, from first asking for a Quote onward, whether or not they have bought anything. A business has a business name, and the Client's name, email and phone are those of the person Empire Cleaning deals with there. Office Staff may enter one for a caller with just a name and phone: without an email they can't sign in or be sent a Quote until Office Staff add one (ADR-0012).
_Avoid_: Customer, user, lead

**Property**:
A physical location where Empire Cleaning works, belonging to exactly one Client. One address is one Property per Client, however it is typed; separate units in a building (apartments, floors) are separate Properties. A Property is either _residential_, a home described by its rooms, or _commercial_, business premises described by their Premises Type and floor area. Its price-affecting details are as first given and only Office Staff correct them, from a Site Visit or otherwise.
_Avoid_: Address, site, location

**Premises Type**:
What kind of business premises a commercial Property is, such as office, retail or medical; it makes cleaning its floor area take longer or shorter, for any Service priced by area that Condition affects (ADR-0018). Office Staff keep the list on the Price List and retire a Premises Type rather than delete it.
_Avoid_: Business type, sector, category

**Access Instructions**:
How Staff get into and around a Property, such as gate codes, key location and pets; maintained by the Client and shown to Staff assigned to its Jobs.
_Avoid_: Entry notes, access notes, directions

**Staff**:
A person working for Empire Cleaning, holding the Cleaner role, the Office Staff role, or both. Staff exist only by invitation from Office Staff, who can also deactivate them.
_Avoid_: Employee, admin, user

**Cleaner**:
A Staff role: carries out Jobs on site, of any Service.
_Avoid_: Technician, worker, crew member

**Office Staff**:
A Staff role: prices Quotes, manages the Schedule and Assignments, and chases Unpaid Jobs. One person may hold both this and the Cleaner role.
_Avoid_: Admin, manager, dispatcher

**Account**:
A sign-in identity with a proven email, created only when a person signs up by emailed link or Google, never on their behalf. Anyone may sign up. Being a Client or Staff member is separate: an Account is connected to a Client, a Staff member, or both, automatically when its proven email matches theirs, and that connection is what lets its holder act as them. Once made, a connection stays even if either email later changes. Asking for a Quote creates a Client, not an Account, and a Client the Office entered without an email has none to connect until one is added.
_Avoid_: User, login, profile

**Guest**:
An unidentified visitor who has not signed in, typically asking for a Quote.
_Avoid_: Anonymous user, visitor

## Quoting

**Quote**:
Empire Cleaning's priced offer for one Property, from the moment it's asked for or Office Staff start it through to its outcome. It keeps what the Client asked for, unchanged, and its Revisions; the latest Sent Revision is the offer. It is either a _one-off Quote_, for a single Job of one Service, the one asked for unless Office Staff change it, also offering the Service it recommends instead for a first visit when the Property has no Completed Job, for the Client to pick one on acceptance; or a _Service Plan Quote_, for a Service Plan of one Service, offering a visit on each of its days, each with its own time and Crew Size, at the Plan Discount and accepted whole (ADR-0013, ADR-0018). Its first Revision sets which. A Guest's first Quote creates their Client; one from a Guest using an existing Client's email is added to that Client, without changing their details. Office Staff may start one for a caller, recording what they asked, with no receipt sent, or offer a Service Plan Quote nobody asked for (ADR-0017). A Service Plan Quote can only be offered once the Property's First Clean is Completed, or, for a Service that needs a Site Visit, once one has recorded its findings; no Quote for such a Service can be Sent before then (ADR-0014, ADR-0018). A Property has at most one open one-off Quote for each Service, and one open Service Plan Quote.
_Avoid_: Quote Request, enquiry, lead, estimate, proposal

**Revision**:
One priced version of a Quote: its Service, price, Labour Hours, Crew Size and proposed time, and for a Service priced by area the area, or for a Service Plan Quote its visits. Office Staff draft a Revision and send it; once Sent it is never changed, and a newer Sent Revision takes its place as the offer. Clients only ever see the latest Sent Revision.
_Avoid_: Version, offer, Superseded Quote

**Turned Down**:
A Quote that Office Staff have closed before sending any Revision, with a recorded reason such as out of area, out of scope or no capacity. It is final; the Client asks for a new Quote.
_Avoid_: Declined, rejected, refused, withdrawn

**Service**:
Something Empire Cleaning sells, such as a _Standard Clean_, a _Deep Clean_, a move-out clean, commercial cleaning or painting; Office Staff keep the list, and retire a Service rather than delete it. Each is offered for homes, businesses or both, has its own hourly rate, Minimum Charge and tax rates, and is priced either from a home's rooms, at so many hours for each, or by area, at so many hours per 1,000 sq ft. It also says whether Condition affects it, whether it can be on a Service Plan, whether a Quote for it needs a Site Visit, and which Service, if any, to recommend in its place for a first visit (ADR-0018). Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Clean Type, service type, offering, package, tier

**Price List**:
The pricing rules Office Staff maintain alongside the Services, from which, with a Service, every Suggested Price is calculated: the Condition multipliers, the Premises Types, the Add-ons, the Deposit percentage, Plan Discount, validity period and usual Crew Size, and the tax rate for fees. Prices are before tax, while Clients always see prices including tax; tax rates for Jobs are on each Service, and any Add-on may be tax-exempt. Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Rate card, pricing table, tariff

**Suggested Price**:
The price the system calculates for a Quote: the Labour Hours estimated for its Service, Property, Condition and Add-ons, multiplied by the Service's hourly rate, and never below its Minimum Charge. A Service priced from a home's rooms adds up its own hours for each; one priced by area works from the area on the Revision, with the Premises Type for business premises (ADR-0018). Office Staff may override it to any price, giving a reason.
_Avoid_: Estimate, calculated price, list price

**Minimum Charge**:
The lowest Suggested Price the system will produce for a Job of a Service; set on each Service. Office Staff may still override a price below it.
_Avoid_: Call-out fee, minimum fee, floor price

**Labour Hours**:
The total Staff time a Job is estimated to take, regardless of how many Staff do it; the basis of both the Suggested Price and Schedule availability.
_Avoid_: Duration, man-hours, job length

**Crew Size**:
The number of Staff a Quote plans to send; the Job's time on site is its Labour Hours divided by its Crew Size.
_Avoid_: Team size, headcount

**Condition**:
How dirty a Property currently is: _light_, _moderate_ or _heavy_; it affects only the Services that say so. Stated by the Client when asking for a Quote, correctable by Staff, and reported by Cleaners when they complete a Job. Service Plan Quotes assume moderate unless Staff set otherwise.
_Avoid_: State, dirtiness, level

**Add-on**:
A priced extra task, such as cleaning inside the oven, agreed on a Quote before a Job; distinct from an Adjustment made on the day. Each is offered with particular Services. Clients choose Add-ons by name when asking for a Quote and see what each costs on it. Office Staff retire an Add-on rather than delete it, so Quotes that asked for it still price it.
_Avoid_: Extra, upgrade, option

**Preferred Service Area**:
A set of postcodes close enough to Staff that Empire Cleaning prefers to work there. Distance never changes a price; whether to take on work outside these areas is Office Staff's call.
_Avoid_: Coverage area, zone, territory

**Site Visit**:
A free, scheduled visit by one Staff member to see a Property for a Quote, before its first Revision is Sent; required for a Service that needs one and optional otherwise (ADR-0018). It is not a Job: it is never charged and has no Assignments, though it appears on the Schedule (ADR-0015). Office Staff book, move and cancel it, telling the Client each time. It ends _Done_, when its findings (for business premises, the Premises Type, floor area and Condition) are recorded on the Property, or _Cancelled_. Office Staff may record findings as already done without a visit, for premises they know.
_Avoid_: Walkthrough, inspection, assessment

**Quote status**:
A Quote is _Requested_ (asked for by a Client, no Revision yet), _Draft_ (its first Revision being written by Staff), _Sent_, or closed as _Accepted_, _Declined_ (by the Client), _Expired_ (its latest Revision's validity period, 14 days unless set otherwise, or its proposed time has passed) or _Turned Down_. Drafting changes to a Sent Quote leaves it Sent. Office Staff may revive an Expired Quote by sending a new Revision; the others are final.
_Avoid_: Pending, approved, rejected, Superseded

## Work

**Job**:
A single visit at one Property, of one Service, booked for a confirmed date and time.
_Avoid_: Booking, appointment, clean

**Service Plan**:
An agreed recurring arrangement at one Property for one Service that can be on a plan, generating Jobs of it on a set recurrence: either on one day of the week every week, every 2 weeks or every 4 weeks, or every week on several days (ADR-0013, ADR-0018). Each of its days has its own time and its own visit: Labour Hours, Crew Size and price. It can only start once that Property has a Completed First Clean, or, for a Service that needs a Site Visit, once one has recorded its findings (ADR-0014, ADR-0018). Its terms change only by accepting a new Service Plan Quote for the Property, which the Client can ask for: from that Quote's proposed time, its booked Jobs are cancelled free and it carries on on the new terms, its Jobs before then going ahead as they were and its Deposit carrying over. A Client skips one of its Jobs by cancelling it, under the usual rules, and the plan carries on. Having one never stops the Property getting one-off Quotes.
_Avoid_: Subscription, contract, recurring job

**First Clean**:
The first one-off Job Completed at a Property of a Service that can be on a Service Plan, which a Property must have before a Service Plan can start there, unless its Service needs a Site Visit: a trial for both sides, in which the Client sees how Empire Cleaning works and Empire Cleaning checks the Property is as described before committing to recurring work. A Deep Clean is recommended, but the Client may choose a Standard Clean; a move-out clean or painting doesn't count.
_Avoid_: Initial clean, onboarding clean, intro clean

**Completed**:
A Job is Completed when the assigned Staff mark it done on site; this is what triggers its Balance Charge.
_Avoid_: Done, finished, closed

**No Access**:
The outcome of a Job where Staff could not get into the Property; it is not Completed and is charged like a Late Cancellation.
_Avoid_: Lockout, missed job, no-show

**Reschedule Request**:
A Client's proposal to move a booked Job to a new available time, which is held for them while pending. The Job keeps its original time until Office Staff confirm the move, after which its crew are Offered the new time afresh, keeping their places unless they aren't free then; Office Staff may instead turn it down, and the Client may withdraw it. One made less than 24 hours before the Job is a Late Reschedule (ADR-0010).
_Avoid_: Reschedule, rebooking, change request

**Late Cancellation**:
A Client cancelling a Job less than 24 hours before it starts, or moving it by a second Late Reschedule; the fee is the Job's Deposit amount (ADR-0010). A one-off Job's Deposit is kept as the fee. A plan Job has no Deposit of its own, so its fee is the plan's Deposit percentage of that Job's price, charged as a Charge of its own, and the plan's held Deposit is untouched (ADR-0013).
_Avoid_: No-show, short-notice cancellation

**Late Reschedule**:
A Reschedule Request made less than 24 hours before the Job starts, judged when it is made. The first one confirmed for a Job is free and its Deposit still counts towards the price; any later one confirmed for the same Job is a Late Cancellation, though the Job still moves (ADR-0010).
_Avoid_: Late move, short-notice reschedule

**On Hold**:
A Service Plan that is temporarily generating no new Jobs while any of its Jobs, or a Bill with any of its Jobs on it, is Unpaid; a Bill with a bank payment for it on its way holds nothing while it clears. Its Jobs already booked go ahead. Once nothing is Unpaid it carries on, from its next date still to come: dates that passed while it was On Hold are never booked. On Hold plans appear in Needs attention.
_Avoid_: Paused, suspended

**Ended**:
A Service Plan permanently stopped by its Client, or by Office Staff for them, at any time; it never generates Jobs again, and its Property may start a new plan. Ending it cancels its booked Jobs more than 24 hours away, free, and those within 24 hours go ahead. Its Deposit is applied to its final Job: the last that goes ahead or has happened, a Late Cancellation or No Access with a fee counting as having happened. That Job then counts the Deposit as its own, as a one-off Job does, and whatever the Deposit doesn't cover is still owed, while anything it doesn't need is refunded.
_Avoid_: Cancelled, terminated, closed

**Schedule**:
The calendar of all booked Jobs and Site Visits. Office Staff may move a booked Job that hasn't started straight to a new time with room for it; this is their own action, not a Reschedule Request, so it costs the Client nothing, but like a confirmed request it Offers the new time to the Job's crew afresh and tells the Client and the crew.
_Avoid_: Calendar, roster, bookings

**Available Hours**:
The hours a Cleaner can work on a day: their usual hours for that day of the week, unless Office Staff have set different hours for that date, such as 0 for a holiday. A booking has room when two rules hold. Hours: its day's Cleaners' Available Hours, less the Labour Hours of Jobs already booked that day, cover the booking's Labour Hours. Headcount: the Crew Sizes of the Jobs at work at the same time (their time on site, and the new times held for Reschedule Requests), plus the booking's own Crew Size, are no more than the number of Cleaners with Available Hours that day. A Site Visit by a Cleaner with Available Hours that day is booked like a Job with a Crew Size of one, its length as its Labour Hours; one by Office Staff alone takes no room. Anyone available that day is taken to be free at any time of it, and travel between homes isn't counted. Days are Empire Cleaning's own, in New York.
_Avoid_: Capacity, shifts, roster

**Assignment**:
The allocation of a specific Staff member to carry out a Job, made separately from, and possibly after, booking it. A Cleaner takes an Open Place by _Confirming_ it, or Office Staff _Offer_ a place to a named Cleaner, which holds it until they Confirm or _Release_ it; a Confirmed place may be Released until 48 hours before the Job. Releasing makes that place an Open Place again. A Job is _Unassigned_ until all its places are Confirmed, and cannot be Completed while Unassigned (ADR-0019).
_Avoid_: Dispatch, crew allocation, accept, decline

**Open Place**:
A place on a Job that no Assignment holds. Once the Job is within 7 days of starting, it is open to every Cleaner free for it, except any who said it's not for them, and the first to Confirm takes it. Free here is stricter than for Schedule room: Available Hours that day and no Job or Site Visit of theirs overlapping it (ADR-0019). Until they Confirm, a Cleaner sees only its Service, time, Crew Size and area.
_Avoid_: Vacancy, shift, open job, broadcast

## Payment

**Payment Method**:
A Client's saved means of payment, captured when they accept a Quote.
_Avoid_: Card, billing details

**Deposit**:
A partial payment, taken when a Quote is accepted, that must succeed before anything is booked onto the Schedule. A Job's Deposit counts towards its price; a Service Plan holds one Deposit for its whole life, the Deposit percentage of one Job on each of its days, applied to its final Job when it Ends (ADR-0013).
_Avoid_: Down payment, prepayment, booking fee

**Balance**:
What is charged when a Job is Completed: its price including Adjustments, less any Deposit already paid. A negative Balance is refunded. An increase the Client approves after completion is charged then, as the rest of the Balance. For a Client billed weekly, it goes on a Bill instead (ADR-0016).
_Avoid_: Remainder, final payment, outstanding amount

**Charge**:
Money taken from a Client's Payment Method: a Deposit, a Balance, a plan Job's Late Cancellation or No Access fee, or a Bill.
_Avoid_: Payment, invoice

**Plan Discount**:
A reduction, 10% unless set otherwise on the Quote, on the base price of each Job a Service Plan generates, compared with the same visit as a one-off Job, including any recurring Add-ons on the plan. It does not apply to Adjustments or to the First Clean.
_Avoid_: Loyalty discount, subscription discount, recurring rate

**Adjustment**:
A recorded change to a Job's quoted price, with a reason, from what the assigned Staff report at completion: an Add-on done on the day, a quoted Add-on not done, or extra time. Staff never set amounts: each is priced from the Price List and Service versions the Job's Quote used. Reductions count at once; an increase counts only once Office Staff have proposed it and the Client has approved it in the portal, within 7 days (ADR-0009).
_Avoid_: Surcharge, discount, extra

**Bill**:
Everything a commercial Client billed weekly owes for one week, Monday to Sunday: the Balances of their Jobs that started that week and were Completed, their fees, and approved Adjustments, as lines, made the following Monday (ADR-0016). It is charged to their saved Payment Method then, or, if Office Staff set it so, paid on its page by its due date. It never changes once made: mistakes are put right on the next Bill, and an unpaid one can be voided. One below zero is a credit on the next.
_Avoid_: Invoice, statement

**Unpaid**:
A Job whose Balance, or part of it, or whose fee failed to be charged and has not yet been recovered; or a Bill whose Charge failed, or that is still unpaid after its due date.
_Avoid_: Overdue, outstanding, failed payment

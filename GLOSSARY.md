# Empire Cleaning

A cleaning and property services business serving residential and commercial clients with one-off and recurring work, such as cleaning and painting, from a first Quote through to delivered Jobs.

## People

**Client**:
A person or business Empire Cleaning has a relationship with, from first asking for a Quote onward, whether or not they have bought anything. A business has a business name, and the Client's name, email and phone are those of the person Empire Cleaning deals with there. Office Staff may enter one for a caller with just a name and phone: without an email they can't sign in or be sent a Quote until Office Staff add one (ADR-0012).
_Avoid_: Customer, user, lead
_Spanish_: cliente

**Property**:
A physical location where Empire Cleaning works, belonging to exactly one Client. One address is one Property per Client, however it is typed; separate units in a building (apartments, floors) are separate Properties. A Property is either _residential_, a home described by its rooms, or _commercial_, business premises described by their Premises Type and floor area. A home asked about only for a Service not priced from rooms, such as painting, may have no rooms recorded until its Client, signed in, asks about it for one that is, or Office Staff record them. Its price-affecting details are as first given and only Office Staff correct them, from a Site Visit or otherwise.
_Avoid_: Address, site, location
_On screen_: home, or business for business premises; place where it can be either
_Spanish_: casa, or negocio for business premises; lugar where it can be either

**Premises Type**:
What kind of business premises a commercial Property is, such as office, retail or medical; it makes cleaning its floor area take longer or shorter, for any Service priced by area that Condition affects (ADR-0018). Office Staff keep the list on the Price List and retire a Premises Type rather than delete it.
_Avoid_: Business type, sector, category
_On screen_: type of business
_Spanish_: tipo de negocio

**Access Instructions**:
How Staff get into and around a Property, such as gate codes, key location and pets; maintained by the Client and shown to Staff assigned to its Jobs.
_Avoid_: Entry notes, access notes, directions
_On screen_: how we get in
_Spanish_: cómo entramos

**Staff**:
A person working for Empire Cleaning, holding the Cleaner role, the Office Staff role, or both. Staff exist only by invitation from Office Staff, who can also deactivate them.
_Avoid_: Employee, admin, user
_Spanish_: equipo

**Cleaner**:
A Staff role: carries out Jobs on site, of any Service.
_Avoid_: Technician, worker, crew member
_Spanish_: limpiador

**Office Staff**:
A Staff role: prices Quotes, manages the Schedule and Assignments, and chases Unpaid Jobs. One person may hold both this and the Cleaner role.
_Avoid_: Admin, manager, dispatcher
_On screen_: the office; us to a Client
_Spanish_: la oficina; nosotros to a Client

**Account**:
A sign-in identity with a proven email, created only when a person signs up by emailed link or Google, never on their behalf. Anyone may sign up. Being a Client or Staff member is separate: an Account is connected to a Client, a Staff member, or both, automatically when its proven email matches theirs, and that connection is what lets its holder act as them. Once made, a connection stays even if either email later changes. Asking for a Quote creates a Client, not an Account, and a Client the Office entered without an email has none to connect until one is added.
_Avoid_: User, login, profile
_Spanish_: cuenta

**Guest**:
An unidentified visitor who has not signed in, typically asking for a Quote.
_Avoid_: Anonymous user, visitor

**Preferred Language**:
The language, English or Spanish, a Client or Staff member is shown screens and sent messages in; the Office workspace is always English (ADR-0025). A Guest's first Quote sets it for the new Client from the language of the page they asked on, and a Quote added to an existing Client leaves it as it is (ADR-0012). Office Staff set it for a Client they enter or Staff they invite; anyone may change their own, which changes it on every Client and Staff member their Account is connected to. Text a person writes, such as Access Instructions or a reason, is shown as written.
_Avoid_: Locale, language setting
_Spanish_: idioma preferido

## Quoting

**Quote**:
Empire Cleaning's priced offer for one Property, from the moment it's asked for or Office Staff start it through to its outcome. It keeps what the Client asked for, unchanged, and its Revisions; the latest Sent Revision is the offer. It is either a _one-off Quote_, for a single Job of one Service, the one asked for unless Office Staff change it, also offering the Service it recommends instead for a first visit when the Property has no Completed Job, for the Client to pick one on acceptance; or a _Service Plan Quote_, for a Service Plan of one Service, offering a visit on each of its days, each with its own time and Crew Size, at the Plan Discount and accepted whole (ADR-0013, ADR-0018). Its first Revision sets which. A Guest's first Quote creates their Client; one from a Guest using an existing Client's email is added to that Client, without changing their details. Office Staff may start one for a caller, recording what they asked, with no receipt sent, or offer a Service Plan Quote nobody asked for (ADR-0017). A Service Plan Quote can only be offered once the Property's First Clean is Completed, or, for a Service that needs a Site Visit, once one has recorded its findings; no Quote for such a Service can be Sent before then (ADR-0014, ADR-0018). A Property has at most one open one-off Quote for each Service, and one open Service Plan Quote.
_Avoid_: Quote Request, enquiry, lead, estimate, proposal
_Spanish_: cotización

**Revision**:
One priced version of a Quote: its Service, price, Labour Hours, Crew Size and proposed time, and for a Service priced by area the area, or for a Service Plan Quote its visits. Office Staff draft a Revision and send it; once Sent it is never changed, and a newer Sent Revision takes its place as the offer. Clients only ever see the latest Sent Revision.
_Avoid_: Version, offer, Superseded Quote
_On screen_: none: it's the quote, which the Office changes ("Change quote") and sends again ("Quote sent"); a person never reads of a second quote
_Spanish_: none

**Turned Down**:
A Quote that Office Staff have closed before sending any Revision, with a recorded reason such as out of area, out of scope or no capacity. It is final; the Client asks for a new Quote.
_Avoid_: Declined, rejected, refused, withdrawn
_Spanish_: descartada

**Service**:
Something Empire Cleaning sells, such as a _Standard Clean_, a _Deep Clean_, a move-out clean, commercial cleaning or painting; Office Staff keep the list, and retire a Service rather than delete it. Each is offered for homes, businesses or both, has its own hourly rate, Minimum Charge and tax rates, and is priced either from a home's rooms, at so many hours for each, or by area, at so many hours per 1,000 sq ft. It also says whether Condition affects it, whether it can be on a Service Plan, whether a Quote for it needs a Site Visit, and which Service, if any, to recommend in its place for a first visit (ADR-0018). Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Clean Type, service type, offering, package, tier
_Spanish_: servicio

**Price List**:
The pricing rules Office Staff maintain alongside the Services, from which, with a Service, every Suggested Price is calculated: the Condition multipliers, the Premises Types, the Add-ons, the Deposit percentage, Plan Discount, validity period and usual Crew Size, and the tax rate for fees. Prices are before tax, while Clients always see prices including tax; tax rates for Jobs are on each Service, and any Add-on may be tax-exempt. Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Rate card, pricing table, tariff
_On screen_: prices

**Suggested Price**:
The price the system calculates for a Quote: the Labour Hours estimated for its Service, Property, Condition and Add-ons, multiplied by the Service's hourly rate, and never below its Minimum Charge. A Service priced from a home's rooms adds up its own hours for each; one priced by area works from the area on the Revision, with the Premises Type for business premises (ADR-0018). Office Staff may override it to any price, giving a reason.
_Avoid_: Estimate, calculated price, list price

**Minimum Charge**:
The lowest Suggested Price the system will produce for a Job of a Service; set on each Service. Office Staff may still override a price below it.
_Avoid_: Call-out fee, minimum fee, floor price
_On screen_: minimum price

**Labour Hours**:
The total Staff time a Job is estimated to take, regardless of how many Staff do it; the basis of both the Suggested Price and Schedule availability.
_Avoid_: Duration, man-hours, job length
_On screen_: cleaning hours
_Spanish_: horas de limpieza

**Crew Size**:
The number of Staff a Quote plans to send; the Job's time on site is its Labour Hours divided by its Crew Size.
_Avoid_: Team size, headcount
_On screen_: cleaners
_Spanish_: limpiadores

**Condition**:
How dirty a Property currently is: _light_, _moderate_ or _heavy_; it affects only the Services that say so. Stated by the Client when asking for a Quote, correctable by Staff, and reported by Cleaners when they complete a Job. The Property takes a Job's report while that Job is its latest Completed Job: completing an earlier Job late, or correcting or undoing one, leaves a later report standing. Undoing the latest gives back the Condition before its report, or an earlier Job's report made since. Service Plan Quotes assume moderate unless Staff set otherwise.
_Avoid_: State, dirtiness, level
_Spanish_: estado

**Add-on**:
A priced extra task, such as cleaning inside the oven, agreed on a Quote before a Job; distinct from an Adjustment made on the day. Each is offered with particular Services, and only those Services' prices on a Quote include it. Clients choose Add-ons by name when asking for a Quote. On the Quote, each costs what it adds to the price: nothing at the Minimum Charge, less any Plan Discount, and its share of an override. Office Staff retire an Add-on rather than delete it, so Quotes that asked for it still price it.
_Avoid_: Extra, upgrade, option
_On screen_: extra
_Spanish_: adicional

**Preferred Service Area**:
A set of postcodes close enough to Staff that Empire Cleaning prefers to work there. Distance never changes a price; whether to take on work outside these areas is Office Staff's call.
_Avoid_: Coverage area, zone, territory
_On screen_: the area we clean
_Spanish_: la zona donde limpiamos

**Site Visit**:
A free, scheduled visit by one Staff member to see a Property for a Quote, before its first Revision is Sent; required for a Service that needs one and optional otherwise (ADR-0018). It is not a Job: it is never charged and has no Assignments, though it appears on the Schedule (ADR-0015). Office Staff book, move and cancel it, telling the Client each time. It ends _Done_, when its findings (for business premises, the Premises Type, floor area and Condition) are recorded on the Property, or _Cancelled_. Office Staff may record findings as already done without a visit, for premises they know.
_Avoid_: Walkthrough, inspection, assessment
_Spanish_: visita previa

**Quote status**:
A Quote is _Requested_ (asked for by a Client, no Revision yet), _Draft_ (its first Revision being written by Staff), _Sent_, or closed as _Accepted_, _Declined_ (by the Client), _Expired_ (its latest Revision's validity period, 14 days unless set otherwise, has passed, or it's 24 hours or less before its proposed time, when cancelling would be a Late Cancellation; so it's sent only for a time more than 24 hours away) or _Turned Down_. Drafting changes to a Sent Quote leaves it Sent. Office Staff may revive an Expired Quote by sending a new Revision; the others are final.
_Avoid_: Pending, approved, rejected, Superseded

## Work

**Job**:
A single visit at one Property, of one Service, booked for a confirmed date and time.
_Avoid_: Booking, appointment, clean
_On screen_: job; clean to a Client, and in a message a Client may see too
_Spanish_: trabajo; limpieza to a Client, and in a message a Client may see too

**Service Plan**:
An agreed recurring arrangement at one Property for one Service that can be on a plan, generating Jobs of it on a set recurrence: either on one day of the week every week, every 2 weeks or every 4 weeks, or every week on several days (ADR-0013, ADR-0018). Each of its days has its own time and its own visit: Labour Hours, Crew Size and price. It can only start once that Property has a Completed First Clean, or, for a Service that needs a Site Visit, once one has recorded its findings (ADR-0014, ADR-0018). Its terms change only by accepting a new Service Plan Quote for the Property, which the Client can ask for: from that Quote's proposed time, its booked Jobs are cancelled free and it carries on on the new terms, its Jobs before then going ahead as they were (and still booked on the old terms as they come within reach, whether or not it was On Hold) and its Deposit carrying over. A Client skips one of its Jobs by cancelling it, under the usual rules, and the plan carries on. Having one never stops the Property getting one-off Quotes.
_Avoid_: Subscription, contract, recurring job
_On screen_: cleaning plan
_Spanish_: plan de limpieza

**First Clean**:
The first one-off Job Completed at a Property of a Service that can be on a Service Plan, which a Property must have before a Service Plan can start there, unless its Service needs a Site Visit: a trial for both sides, in which the Client sees how Empire Cleaning works and Empire Cleaning checks the Property is as described before committing to recurring work. A Deep Clean is recommended, but the Client may choose a Standard Clean; a move-out clean or painting doesn't count.
_Avoid_: Initial clean, onboarding clean, intro clean
_Spanish_: primera limpieza

**Completed**:
A Job is Completed when the assigned Staff mark it done on site; this is what triggers its Balance Charge.
_Avoid_: Done, finished, closed
_On screen_: done
_Spanish_: terminado

**No Access**:
The outcome of a Job where Staff could not get into the Property; it is not Completed and is charged like a Late Cancellation.
_Avoid_: Lockout, missed job, no-show
_On screen_: couldn't get in; its fee is a couldn't-get-in fee
_Spanish_: no se pudo entrar; its fee is a cargo por no poder entrar

**Reschedule Request**:
A Client's proposal to move a booked Job to a new available time, which is held for them while pending. The Job keeps its original time until Office Staff confirm the move, after which its crew are Offered the new time afresh, staying on it unless they aren't free then; Office Staff may instead turn it down, and the Client may withdraw it. If the Job stops being booked first (Cancelled, Completed or No Access), the request is closed unanswered, and the time held for it is freed; a held time also stops counting once the Job starts. One made less than 24 hours before the Job is a Late Reschedule (ADR-0010).
_Avoid_: Reschedule, rebooking, change request
_On screen_: request to move
_Spanish_: solicitud para reprogramar

**Late Cancellation**:
A Client cancelling a Job less than 24 hours before it starts (exactly 24 hours before is still free), or moving it by a second Late Reschedule; the fee is the Job's Deposit amount (ADR-0010). A one-off Job's Deposit is kept as the fee. A plan Job has no Deposit of its own, so its fee is the plan's Deposit percentage of that Job's price, charged as a Charge of its own, and the plan's held Deposit is untouched (ADR-0013).
_Avoid_: No-show, short-notice cancellation
_Spanish_: cancelación tardía

**Late Reschedule**:
A Reschedule Request made less than 24 hours before the Job starts, judged when it is made. The first one confirmed for a Job is free and its Deposit still counts towards the price; any later one confirmed for the same Job is a Late Cancellation, though the Job still moves (ADR-0010).
_Avoid_: Late move, short-notice reschedule
_On screen_: late move; its fee is a late move fee
_Spanish_: reprogramación tardía; its fee is a cargo por reprogramación tardía

**On Hold**:
A Service Plan that is temporarily generating no new Jobs while any of its Jobs, or a Bill with any of its Jobs on it, is Unpaid; a Bill with a bank payment for it on its way holds nothing while it clears. Its Jobs already booked go ahead. Once nothing is Unpaid it carries on, from its next date still to come: dates that passed while it was On Hold are never booked. On Hold plans appear in Needs attention.
_Avoid_: Paused, suspended
_On screen_: paused
_Spanish_: en pausa

**Ended**:
A Service Plan permanently stopped by its Client, or by Office Staff for them, at any time; it never generates Jobs again, and its Property may start a new plan. Ending it cancels, free, its booked Jobs 24 hours or more away, and any booked less than 24 hours before it starts (ADR-0010); the rest go ahead. Its Deposit is applied to its final Job: the last that goes ahead or has happened, a Late Cancellation or No Access with a fee counting as having happened. That Job then counts the Deposit as its own, as a one-off Job does, and whatever the Deposit doesn't cover is still owed, while anything it doesn't need is refunded.
_Avoid_: Cancelled, terminated, closed
_Spanish_: finalizado

**Schedule**:
The calendar of all booked Jobs and Site Visits. Office Staff may move a booked Job that hasn't started straight to a new time with room for it; this is their own action, not a Reschedule Request, so it costs the Client nothing, but like a confirmed request it Offers the new time to the Job's crew afresh and tells the Client and the crew.
_Avoid_: Calendar, roster, bookings
_Spanish_: calendario

**Available Hours**:
The hours a Cleaner can work on a day: their usual hours for that day of the week, unless Office Staff have set different hours for that date, such as 0 for a holiday. A day going to 0 frees what they hold that day: their Assignments on Jobs are Released, opening to other free Cleaners, while a Site Visit of theirs has to go to someone else first; fewer hours that aren't 0 keep them. Deactivating a Staff member frees their Assignments on every Job to come the same way. A booking has room when two rules hold. Hours: its day's Cleaners' Available Hours, less the Labour Hours of Jobs already booked that day, cover the booking's Labour Hours. Headcount: the Crew Sizes of the Jobs at work at the same time (their time on site, and the new times held for Reschedule Requests), plus the booking's own Crew Size, are no more than the number of Cleaners with Available Hours that day. A Site Visit by a Cleaner with Available Hours that day is booked like a Job with a Crew Size of one, its length as its Labour Hours; one by Office Staff alone takes no room. A Site Visit can't overlap a Job or another booked Site Visit of its visitor's: a Done one doesn't count against them, and one recorded Done before its time takes no room from then on. A clean ends by midnight, so each is on one day. Anyone available that day is taken to be free at any time of it, and travel between homes isn't counted. Days are Empire Cleaning's own, in New York.
_Avoid_: Capacity, shifts, roster
_On screen_: working hours

**Assignment**:
The allocation of a specific Staff member to carry out a Job, made separately from, and possibly after, booking it, which puts them on its crew. A Cleaner takes a Cleaner Needed by _Confirming_ it, or Office Staff _Offer_ the Job to a named Cleaner, who is on the crew until they Confirm or _Release_ it; a Confirmed Assignment may be Released until 48 hours before the Job. Releasing leaves a Cleaner Needed again. A Job is _Unassigned_ until its whole crew is Confirmed, and cannot be Completed while Unassigned (ADR-0019).
_Avoid_: Dispatch, crew allocation, accept, decline, holding a place
_On screen_: none: a cleaner is offered the job, confirms it, or drops out (the Office sees "Dropped out")
_Spanish_: none

**Cleaner Needed**:
One of a Job's Crew Size that no Assignment puts on its crew, as the Office sees it in "Needs 1 more cleaner". Once the Job is within 7 days of starting, it is open to every Cleaner free for it, except any who said it's not for them, and the first to Confirm takes it. Free here is stricter than for Schedule room: Available Hours that day and no Job or Site Visit of theirs overlapping it (ADR-0019). Until they Confirm, a Cleaner sees only its Service, time, Crew Size and area.
_Avoid_: Open Place, place, vacancy, shift, open job, broadcast
_On screen_: open job
_Spanish_: trabajo disponible

## Payment

**Payment Method**:
A Client's saved means of payment, captured when they accept a Quote.
_Avoid_: Card, billing details
_On screen_: card; card or bank where a bank account can pay too
_Spanish_: tarjeta; tarjeta o banco where a bank account can pay too

**Deposit**:
A partial payment, taken when a Quote is accepted, that must succeed before anything is booked onto the Schedule. A Job's Deposit counts towards its price; a Service Plan holds one Deposit for its whole life, the Deposit percentage of one Job on each of its days, applied to its final Job when it Ends (ADR-0013).
_Avoid_: Down payment, prepayment, booking fee
_Spanish_: depósito

**Balance**:
What is charged when a Job is Completed: its price including Adjustments, less any Deposit already paid. A negative Balance is refunded. An increase the Client approves after completion is charged then, as the rest of the Balance. For a Client billed weekly, it goes on a Bill instead (ADR-0016).
_Avoid_: Remainder, final payment, outstanding amount
_On screen_: the rest
_Spanish_: el resto

**Charge**:
Money taken from a Client's Payment Method: a Deposit, a Balance, a plan Job's Late Cancellation or No Access fee, a Bill, or a Tip.
_Avoid_: Payment, invoice
_On screen_: payment
_Spanish_: pago

**Plan Discount**:
A reduction, 10% unless set otherwise on the Quote, on the base price of each Job a Service Plan generates, compared with the same visit as a one-off Job, including any recurring Add-ons on the plan. It comes off after the Minimum Charge, so a plan visit can cost less than the Service's Minimum Charge. It does not apply to the First Clean, or to an Adjustment that adds to the price; a quoted Add-on not done comes off at what it added, after the Plan Discount.
_Avoid_: Loyalty discount, subscription discount, recurring rate
_Spanish_: descuento del plan

**Adjustment**:
A recorded change to a Job's quoted price, with a reason, from what the assigned Staff report at completion: an Add-on done on the day, a quoted Add-on not done, or extra time. Staff never set amounts: each is priced from the Price List and Service versions the Job's Quote used, a quoted Add-on not done at what it added to the quoted price. Reductions count at once; an increase counts only once Office Staff have proposed it and the Client has approved it in the portal, within 7 days (ADR-0009).
_Avoid_: Surcharge, discount, extra
_On screen_: price change
_Spanish_: cambio de precio

**Bill**:
Everything a commercial Client billed weekly owes for one week, Monday to Sunday: the Balances of their Jobs that started that week and were Completed, their fees, and approved Adjustments, as lines, made the following Monday (ADR-0016). It is charged to their saved Payment Method then, or, if Office Staff set it so, paid on its page by its due date. It never changes once made: mistakes are put right on the next Bill, and an unpaid one can be voided. One below zero is a credit on the next.
_Avoid_: Invoice, statement
_On screen_: bill; a voided one is cancelled
_Spanish_: factura; a voided one is cancelada

**Unpaid**:
A Job whose Balance, or part of it, or whose fee failed to be charged and has not yet been recovered; or a Bill whose Charge failed, or that is still unpaid after its due date.
_Avoid_: Overdue, outstanding, failed payment
_Spanish_: sin pagar

## Pay

**Pay Rate**:
What a Cleaner is paid for an hour of work: one for each Cleaner, set by Office Staff, and not a Service's hourly rate, which prices Quotes. A change counts from a date Office Staff pick, today unless they say otherwise; Jobs that started before it keep the old one. A Cleaner sees their own and never anyone else's. Cleaners are contractors, so pay is gross: the app keeps no tax back.
_Avoid_: Wage, salary, hourly rate
_Spanish_: paga por hora

**Job Rate**:
A higher rate of pay for one Job, by the hour as a Pay Rate is: Office Staff set it on a Job, or on a Service Plan so the Jobs it generates from then on carry it. It covers the time on that Job only, and each Cleaner on it is paid the higher of it and their own Pay Rate, so it never cuts anyone's pay. Office Staff may change it on a Job until a Cleaner on it is marked paid for that Pay Week. A Cleaner sees it before they Confirm. It is the only extra pay tied to a Job: there are no bonuses.
_Avoid_: Bonus, special rate, premium, hourly rate
_Spanish_: paga por hora del trabajo

**Timekeeper**:
A Cleaner Office Staff trust to record a Job's times: they tap Start when the crew arrives, and Completing the Job is its finish. Times a Timekeeper records count as they stand. Any other time (a Job with no Timekeeper on it, a Start nobody tapped, a Job Completed by a Cleaner who isn't one) is filled in from the Schedule and flagged for Office Staff to confirm or correct. Start records the time and nothing else, and a Job can be Completed without it. A phone's location isn't checked (ADR-0030). Only the Office reads the word.
_Avoid_: Trusted cleaner, lead, supervisor

**Pay Week**:
The week Cleaners are paid for, which the Office pays in the week after: the same week a Bill covers (Monday to Sunday, Empire Cleaning's own days, a Job in the week it started). The first is the first full week after pay goes live; Jobs before it have no recorded times and are never added.
_Avoid_: Pay period, payroll week
_Spanish_: semana de paga

**Pay Sheet**:
What one Cleaner is owed for one Pay Week, worked out by the app for Office Staff to check, pay outside the app, and mark paid (ADR-0030): each day's hours and pay, their share of Tips, any Other Pay, and the total. A day runs from their first Job's start to their last Job's finish, by the times recorded for each (Timekeeper), which Office Staff may correct for one Cleaner on one Job. The time between one Job's finish and the next one's start counts, at the Cleaner's own Pay Rate, when it is no longer than the gap length, and not at all when it is longer; the gap length is one setting Office Staff keep for everyone, an hour to start. So pay is not worked from Labour Hours, nor from an Adjustment's extra time, which still only changes the Client's price (ADR-0009); and it counts time between Jobs, which Schedule room doesn't (Available Hours). Time counts to the minute, and each day's pay is rounded to the cent. Office Staff mark it paid, saying how (cash, Zelle, check), which they can't do while a time on it is still flagged or the Cleaner has no Pay Rate. Once paid it never changes: a later correction goes on the next Pay Week as Other Pay. It also shows the Cleaner's total for the year so far. A Cleaner sees their own, and Office Staff can print one or export a Pay Week. Whether a No Access visit is paid, and for how much time, isn't decided yet (#206).
_Avoid_: Payroll, timesheet, payslip, pay stub, unpaid
_Spanish_: hoja de paga

**Other Pay**:
An amount Office Staff add to a Pay Sheet by hand, more or less, always with a note: a supply run, a correction to a week already paid. Apart from times, rates and the gap length, it is the only way pay changes.
_Avoid_: Adjustment, bonus, deduction, correction
_Spanish_: otra paga

**Tip**:
Money a Client adds by card for the Cleaners on a Job, from a link in its receipt: one for a Job, within 7 days of it. Clients billed weekly aren't asked. It is charged to their Payment Method, and the Cleaners Confirmed on the Job when it was Completed share it evenly, less the payment provider's fee on that Charge; Office Staff may change the shares of one. It goes on the Pay Sheets of the Pay Week it was charged in, not the Job's, so a late one never reopens a paid Pay Sheet. Office Staff can refund it until one of those Cleaners is marked paid for that week. Cash, and money sent to a Cleaner directly, is the crew's own and never recorded (ADR-0030). Not first-time help's tours, which screens call tips ("Show tips again").
_Avoid_: Gratuity, bonus
_Spanish_: propina

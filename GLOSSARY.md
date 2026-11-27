# Empire Cleaning

A cleaning and property services business serving residential and commercial clients with one-off and recurring work, such as cleaning and painting, from a first Quote through to delivered Jobs.

## People

**Client**:
A person or business Empire Cleaning has a relationship with, from first asking for a Quote onward, whether or not they have bought anything. A business Client has a business name; its name, email and phone are its contact person's. One entered without an email can't sign in or be sent a Quote until it has one (ADR-0012).
_Avoid_: Customer, user, lead
_Spanish_: cliente

**Property**:
A physical location where Empire Cleaning works, belonging to exactly one Client. One address is one Property per Client, however it is typed; separate units in a building (apartments, floors) are separate Properties. A Property is either _residential_, a home described by its rooms, or _commercial_, business premises described by their Premises Type and floor area.
_Avoid_: Address, site, location
_On screen_: home, or business for business premises; place where it can be either
_Spanish_: casa, or negocio for business premises; lugar where it can be either

**Premises Type**:
What kind of business premises a commercial Property is, such as office, retail or medical; it makes cleaning its floor area take longer or shorter, for any Service priced by area that Condition affects (ADR-0018). Office Staff keep the list on the Price List.
_Avoid_: Business type, sector, category
_On screen_: type of business
_Spanish_: tipo de negocio

**Access Instructions**:
How Staff get into and around a Property, such as gate codes, key location and pets; maintained by the Client. Only a Job's Confirmed Cleaners see them, on its day, and a Site Visit's visitor once it's booked (ADR-0019).
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
A sign-in identity with a proven email, created only when a person signs up by emailed link or Google, never on their behalf. Anyone may sign up. Being a Client or Staff member is separate: an Account is connected to a Client, a Staff member, or both, automatically when its proven email matches theirs, and that connection is what lets its holder act as them.
_Avoid_: User, login, profile
_Spanish_: cuenta

**Guest**:
An unidentified visitor who has not signed in, typically asking for a Quote.
_Avoid_: Anonymous user, visitor

**Preferred Language**:
The language, English or Spanish, a Client or Staff member is shown screens and sent messages in; the Office workspace is always English (ADR-0025).
_Avoid_: Locale, language setting
_Spanish_: idioma preferido

## Quoting

**Quote**:
Empire Cleaning's priced offer for one Property, from the moment it's asked for or Office Staff start it through to its outcome. It keeps what the Client asked for, unchanged, and its Revisions; the latest Sent Revision is the offer. It is either a _one-off Quote_, for a single Job of one Service, which may also offer the Service recommended for a first visit (ADR-0018); or a _Service Plan Quote_, for a Service Plan, accepted whole (ADR-0013). Its first Revision sets which.
_Avoid_: Quote Request, enquiry, lead, estimate, proposal
_Spanish_: cotización

**Revision**:
One priced version of a Quote: its Service, price, Labour Hours, Crew Size and proposed time, and for a Service priced by area the area, or for a Service Plan Quote its visits. Office Staff draft a Revision and send it; once Sent it is never changed, and a newer Sent Revision takes its place as the offer. Clients only ever see the latest Sent Revision.
_Avoid_: Version, offer, Superseded Quote
_On screen_: none: it's the quote, which the Office changes and sends again
_Spanish_: none

**Turned Down**:
A Quote that Office Staff have closed before sending any Revision, with a recorded reason such as out of area, out of scope or no capacity. It is final; the Client asks for a new Quote.
_Avoid_: Declined, rejected, refused, withdrawn
_Spanish_: descartada

**Service**:
Something Empire Cleaning sells, such as a _Standard Clean_, a _Deep Clean_, a move-out clean, commercial cleaning or painting; Office Staff keep the list. Each has its own hourly rate, Minimum Charge and tax rates, and is priced either from a home's rooms or by area (ADR-0018). Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Clean Type, service type, offering, package, tier
_Spanish_: servicio

**Price List**:
The pricing rules Office Staff keep alongside the Services, from which, with a Service, every Suggested Price is calculated; it also holds the tax rate for fees. Prices are before tax, while Clients always see prices including tax; any Add-on may be tax-exempt. Changing it never reprices Sent Quotes or existing Service Plans.
_Avoid_: Rate card, pricing table, tariff
_On screen_: prices

**Suggested Price**:
The price the system calculates for a Quote: Labour Hours times the Service's hourly rate, never below its Minimum Charge; Office Staff may override it, giving a reason.
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
How dirty a Property is: _light_, _moderate_ or _heavy_; given when a Quote is asked for and reported by Cleaners at completion; it affects only the Services that say so.
_Avoid_: State, dirtiness, level
_Spanish_: estado

**Add-on**:
A priced extra task agreed on a Quote before a Job, unlike an Adjustment made on the day; each is offered with particular Services.
_Avoid_: Extra, upgrade, option
_On screen_: extra
_Spanish_: adicional

**Preferred Service Area**:
Where Empire Cleaning prefers to work, close enough to Staff; no list of places is kept, so whether a Property is outside it is Office Staff's call, and a reason to Turn Down its Quote. Distance never changes a price.
_Avoid_: Coverage area, zone, territory
_On screen_: the area we clean
_Spanish_: la zona donde limpiamos

**Site Visit**:
A free visit by one Staff member to see a Property for a Quote, before its first Revision is Sent; required for a Service that needs one, optional otherwise; not a Job: never charged, no Assignments, but on the Schedule (ADR-0015, ADR-0018); it ends _Done_, its findings recorded on the Property, or _Cancelled_.
_Avoid_: Walkthrough, inspection, assessment
_Spanish_: visita previa

**Quote status**:
A Quote is _Requested_ (asked for by a Client, no Revision yet), _Draft_ (its first Revision being written by Staff), _Sent_, or closed as _Accepted_, _Declined_ (by the Client), _Expired_ (its validity period has passed, or it's 24 hours or less before its proposed time) or _Turned Down_.
_Avoid_: Pending, approved, rejected, Superseded

## Work

**Job**:
A single visit at one Property, of one Service, booked for a confirmed date and time.
_Avoid_: Booking, appointment, clean
_On screen_: job; clean to a Client, and in a message a Client may see too
_Spanish_: trabajo; limpieza to a Client, and in a message a Client may see too

**Service Plan**:
An agreed recurring arrangement at one Property for one Service that can be on a plan, generating Jobs of it on a set recurrence: either on one day of the week every week, every 2 weeks or every 4 weeks, or every week on several days (ADR-0013, ADR-0018). Each of its days has its own time and its own visit: Labour Hours, Crew Size and price. Its terms change only by accepting a new Service Plan Quote.
_Avoid_: Subscription, contract, recurring job
_On screen_: cleaning plan
_Spanish_: plan de limpieza

**First Clean**:
The first one-off Job Completed at a Property of a Service that can be on a Service Plan, which the Property needs before a plan can start there unless its Service needs a Site Visit (ADR-0014): a trial for both sides.
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
A Client's proposal to move a booked Job to a new time, held for them while pending; the Job keeps its time until Office Staff confirm it, or turn it down, or the Client withdraws it; one less than 24 hours before is a Late Reschedule (ADR-0010).
_Avoid_: Reschedule, rebooking, change request
_On screen_: request to move
_Spanish_: solicitud para reprogramar

**Late Cancellation**:
A Client cancelling a Job less than 24 hours before it starts (exactly 24 hours before is still free), or moving it by a second Late Reschedule (ADR-0010). A one-off Job's Deposit is kept as the fee; a plan Job's fee is the plan's Deposit percentage of its price (ADR-0013).
_Avoid_: No-show, short-notice cancellation
_Spanish_: cancelación tardía

**Late Reschedule**:
A Reschedule Request made less than 24 hours before the Job starts, judged when it is made. The first one confirmed for a Job is free and its Deposit still counts towards the price; any later one confirmed for the same Job is a Late Cancellation, though the Job still moves (ADR-0010).
_Avoid_: Late move, short-notice reschedule
_On screen_: late move; its fee is a late move fee
_Spanish_: reprogramación tardía; its fee is a cargo por reprogramación tardía

**On Hold**:
A Service Plan that is temporarily generating no new Jobs while any of its Jobs, or a Bill with any of its Jobs on it, is Unpaid. Its booked Jobs go ahead; it carries on from its next date once nothing is Unpaid.
_Avoid_: Paused, suspended
_On screen_: paused
_Spanish_: en pausa

**Ended**:
A Service Plan permanently stopped by its Client, or the Office for them; its booked Jobs 24 hours or more away are cancelled free and its Deposit goes to its final Job (ADR-0010, ADR-0013).
_Avoid_: Cancelled, terminated, closed
_Spanish_: finalizado

**Schedule**:
The calendar of all booked Jobs and Site Visits. Office Staff may move a booked Job that hasn't started straight to a new time with room for it, which, unlike a Reschedule Request, costs the Client nothing.
_Avoid_: Calendar, roster, bookings
_Spanish_: calendario

**Available Hours**:
The hours a Cleaner can work on a day: their usual hours for that day of the week, unless Office Staff have set different hours for that date, such as 0 for a holiday.
_Avoid_: Capacity, shifts, roster
_On screen_: working hours

**Assignment**:
A Cleaner put on a Job's crew, made separately from booking it: a Cleaner _Confirms_ a Cleaner Needed, or Office Staff _Offer_ the Job to one, who Confirms or _Releases_ it; a Job is _Unassigned_ until its whole crew is Confirmed, and can't be Completed till then (ADR-0019).
_Avoid_: Dispatch, crew allocation, accept, decline, holding a place
_On screen_: none: a cleaner is offered the job, confirms it, or drops out (the Office sees "Dropped out")
_Spanish_: none

**Cleaner Needed**:
One of a Job's Crew Size that no Assignment fills; within 7 days of the Job it is open to every free Cleaner but any who Released it or said it's not for them, and the first to Confirm takes it (ADR-0019).
_Avoid_: Open Place, place, vacancy, shift, open job, broadcast
_On screen_: open job; in a Job's crew, Needed ("1 of 2 confirmed, 1 needed")
_Spanish_: trabajo disponible; in a Job's crew, Falta ("1 de 2 confirmados, falta 1")

## Payment

**Payment Method**:
A Client's saved means of payment: a card, or a bank account where one can pay.
_Avoid_: Card, billing details
_On screen_: card; card or bank where a bank account can pay too
_Spanish_: tarjeta; tarjeta o banco where a bank account can pay too

**Deposit**:
A partial payment taken when a Quote is accepted, before anything is booked; it counts towards a Job's price, and a Service Plan holds one for its whole life (ADR-0001, ADR-0013).
_Avoid_: Down payment, prepayment, booking fee
_Spanish_: depósito

**Balance**:
What's charged when a Job is Completed: its price with Adjustments, less any Deposit; a negative one is refunded; a Client billed weekly gets it on a Bill (ADR-0016).
_Avoid_: Remainder, final payment, outstanding amount
_On screen_: the rest
_Spanish_: el resto

**Charge**:
Money taken from a Client's Payment Method: a Deposit, a Balance, a plan Job's Late Cancellation or No Access fee, a Bill, or a Tip (planned).
_Avoid_: Payment, invoice
_On screen_: payment
_Spanish_: pago

**Plan Discount**:
A reduction, 10% unless set otherwise, on each Job a Service Plan generates, against the same visit as a one-off; not on the First Clean or an Adjustment that adds to the price.
_Avoid_: Loyalty discount, subscription discount, recurring rate
_Spanish_: descuento del plan

**Adjustment**:
A recorded change to a Job's quoted price, with a reason, from what the assigned Staff report at completion: an Add-on done on the day, a quoted Add-on not done, or extra time. Staff never set amounts; a reduction counts at once, an increase once the Client approves it (ADR-0009).
_Avoid_: Surcharge, discount, extra
_On screen_: price change
_Spanish_: cambio de precio

**Bill**:
Everything a commercial Client billed weekly owes for one week, Monday to Sunday, made the next Monday and charged to their Payment Method or paid on its page by its due date; it never changes once made (ADR-0016).
_Avoid_: Invoice, statement
_On screen_: bill; a voided one is cancelled
_Spanish_: factura; a voided one is cancelada

**Unpaid**:
A Job whose Balance, or part of it, or whose fee failed to be charged and has not yet been recovered; or a Bill whose Charge failed, or that is still unpaid after its due date.
_Avoid_: Overdue, outstanding, failed payment
_On screen_: unpaid; payment pending while a payment we retry ourselves isn't settled
_Spanish_: sin pagar

## Pay

Planned: #416.

**Pay Rate**:
What a Cleaner is paid for an hour, one each, set by Office Staff; not a Service's hourly rate, which prices Quotes; pay is gross, as Cleaners are contractors (ADR-0030).
_Avoid_: Wage, salary, hourly rate
_Spanish_: paga por hora

**Job Rate**:
A higher hourly rate for one Job, or a plan's Jobs, set by Office Staff; each Cleaner on it gets the higher of it and their Pay Rate; the only extra pay tied to a Job.
_Avoid_: Bonus, special rate, premium, hourly rate
_Spanish_: paga por hora del trabajo

**Pay Week**:
The Monday-to-Sunday week Cleaners are paid for, the same week a Bill covers, paid the week after; a Job is in the week it started.
_Avoid_: Pay period, payroll week
_Spanish_: semana de paga

**Pay Sheet**:
What one Cleaner is owed for one Pay Week, worked out by the app from the Schedule, not from times anyone records, for Office Staff to check, pay outside the app and mark paid (ADR-0030); unlike Schedule room, it counts a gap between Jobs no longer than the gap length, an Office setting; once paid it never changes.
_Avoid_: Payroll, timesheet, payslip, pay stub, unpaid
_Spanish_: hoja de paga

**Other Pay**:
An amount, more or less, Office Staff add to a Pay Sheet by hand with a note, such as a supply run or a correction to a week already paid.
_Avoid_: Adjustment, bonus, deduction, correction
_Spanish_: otra paga

**Tip**:
Money a Client adds by card for the Cleaners on a Job, from its receipt's link, shared by its Confirmed crew; cash given to a Cleaner is the crew's own and never recorded (ADR-0030); not first-time help's tours, which screens call tips.
_Avoid_: Gratuity, bonus
_Spanish_: propina

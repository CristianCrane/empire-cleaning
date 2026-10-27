// Shared domain types live here; see GLOSSARY.md for the vocabulary.

// the roles a Staff member can hold; one person may hold both
export type StaffRole = "cleaner" | "office_staff";

// what a signed-in Account may do, from what it's connected to (ADR-0006):
// "client" when connected to a Client, plus the roles of an active Staff
// member. An Account connected to nothing has none.
export type AccountRole = "client" | StaffRole;

// the signed-in caller, as GET /api/me returns it
export type SignedInAccount = {
  id: string;
  email: string;
  name: string;
  roles: AccountRole[];
};

// ---- Quote Requests (#3) ----

export type PropertyType = "house" | "apartment" | "townhouse";

// a Property is a home, described by its rooms, or business premises,
// described by their Premises Type and floor area (#72)
export type PropertyKind = "residential" | "commercial";

// how dirty a Property is: stated by the Client, correctable by Staff
export type Condition = "light" | "moderate" | "heavy";

// the days of the week, Monday first: 0 is Monday, 6 is Sunday
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type NewAddress = {
  street: string;
  unit?: string | null;
  postcode: string;
  accessInstructions?: string | null;
};

// a home, as the Quote Request form describes it
export type NewHome = NewAddress & {
  kind: "residential";
  type: PropertyType;
  bedrooms: number;
  // half-baths allowed, e.g. 1.5
  bathrooms: number;
  storeys: number;
  pets: boolean;
  floorArea?: number | null;
};

// business premises, as the Quote Request form describes them; the floor
// area is optional, as the Client may not know it (a Site Visit finds it)
export type NewPremises = NewAddress & {
  kind: "commercial";
  // a Premises Type on the Price List, by key
  premisesType: string;
  floorArea?: number | null;
};

export type NewProperty = NewHome | NewPremises;

export type ContactDetails = { name: string; email: string; phone: string };

// a Client's contact details as the Office sees them: the Office may enter a
// caller without an email, who can't sign in or be sent a Quote until one is
// added (#34). A business's are those of the person dealt with there; its
// own name is `businessName` (#72).
export type OfficeContactDetails = Omit<ContactDetails, "email"> & {
  email: string | null;
  businessName: string | null;
};

// what the Quote Request form sends to POST /api/quote-requests. Guests send
// their contact details; a signed-in Account not yet connected to a Client
// sends its name and phone (its proven email is used); a Client sends neither.
//
// A home's request states its Condition and may choose Add-ons. A business's
// gives its business name instead, and which weekdays it wants cleaned and
// when, or none for a one-off; a Site Visit finds its Condition (#72).
export type QuoteRequestSubmission = {
  contact?: ContactDetails | Omit<ContactDetails, "email">;
  businessName?: string | null;
  property: { new: NewProperty } | { existing: string };
  condition?: Condition;
  wantsRegularService: boolean;
  // the Add-ons chosen, by their key (see AddOnChoice)
  addOns?: string[];
  // business premises wanting regular cleaning: the weekdays, and a
  // preferred start time ("08:00")
  weekdays?: Weekday[];
  preferredTime?: string | null;
  notes?: string | null;
};

// the reply: where the Quote will be emailed
export type QuoteRequestReceipt = { id: string; emailedTo: string };

// what POST /api/quote-requests/office returns: the request Office Staff
// entered for a caller, and the one-off Quote Draft started for it (#34)
export type OfficeRequestEntry = { quoteRequestId: string; quoteId: string };

type PropertyBase = {
  id: string;
  street: string;
  unit: string | null;
  postcode: string;
  floorArea: number | null;
  // the latest known; none for business premises until a Site Visit (or
  // Office Staff) records it, and priced as moderate until then
  condition: Condition | null;
  accessInstructions: string | null;
};

export type HomeView = PropertyBase & {
  kind: "residential";
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  storeys: number;
  pets: boolean;
};

export type PremisesView = PropertyBase & {
  kind: "commercial";
  // retired Premises Types keep their names
  premisesType: PremisesTypeChoice;
};

export type PropertyView = HomeView | PremisesView;

export type QuoteRequestView = {
  id: string;
  propertyId: string;
  // as the Client stated it; none on a business's request
  condition: Condition | null;
  wantsRegularService: boolean;
  // a business's request for regular cleaning: the weekdays and preferred
  // start time it asked for; empty and null otherwise
  weekdays: Weekday[];
  preferredTime: string | null;
  notes: string | null;
  addOns: AddOnChoice[];
  createdAt: string;
  // where it stands, from its latest Quote
  state: QuoteRequestState;
  // While it awaits a Quote and its Property has no Site Visit findings:
  // business premises need one before they're quoted (ADR-0014), and a
  // home may have one booked. Null otherwise.
  siteVisit: "needed" | "booked" | null;
};

// a Client as the Office names them: a business by its business name, with
// the person dealt with there (#72)
export type ClientName = {
  id: string;
  name: string;
  businessName: string | null;
};

export type ClientView = ContactDetails & {
  id: string;
  businessName: string | null;
  properties: PropertyView[];
  quoteRequests: QuoteRequestView[];
};

// where a home stands, as one line on its Client's screen: the most pressing
// of a request waiting on the Office, a Sent Quote open (a plan's first), the
// next booked Job, a Completed First Clean, or none of these
export type PropertyStatus =
  | { kind: "request_waiting" }
  | { kind: "quote_sent"; quoteKind: QuoteKind }
  | { kind: "job_booked"; startsAt: string }
  | { kind: "first_clean_done" }
  | { kind: "nothing_booked" };

// a Client in the Office's list of Clients
export type ClientListItem = OfficeContactDetails & {
  id: string;
  propertyCount: number;
};

// a Client for the Office: their contact details and their homes, each with
// where it stands. A home's history is on its own page (ADR-0011).
export type OfficeClientView = OfficeContactDetails & {
  id: string;
  properties: (PropertyView & { status: PropertyStatus })[];
  // how they're billed (ADR-0016)
  billing: ClientBilling;
};

// a Property for the Office, with its whole history: its requests, every
// Quote (Drafts included) and every Job, newest first
export type OfficePropertyView = PropertyView & {
  client: ClientName;
  // whether its First Clean is Completed, so it can be offered a Service Plan
  firstCleanCompleted: boolean;
  // its Service Plan, unless it has none or it has Ended
  servicePlan: ServicePlanSummary | null;
  quoteRequests: QuoteRequestView[];
  quotes: QuoteSummary[];
  jobs: ScheduledJob[];
  // its Site Visits, newest first, and whether any has recorded findings,
  // which business premises need before a Quote is Sent (ADR-0014)
  siteVisits: SiteVisitView[];
  findingsRecorded: boolean;
  // the Office's own notes on it, never shown to the Client
  officeNotes: string | null;
};

// one row of the Office's open Quote Requests
export type OpenQuoteRequest = QuoteRequestView & {
  client: ClientName;
  property: PropertyView;
  // its home's Service Plan, unless it has none or it has Ended: a Service
  // Plan Quote answering it changes that plan
  servicePlanId: string | null;
};

// ---- Price List and Suggested Price (#4) ----

export type CleanType = "standard" | "deep";

// an Add-on as a Client picks it: a name only, never a price (prices appear
// on the Quote). The key stays the same across Price List versions.
export type AddOnChoice = { key: string; name: string };

// which kind of Property an Add-on is offered for (#72)
export type OfferedFor = "homes" | "businesses" | "both";

export type PriceListAddOn = {
  // absent on a new Add-on; the server gives it one
  key?: string;
  name: string;
  // price-relevant hours, not multiplied by Condition or Clean Type
  hours: number;
  taxExempt: boolean;
  offeredFor: OfferedFor;
  // a retired Add-on is hidden from the form but still priced for requests
  // that already chose it
  active: boolean;
};

// a Premises Type as the Quote Request form offers it: its name. The key
// stays the same across Price List versions.
export type PremisesTypeChoice = { key: string; name: string };

// a kind of business premises, which sets how long cleaning its floor area
// takes; retired rather than deleted, so Properties of that type still price
export type PriceListPremisesType = {
  // absent on a new Premises Type; the server gives it one
  key?: string;
  name: string;
  // Labour Hours per 1,000 sq ft, before Condition and Clean Type
  hoursPerThousandSqFt: number;
  active: boolean;
};

// what Office Staff edit. Money is in cents, before tax; percentages are
// whole numbers except tax rates, which may have decimals (8.875).
export type PriceListInput = {
  // the residential hourly rate
  hourlyRateCents: number;
  commercialHourlyRateCents: number;
  minimumChargeCents: number;
  // hours every home needs for kitchen, living areas and entry
  baseHours: number;
  bedroomHours: number;
  bathroomHours: number;
  extraStoreyHours: number;
  petHours: number;
  conditionLight: number;
  conditionModerate: number;
  conditionHeavy: number;
  deepCleanMultiplier: number;
  depositPercent: number;
  planDiscountPercent: number;
  quoteValidityDays: number;
  defaultCrewSize: number;
  // residential one-off and Service Plan Jobs
  taxOneOffPercent: number;
  taxServicePlanPercent: number;
  // commercial Jobs, one-off or on a plan
  taxCommercialPercent: number;
  taxFeePercent: number;
  addOns: PriceListAddOn[];
  premisesTypes: PriceListPremisesType[];
};

// a saved version of the Price List; every save is a new version
export type PriceList = Omit<PriceListInput, "addOns" | "premisesTypes"> & {
  id: string;
  version: number;
  // the starting figures, until Office Staff save their own
  placeholder: boolean;
  createdAt: string;
  createdByName: string | null;
  addOns: (PriceListAddOn & { key: string })[];
  premisesTypes: (PriceListPremisesType & { key: string })[];
};

export type PriceBreakdown = {
  cleanType: CleanType;
  // what was priced: a home by its rooms, or business premises by floor
  // area. Absent on breakdowns saved before #72, which are all homes.
  propertyKind?: PropertyKind;
  // the Property's hours before Condition and Clean Type, by part
  homeHours: { label: string; hours: number }[];
  conditionMultiplier: number;
  cleanTypeMultiplier: number;
  addOns: { key: string; name: string; hours: number; taxExempt: boolean }[];
  labourHours: number;
  hourlyRateCents: number;
  // Labour Hours x rate, to the whole dollar, before the Minimum Charge
  workedOutCents: number;
  minimumChargeCents: number;
  minimumApplied: boolean;
  // the Suggested Price, before tax
  priceCents: number;
  taxPercent: number;
  taxCents: number;
  // what the Client sees: tax included
  totalCents: number;
};

export type SuggestedPrices = {
  priceListVersion: number;
  standard: PriceBreakdown;
  deep: PriceBreakdown;
};

// one Quote Request in full, for the Office
export type QuoteRequestDetail = {
  id: string;
  createdAt: string;
  // as the Client stated it; the home's current Condition (which Office
  // Staff may have corrected) is what prices use. None on a business's.
  statedCondition: Condition | null;
  wantsRegularService: boolean;
  weekdays: Weekday[];
  preferredTime: string | null;
  notes: string | null;
  addOns: AddOnChoice[];
  client: OfficeContactDetails & { id: string };
  property: PropertyView;
  suggested: SuggestedPrices;
  state: QuoteRequestState;
  // every Quote for it, newest first
  quotes: QuoteSummary[];
  // whether its Property's First Clean is Completed, so it can be answered
  // with a Service Plan Quote
  firstCleanCompleted: boolean;
  // its home's Service Plan, unless it has none or it has Ended: a Service
  // Plan Quote answering it changes that plan
  servicePlanId: string | null;
  // as on QuoteRequestView, and its Property's booked Site Visit, if any
  siteVisit: QuoteRequestView["siteVisit"];
  bookedSiteVisit: SiteVisitView | null;
  // whether its Property has Site Visit findings recorded (ADR-0014)
  findingsRecorded: boolean;
};

// ---- Staff, availability and the Schedule (#7) ----

// Days are Empire Cleaning's own days, in New York: "2026-11-03"
export type IsoDate = string;

// what Office Staff send to invite someone (POST /api/staff)
export type StaffInvitation = {
  name: string;
  email: string;
  roles: StaffRole[];
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  roles: StaffRole[];
  // a deactivated Staff member has no Staff access; their Account is untouched
  active: boolean;
  // whether someone has signed up with this email yet (ADR-0006)
  signedUp: boolean;
  // their Google profile picture, once they've signed in with Google
  imageUrl: string | null;
  createdAt: string;
};

// a day that differs from a Staff member's usual week, e.g. a holiday (0 h)
export type AvailabilityException = {
  date: IsoDate;
  hours: number;
  note: string | null;
};

export type StaffAvailability = {
  // the hours usually available each weekday, Monday first (7 numbers)
  usualWeek: number[];
  // from today on, soonest first
  exceptions: AvailabilityException[];
};

export type StaffDetail = StaffMember & { availability: StaffAvailability };

// booked, then Completed by its assigned Staff (#10), Cancelled, or No
// Access when they couldn't get in (#11)
export type JobStatus = "booked" | "completed" | "cancelled" | "no_access";

// a Job as the Schedule shows it to Office Staff
export type ScheduledJob = {
  id: string;
  startsAt: string;
  cleanType: CleanType;
  status: JobStatus;
  labourHours: number;
  crewSize: number;
  // Labour Hours divided by Crew Size
  hoursOnSite: number;
  client: ClientName;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // whether every place on its crew is Confirmed (#9)
  assignment: AssignmentStatus;
  // who holds its places, Offered or Confirmed, by name
  crew: { id: string; name: string }[];
  // whether Office Staff can move it: booked and not yet started (#52)
  movable: boolean;
};

// one day of the Schedule. Only Cleaners' hours count towards it.
export type ScheduleDay = {
  date: IsoDate;
  staffHours: number;
  bookedHours: number;
  // held for pending Reschedule Requests moving Jobs onto this day (#20)
  heldHours: number;
  // staffHours less bookedHours and heldHours; negative when the day is
  // overbooked
  freeHours: number;
  available: { id: string; name: string; hours: number }[];
  jobs: ScheduledJob[];
  // the new times pending Reschedule Requests hold on this day, a move
  // within the day included: each holds a crew there until it's answered
  held: HeldTime[];
  // its booked and Done Site Visits, earliest first (#73); bookedHours
  // counts those that take room
  siteVisits: ScheduledSiteVisit[];
};

// ---- Site Visits (#73) ----

// booked, then Done once its findings are recorded, or Cancelled
export type SiteVisitStatus = "booked" | "done" | "cancelled";

// A Site Visit as the Office sees it (ADR-0015): a free visit by one Staff
// member to see a Property before it's quoted. Findings recorded without a
// visit, for premises the Office knew, are a Done one with no time or
// visitor.
export type SiteVisitView = {
  id: string;
  status: SiteVisitStatus;
  startsAt: string | null;
  // how long it's booked for: 30 minutes unless set otherwise
  minutes: number;
  visitor: { id: string; name: string } | null;
  client: ClientName;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode" | "kind">;
  bookedAt: string;
  doneAt: string | null;
  cancelledAt: string | null;
};

// a Site Visit on a day of the Schedule. One by a Cleaner with Available
// Hours that day takes room like a Job with a Crew Size of one, its length
// as its Labour Hours; one by Office Staff alone takes none.
export type ScheduledSiteVisit = SiteVisitView & {
  startsAt: string;
  takesRoom: boolean;
};

// a Site Visit in full, for the Office: the Property's details, which its
// findings update, and the Office's own notes on it
export type OfficeSiteVisit = Omit<SiteVisitView, "property"> & {
  property: PropertyView;
  officeNotes: string | null;
};

// what Office Staff send to book a Site Visit, or to move one (no
// propertyId): when, who visits, and for how long
export type SiteVisitBooking = LocalDateTime & {
  staffId: string;
  minutes: number;
};

export type BookSiteVisitInput = SiteVisitBooking & { propertyId: string };

// What a Site Visit found, recorded on the Property: its price-affecting
// details and Condition, and the Office's notes. For business premises, the
// Premises Type and floor area; for a home, its rooms.
export type PremisesFindings = {
  premisesType: string;
  floorArea: number;
  condition: Condition;
  officeNotes?: string | null;
};

export type HomeFindings = Pick<
  HomeView,
  "type" | "bedrooms" | "bathrooms" | "storeys" | "pets"
> & {
  floorArea?: number | null;
  condition: Condition;
  officeNotes?: string | null;
};

export type SiteVisitFindings = PremisesFindings | HomeFindings;

// a booked Site Visit as its Client sees it in the portal
export type ClientSiteVisit = {
  id: string;
  startsAt: string;
  minutes: number;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // who's coming, by first name
  visitorName: string;
};

// a booked Site Visit as the Cleaner making it sees it
export type CleanerSiteVisit = {
  id: string;
  startsAt: string;
  minutes: number;
  client: ClientName & { phone: string };
  property: Pick<
    PropertyView,
    "id" | "street" | "unit" | "postcode" | "accessInstructions"
  >;
};

export type CleanerSiteVisits = {
  today: CleanerSiteVisit[];
  upcoming: CleanerSiteVisit[];
};

// a new time held for a pending Reschedule Request, with its Job's crew
export type HeldTime = {
  jobId: string;
  startsAt: string;
  labourHours: number;
  crewSize: number;
};

// whether a clean has room at a time: its day has the Labour Hours free, and
// enough Cleaners for its crew alongside the crews at work then (#62)
export type DayCapacity = {
  date: IsoDate;
  startsAt: string;
  labourHours: number;
  crewSize: number;
  staffHours: number;
  bookedHours: number;
  heldHours: number;
  freeHours: number;
  hasHours: boolean;
  // the Cleaners with Available Hours that day
  cleaners: number;
  // the most crews at work at once during the clean's time on site
  crewsBusy: number;
  hasCrew: boolean;
  // both: the hours and a crew
  hasRoom: boolean;
};

// ---- Office dashboard (#18) ----

// One thing waiting on the Office, of a kind told by `kind`. Later tickets add
// their kinds to this union.
export type NeedsAttentionItem =
  | {
      kind: "quote_request";
      // when it started needing attention
      since: string;
      quoteRequest: OpenQuoteRequest;
    }
  | {
      // a Sent Quote within 48 hours of Expiring
      kind: "quote_expiring";
      since: string;
      quote: QuoteSummary;
    }
  | {
      // a Sent Quote whose proposed day no longer has room for either Clean
      // Type, so its Client can't accept it: it needs another time
      kind: "quote_no_room";
      since: string;
      quote: QuoteSummary;
    }
  | {
      // a booked Job starting within 48 hours whose places aren't all
      // Confirmed
      kind: "job_unassigned";
      since: string;
      job: ScheduledJob;
    }
  | {
      // a Completed Job whose Balance, or part of it, couldn't be charged
      kind: "job_unpaid";
      since: string;
      job: ScheduledJob;
      owedCents: number;
      reason: string;
    }
  | {
      // increases Staff reported at completion, waiting on the Office to
      // propose them to the Client or dismiss them
      kind: "adjustments_reported";
      since: string;
      job: ScheduledJob;
      count: number;
    }
  | {
      // a pending Reschedule Request, waiting on the Office to confirm or
      // turn it down
      kind: "reschedule_requested";
      since: string;
      job: ScheduledJob;
      request: RescheduleRequestView;
    }
  | {
      // a Property whose First Clean is Completed, on a request that wanted
      // regular visits, with no Service Plan Quote open, Accepted or
      // Declined: the Office should offer one. `job` is the First Clean.
      kind: "service_plan_due";
      since: string;
      job: ScheduledJob;
    }
  | {
      // a date a Service Plan came round with no room on the Schedule, so
      // nothing was booked: the Office books it at another time or skips it
      kind: "plan_visit_unplaced";
      since: string;
      plan: ServicePlanSummary & { client: ClientName };
      visit: UnplacedVisit;
    }
  | {
      // a Service Plan On Hold, booking no new Jobs, while its Unpaid Jobs
      // owe `owedCents` between them, or Unpaid Bills (`bills`, by number)
      // have its Jobs on them; `since` the first became Unpaid
      kind: "plan_on_hold";
      since: string;
      plan: ServicePlanSummary & { client: ClientName };
      owedCents: number;
      bills: string[];
    }
  | {
      // a weekly Bill whose automatic Charge failed (ADR-0016)
      kind: "bill_unpaid";
      since: string;
      bill: BillSummary;
    };

export type NeedsAttentionKind = NeedsAttentionItem["kind"];

// A Job is Unassigned until all its places are Confirmed
export type AssignmentStatus = "unassigned" | "assigned";

// how a Job turned out on the day
export type JobOutcome = "completed" | "no_access";

export type TodayJob = ScheduledJob & { outcome: JobOutcome | null };

// today's Schedule (per the Clock), for the Office dashboard
export type Today = Omit<ScheduleDay, "jobs"> & { jobs: TodayJob[] };

// ---- First Clean Quotes (#5) ----

// Draft is being written by Staff and never shown to the Client; Expired is
// worked out from the Clock (validity end or proposed time, whichever is
// first). Accepted means the Deposit was taken and the Job booked.
export type QuoteStatus =
  "draft" | "sent" | "accepted" | "declined" | "expired" | "superseded";

// where a Quote Request stands, from its latest Quote that isn't a Draft:
// none yet or Expired, it's awaiting a Quote; Sent, it's quoted; Accepted,
// it's booked; Declined, it has ended. Booked and ended requests are closed:
// they take no more Quotes, and the Client may ask again about that home.
export type QuoteRequestState =
  "awaiting_quote" | "quoted" | "booked" | "ended";

// a day and a wall-clock time in New York: { date: "2026-11-03", time: "09:00" }
export type LocalDateTime = { date: IsoDate; time: string };

// ---- Service Plan Quotes (#13) ----

// what a Quote offers (ADR-0011): one Job, answering a Quote Request; or a
// Service Plan, which a Property can only be offered once its First Clean is
// Completed, answering a request or offered unprompted
export type QuoteKind = "one_off" | "service_plan";

// how often a Service Plan's Job comes round, always on the same weekday:
// every week, every 2 weeks or every 4 weeks
export type Recurrence = "weekly" | "fortnightly" | "four_weekly";

// One weekday of a Service Plan Quote (ADR-0013), with its own visit: its
// Clean Type priced as a one-off Job (its Suggested Price or the override),
// with one-off tax, against the plan clean's price, which is that less the
// Plan Discount, with Service Plan tax. The Quote's option at the same place
// in its list holds that price.
export type PlanDayTerms = {
  // its first clean, which every later one on this weekday repeats; null on
  // a Draft until it's chosen
  startsAt: string | null;
  // a Standard Clean unless Office Staff chose a Deep Clean
  cleanType: CleanType;
  crewSize: number;
  // before tax
  oneOffPriceCents: number;
  oneOffTaxCents: number;
  oneOffTotalCents: number;
  // the Plan Discount off the one-off price, before tax
  discountCents: number;
  // what each clean saves, tax included: the one-off total less the plan
  // clean's total
  savingCents: number;
};

// A Service Plan Quote's terms: how often, the Plan Discount, and its
// weekdays, earliest first (as entered, on a Draft not yet timed). A plan on
// one weekday repeats every 1, 2 or 4 weeks; one on several, every week. The
// Client accepts them whole.
export type ServicePlanTerms = {
  recurrence: Recurrence;
  discountPercent: number;
  days: PlanDayTerms[];
  // one round: a clean on each of its weekdays, tax included
  roundTotalCents: number;
  // the Deposit percentage of one clean on each of its weekdays, held for
  // the plan's life
  depositCents: number;
};

// one weekday Office Staff set on a Service Plan Quote, with its own visit
export type PlanDayInput = {
  // its first clean, New York; the weekday is that day's
  start: LocalDateTime | null;
  cleanType: CleanType;
  crewSize: number;
  // its one-off price before tax replacing the Suggested Price, with a
  // reason; null keeps the Suggested Price. The Plan Discount comes off it.
  override: { priceCents: number; reason: string } | null;
};

// what Office Staff set on a Service Plan Quote, beyond what every Quote has
export type ServicePlanInput = {
  // every week when it has several weekdays
  recurrence: Recurrence;
  discountPercent: number;
  // the Condition it's priced for: moderate unless they say otherwise
  condition: Condition;
  // at least one, each on a different weekday, all within one week
  days: PlanDayInput[];
};

// one Clean Type's offer on a Quote, as the Client sees it: tax included
export type QuoteOption = {
  cleanType: CleanType;
  recommended: boolean;
  labourHours: number;
  // Labour Hours divided by Crew Size
  hoursOnSite: number;
  // before tax
  priceCents: number;
  taxCents: number;
  totalCents: number;
  // the Deposit percentage of the total
  depositCents: number;
};

// an Add-on on a Quote, with what it costs, tax included
export type QuoteAddOn = { key: string; name: string; totalCents: number };

// a Quote as its Client sees it (never a Draft)
export type QuoteView = {
  id: string;
  // the request it answers; null on a Service Plan Quote offered unprompted
  quoteRequestId: string | null;
  kind: QuoteKind;
  status: QuoteStatus;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // a one-off Quote's: Deep Clean first, recommended, then Standard Clean. A
  // Service Plan Quote's: one for each weekday, in the order its plan's days
  // list them, at the plan clean's price.
  options: QuoteOption[];
  // a Service Plan Quote's terms and saving; null on a one-off Quote
  plan: ServicePlanTerms | null;
  addOns: QuoteAddOn[];
  // a one-off Quote's; on a Service Plan Quote, its first weekday's (each
  // has its own)
  crewSize: number;
  depositPercent: number;
  // a one-off Quote's Job; a Service Plan Quote's first clean
  proposedStartsAt: string;
  sentAt: string;
  expiresAt: string;
  declinedAt: string | null;
  // once Accepted: when, and the Clean Type chosen
  acceptedAt: string | null;
  acceptedCleanType: CleanType | null;
  // the Service Plan it started or changed, once Accepted; null on a one-off
  // Quote
  servicePlanId: string | null;
  // once Accepted, whether it changed its home's plan rather than starting it
  changedPlan: boolean;
  // on a Service Plan Quote for a home that has a plan, while it's a Draft or
  // Sent: what accepting it does to that plan. Null otherwise.
  changesPlan: PlanChange | null;
  // the Clean Types that can still be booked: those the proposed day has room
  // for now, while the Quote is Sent; none once it's closed. A Service Plan
  // Quote's are its days' while the first clean on each of them has room,
  // and none otherwise.
  bookable: CleanType[];
};

// Accepting a Service Plan Quote for a home that has a plan changes that
// plan's terms from the Quote's proposed time on: its booked Jobs from then
// are cancelled free, and those before go ahead as they were. The plan's
// Deposit carries over, so none is taken.
export type PlanChange = {
  servicePlanId: string;
  // the Deposit the plan holds, which carries over
  depositCents: number;
  // when its booked Jobs that the new terms replace start, soonest first
  replaces: string[];
};

// one Clean Type's offer for the Office: the Suggested Price worked out, and
// the override that replaced it, if any
export type OfficeQuoteOption = QuoteOption & {
  suggested: PriceBreakdown;
  overrideCents: number | null;
  overrideReason: string | null;
};

// a Quote in full, for the Office
export type OfficeQuote = Omit<
  QuoteView,
  "options" | "plan" | "proposedStartsAt" | "sentAt" | "expiresAt" | "property"
> & {
  // what the Property is: its rooms, or its Premises Type and floor area
  property: PropertyView;
  // no email until the Office adds one: then it can't be Sent (#34)
  client: ClientName & { email: string | null };
  // business premises with no Site Visit findings yet: it can't be Sent
  // until they're recorded (ADR-0014)
  needsSiteVisit: boolean;
  options: OfficeQuoteOption[];
  // with the Condition it's priced for
  plan: (ServicePlanTerms & { condition: Condition }) | null;
  // on a Service Plan Quote, what the Property's First Clean found, to price
  // the plan by; null on a one-off Quote
  firstClean: FirstCleanFindings | null;
  // on a Service Plan Draft, each weekday priced as each Clean Type,
  // Standard first, for Office Staff to choose between: its own Clean Type
  // as last saved, the other worked out now from the same terms and Add-ons.
  // Null once Sent, and on a one-off Quote.
  planChoices: PlanChoice[][] | null;
  priceListVersion: number;
  validityDays: number;
  proposedStart: LocalDateTime | null;
  proposedStartsAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  // the Add-ons that can be put on it: those on offer, and any the request it
  // answers chose that have since been retired
  addOnChoices: AddOnChoice[];
  // the Client's saved Payment Method, which recording acceptance on their
  // behalf charges; null until they add one
  paymentMethod: PaymentMethodView | null;
};

// what Office Staff change on a Draft (PATCH /api/quotes/:id); prices are
// worked out again from the current Price List on every save. A Service Plan
// Quote's time, crew and override are each weekday's own, so it leaves out
// crewSize, proposedStart and overrides.
export type QuoteDraftInput = {
  addOns: string[];
  // required on a one-off Quote
  crewSize?: number;
  depositPercent: number;
  validityDays: number;
  proposedStart?: LocalDateTime | null;
  // a price before tax replacing the Suggested Price, with a reason; null
  // keeps the Suggested Price
  overrides?: Record<CleanType, { priceCents: number; reason: string } | null>;
  // required on a Service Plan Quote, and only there
  plan?: ServicePlanInput | null;
};

// a Service Plan Draft's weekday priced as one Clean Type
export type PlanChoice = { option: OfficeQuoteOption; day: PlanDayTerms };

// what a Property's First Clean found, shown beside a Service Plan Quote
export type FirstCleanFindings = {
  job: { id: string; startsAt: string; cleanType: CleanType };
  completedAt: string;
  // the Condition its Cleaner reported
  condition: Condition;
  adjustments: AdjustmentView[];
};

// a Quote in a list, for the Office or its Client
export type QuoteSummary = {
  id: string;
  // the request it answers; null on a Service Plan Quote offered unprompted
  quoteRequestId: string | null;
  kind: QuoteKind;
  status: QuoteStatus;
  client: ClientName;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // the total it leads with, tax included: a one-off Quote's recommended
  // Deep Clean, or a Service Plan Quote's round, a clean on each weekday
  headlineTotalCents: number;
  // a Service Plan Quote's; null on a one-off Quote
  plan: { recurrence: Recurrence; days: PlanDaySummary[] } | null;
  proposedStartsAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

// ---- Accepting a Quote (#8) ----

// a Client's saved Payment Method, as far as we can describe it without the
// card itself
export type PaymentMethodView = {
  // e.g. "Visa ending 4242"
  label: string;
  savedAt: string;
  // when the Client agreed to later Charges to it without them there (the
  // Balance, and late-cancellation or No Access fees)
  consentedAt: string;
};

// the payment provider's own payment form, shown in the browser so card
// numbers never reach our server (ADR-0004). "test" is the fake provider's,
// for tests: it needs no card.
export type PaymentForm =
  { form: "stripe"; publishableKey: string } | { form: "test" };

// that form for saving a Payment Method without paying, with the one-time
// secret it needs
export type CardForm = PaymentForm & { secret: string };

// POST /api/quotes/mine/:id/accept. A Client paying with a card entered just
// now sends the payment form's token, which also saves the card; without one
// their saved Payment Method pays. The Office's /api/quotes/:id/accept takes
// only the Clean Type, and always charges the saved one.
export type AcceptQuoteInput = { cleanType: CleanType; paymentToken?: string };

// the Client's acceptance: done, or waiting on their bank's approval (e.g. 3D
// Secure) in the browser with `secret`, then POST .../accept/finalize
export type AcceptOutcome =
  | { status: "accepted"; quote: QuoteView }
  | { status: "needs_approval"; secret: string };

// a booked Job as its Client sees it
export type ClientJob = {
  id: string;
  startsAt: string;
  cleanType: CleanType;
  crewSize: number;
  // Labour Hours divided by Crew Size
  hoursOnSite: number;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
};

// ---- Assignments (#9) ----

// Offered until the Staff member Confirms or Releases it. A Released one is
// kept, so the Office can see who let a place go.
export type AssignmentState = "offered" | "confirmed" | "released";

export type AssignmentView = {
  id: string;
  staff: { id: string; name: string };
  status: AssignmentState;
  offeredAt: string;
  // when it was Confirmed or Released
  answeredAt: string | null;
};

// a booked Job as Office Staff manage its Assignments, and once Completed,
// its Adjustments and payment
export type OfficeJob = ScheduledJob & {
  completion: JobCompletion | null;
  cancellation: JobCancellation | null;
  noAccess: JobNoAccess | null;
  // what cancelling it would cost now, either way; null once it isn't
  // booked
  cancelTerms: Record<CancelledBy, CancellationTerms> | null;
  // what moving it would cost if asked now; null once it can't be moved or
  // while a request is pending
  rescheduleTerms: RescheduleTerms | null;
  // its latest Reschedule Request, pending or answered; null if none
  rescheduleRequest: RescheduleRequestView | null;
  addOns: string[];
  // Offered and Confirmed first, then Released; each earliest Offered first
  assignments: AssignmentView[];
  // places nobody holds: Crew Size less those Offered or Confirmed
  openPlaces: number;
  // the Service Plan it was generated for; null for a one-off Job
  servicePlanId: string | null;
  // active Cleaners who could be Offered a place, with their Available Hours
  // on the Job's day
  cleaners: { id: string; name: string; hours: number }[];
  // whether Office Staff can offer its Property a Service Plan from here:
  // it's Completed, and so is the Property's First Clean
  canOfferServicePlan: boolean;
};

// what Office Staff send to Offer a place on a Job
export type AssignmentOffer = { staffId: string };

// A Job as a Cleaner assigned to it sees it: where, what, who with, and the
// Client's first name, never any prices or payment details. The Client's
// phone only on the Job's day.
export type CleanerJob = {
  id: string;
  startsAt: string;
  cleanType: CleanType;
  hoursOnSite: number;
  addOns: string[];
  property: Pick<
    PropertyView,
    "street" | "unit" | "postcode" | "accessInstructions"
  >;
  client: { firstName: string; phone: string | null };
  // everyone holding a place, this Cleaner included
  crew: { name: string; status: "offered" | "confirmed" }[];
  // this Cleaner's own place
  assignment: {
    id: string;
    status: "offered" | "confirmed";
    // false once a Confirmed Assignment is within 48 hours of the Job
    canRelease: boolean;
  };
  outcome: JobOutcome | null;
  // whether its start time has come, by the Clock
  started: boolean;
  // whether this Cleaner can mark it Completed now: their place Confirmed,
  // every place Confirmed, and the Job started
  canComplete: boolean;
  // whether this Cleaner can record No Access now: their place Confirmed and
  // the Job started, though others' places needn't be
  canRecordNoAccess: boolean;
  // what can be reported at completion, by name: the Quote's Add-ons (as
  // not done) and the Price List's others (as done)
  reportable: { quoted: AddOnChoice[]; others: AddOnChoice[] };
  // once Completed: what was reported, without prices
  completion: {
    completedAt: string;
    completedBy: string | null;
    condition: Condition;
    reports: CleanerReport[];
  } | null;
  // once No Access is recorded: when, by whom, and what happened
  noAccess: {
    recordedAt: string;
    recordedBy: string | null;
    reason: string;
  } | null;
};

// a Cleaner's Jobs: today's (in New York, by the Clock) and those to come
export type CleanerJobs = { today: CleanerJob[]; upcoming: CleanerJob[] };

// ---- Completing a Job (#10) ----

// what the assigned Staff can report at completion; Staff never set amounts:
// each is priced from the Price List the Job's Quote used (ADR-0009)
export type AdjustmentKind = "add_on_done" | "add_on_not_done" | "extra_time";

export type CompletionReport =
  | {
      // an Add-on that wasn't on the Quote, done on the day
      kind: "add_on_done";
      addOnKey: string;
      reason: string;
    }
  | {
      // an Add-on on the Quote that couldn't be done
      kind: "add_on_not_done";
      addOnKey: string;
      reason: string;
    }
  | {
      // extra Labour Hours, all the crew's together
      kind: "extra_time";
      hours: number;
      reason: string;
    };

// POST /api/assignments/mine/:jobId/complete
export type CompletionInput = {
  // the Property's Condition as found
  condition: Condition;
  reports: CompletionReport[];
};

// a report as the Cleaner sees it afterwards
export type CleanerReport = {
  kind: AdjustmentKind;
  addOnName: string | null;
  hours: number | null;
  reason: string;
};

// A reduction is applied at once. An increase is reported until Office Staff
// propose it to the Client or dismiss it; a proposed one is approved or
// declined by the Client, or lapses unanswered after 7 days. Only applied
// and approved Adjustments count towards the price.
export type AdjustmentStatus =
  | "applied"
  | "reported"
  | "dismissed"
  | "proposed"
  | "approved"
  | "declined"
  | "lapsed";

export type AdjustmentView = {
  id: string;
  kind: AdjustmentKind;
  addOnName: string | null;
  hours: number | null;
  // the Cleaner's
  reason: string;
  status: AdjustmentStatus;
  // as worked out from the Price List, before tax
  workedOutCents: number;
  // the price, before tax: the worked-out one or the Office's; with tax,
  // what it changes the Job's total by (negative for a reduction)
  priceCents: number;
  taxCents: number;
  totalCents: number;
  // why Office Staff changed the price
  officeReason: string | null;
  reportedAt: string;
  proposedAt: string | null;
  answeredAt: string | null;
  // when a proposed one lapses unanswered
  lapsesAt: string | null;
};

// one Charge on a Job, and how much of it has been refunded
export type ChargeView = {
  kind: "deposit" | "balance" | "fee";
  amountCents: number;
  refundedCents: number;
  chargedAt: string;
};

// where a Job's money stands. All amounts tax included.
export type JobPayment = {
  quotedCents: number;
  // what the Adjustments that count add or take off
  adjustmentsCents: number;
  // the price: quoted plus Adjustments, never below 0
  totalCents: number;
  // the Late Cancellation fee a second Late Reschedule made due (ADR-0010),
  // owed on top of the price; 0 if none
  rescheduleFeeCents: number;
  charges: ChargeView[];
  // what has been taken, less refunds
  paidCents: number;
  // what weekly Bills have billed for it (ADR-0016), which they now owe
  billedCents: number;
  // still to take (positive) or to give back (negative)
  owedCents: number;
  // the Client's saved Payment Method, e.g. "Visa ending 4242"
  paymentMethod: string | null;
  unpaid: { since: string; reason: string } | null;
};

export type JobCompletion = {
  completedAt: string;
  completedBy: { id: string; name: string } | null;
  condition: Condition;
  adjustments: AdjustmentView[];
  payment: JobPayment;
};

// Office Staff proposing a reported increase to the Client: at its
// worked-out price, or at one they set (before tax) with a reason
export type AdjustmentProposal = {
  priceCents?: number | null;
  reason?: string | null;
};

// Office Staff correcting an Adjustment's price (before tax, as a positive
// amount: a reduction stays a reduction), with a reason
export type AdjustmentCorrection = { priceCents: number; reason: string };

// a Completed Job in the Client's past Jobs
export type ClientPastJob = ClientJob & {
  completedAt: string;
  totalCents: number;
  unpaid: boolean;
  // increases proposed to them, waiting on their answer
  awaitingAnswer: number;
};

// one of the Client's Jobs, with its receipt once Completed. They see only
// Adjustments that were applied or proposed to them, never ones still with
// the Office.
export type ClientJobDetail = ClientJob & {
  status: JobStatus;
  completion: Omit<JobCompletion, "completedBy"> | null;
  cancellation: JobCancellation | null;
  noAccess: Omit<JobNoAccess, "recordedBy"> | null;
  // what cancelling it would cost now; null once it can't be cancelled in
  // the portal (it isn't booked, or it has started)
  cancelTerms: CancellationTerms | null;
  // what moving it would cost if asked now; null once it can't be moved in
  // the portal (it isn't booked, it has started, or a request is pending)
  rescheduleTerms: RescheduleTerms | null;
  // its latest Reschedule Request, pending or answered; null if none
  rescheduleRequest: RescheduleRequestView | null;
  // the Service Plan it was generated for, which cancelling it skips; null
  // for a one-off Job
  servicePlanId: string | null;
};

// ---- Cancellation and No Access (#11) ----

// who a cancellation is down to: the Client (themselves, or Office Staff on
// their behalf), or Empire Cleaning
export type CancelledBy = "client" | "empire";

// What cancelling a booked Job would cost, by the Clock. The Client
// cancelling more than 24 hours before it starts pays nothing and has their
// Deposit refunded; within 24 hours it's a Late Cancellation, and the Deposit
// is kept as the fee. A plan Job has no Deposit of its own: its fee is its
// plan's Deposit amount, charged, and the held Deposit is untouched. Empire
// Cleaning cancelling always refunds it in full.
export type CancellationTerms = {
  by: CancelledBy;
  late: boolean;
  // tax included; 0 when it's free
  feeCents: number;
  // what goes back to the Client's card
  refundCents: number;
  // until when the Client can cancel for free
  freeUntil: string;
};

// POST /api/jobs/mine/:id/cancel: the fee the Client was shown, so one that
// has become late since is refused rather than charged
export type CancelInput = { feeCents: number };

// POST /api/jobs/:id/cancel, by Office Staff
export type OfficeCancelInput = {
  by: CancelledBy;
  // the fee they were shown, as for the Client
  feeCents: number;
  // told to the Client
  reason?: string | null;
};

export type JobCancellation = {
  cancelledAt: string;
  by: CancelledBy;
  late: boolean;
  reason: string | null;
  feeCents: number;
  payment: JobPayment;
};

// POST /api/assignments/mine/:jobId/no-access
export type NoAccessInput = { reason: string };

// the assigned Staff couldn't get in: not Completed, and charged like a Late
// Cancellation
export type JobNoAccess = {
  recordedAt: string;
  recordedBy: { id: string; name: string } | null;
  // what happened, from the Cleaner
  reason: string;
  feeCents: number;
  payment: JobPayment;
};

// ---- Reschedule Requests (#20) ----

// What moving a Job costs, judged when the request is made (ADR-0010): free
// 24 hours or more before it; less than that, a Late Reschedule, free the
// first time one is confirmed for the Job and a Late Cancellation after
// that, which keeps the Deposit as the fee while the Job still moves.
export type RescheduleCost = "free" | "free_late" | "late_cancellation";

export type RescheduleTerms = {
  cost: RescheduleCost;
  // the fee if a Late Cancellation is confirmed (the Deposit, or a plan
  // Job's plan's Deposit amount); 0 otherwise, and 0 when an earlier Late
  // Reschedule has made it due already
  feeCents: number;
  // until when moving is free, by the Clock
  freeUntil: string;
};

// pending until Office Staff confirm it or turn it down, or the Client
// withdraws it
export type RescheduleRequestStatus =
  "pending" | "confirmed" | "turned_down" | "withdrawn";

export type RescheduleRequestView = {
  id: string;
  status: RescheduleRequestStatus;
  // the Job's time when it was asked, and the new time asked for
  fromStartsAt: string;
  startsAt: string;
  // what it costs, as judged when it was made
  cost: RescheduleCost;
  feeCents: number;
  requestedAt: string;
  // whether the Client asked in the portal, rather than the Office for them
  byClient: boolean;
  answeredAt: string | null;
  // why Office Staff turned it down, told to the Client
  reason: string | null;
};

// the times a Job can be moved to: the days from tomorrow with room for its
// Labour Hours (counting what's held for other requests), each with the
// start times on offer that have a crew free (#62). A day without any is
// left out.
export type RescheduleTimes = {
  days: { date: IsoDate; times: string[] }[];
};

// POST /api/jobs/mine/:id/reschedule-request (and the Office's
// /api/jobs/:id/reschedule-request): the new time, and the cost the person
// asking was shown, so one that has become late since is refused rather
// than sent
export type RescheduleInput = LocalDateTime & { cost: RescheduleCost };

// POST /api/jobs/:id/reschedule-request/turn-down
export type TurnDownRescheduleInput = { reason?: string | null };

// POST /api/jobs/:id/move: Office Staff move a booked Job straight to a new
// time, New York (#52)
export type MoveJobInput = LocalDateTime;

// ---- Service Plans (#14) ----

// generating Jobs; On Hold, generating none while one of its Jobs is Unpaid;
// or Ended, for good
export type ServicePlanStatus = "active" | "on_hold" | "ended";

// one of a Service Plan's weekdays in a line: its first clean, whose weekday
// and time every later one repeats (null on a Draft until chosen), and its
// Clean Type
export type PlanDaySummary = { startsAt: string | null; cleanType: CleanType };

// a Service Plan in a line: on the Property page, and the Client's home screen
export type ServicePlanSummary = {
  id: string;
  status: ServicePlanStatus;
  recurrence: Recurrence;
  // on its current terms, earliest first
  days: PlanDaySummary[];
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // its next booked Job, if one is on the Schedule
  nextStartsAt: string | null;
};

// one of a Service Plan's weekdays: its visit, and what each clean on it
// costs, Plan Discount off
export type PlanDayView = {
  // its first clean on the plan's current terms
  startsAt: string;
  cleanType: CleanType;
  crewSize: number;
  labourHours: number;
  // Labour Hours divided by Crew Size
  hoursOnSite: number;
  // before and with tax
  priceCents: number;
  taxCents: number;
  totalCents: number;
};

// A Service Plan as its Client sees it: its terms, what each Job costs, the
// Deposit held for its life, and its booked Jobs still to come, soonest first.
// Jobs come round on each of its weekdays at the time of the first there.
export type ServicePlanView = Omit<ServicePlanSummary, "days"> & {
  days: PlanDayView[];
  startedAt: string;
  discountPercent: number;
  // one round: a clean on each weekday, tax included
  roundTotalCents: number;
  addOns: string[];
  // taken at acceptance, and applied to its final Job when it Ends
  depositCents: number;
  // the Service Plan Quote it was accepted from
  quoteId: string;
  // its Jobs that are Unpaid, which keep it On Hold, soonest first
  unpaid: { jobId: string; startsAt: string; owedCents: number }[];
  // and its Unpaid Bills: those with any of its Jobs on them, which keep it
  // On Hold too (ADR-0016), oldest first
  unpaidBills: { billId: string; number: string; totalCents: number }[];
  // what Ending it would do now; null once it has Ended
  endTerms: EndPlanTerms | null;
  endedAt: string | null;
  upcoming: ClientJob[];
};

// What Ending a Service Plan does, by the Clock: its booked Jobs more than
// 24 hours out are cancelled free, those within 24 hours go ahead, and its
// Deposit goes towards its final Job, which is the last that goes ahead or
// has happened (a fee counting). Whatever of the Deposit that Job doesn't
// need is refunded.
export type EndPlanTerms = {
  // when each Job cancelled starts
  cancelled: string[];
  goingAhead: string[];
  depositCents: number;
  // it comes off the price of a Job going ahead; goes towards what a Job
  // that has happened owes; or, with nothing owed, is refunded
  deposit: "comes_off" | "goes_towards" | "refunded";
  // with its status as it will be once the plan has Ended
  finalJob: { id: string; startsAt: string; status: JobStatus };
};

// a date the plan came round with no room on the Schedule: nothing was
// booked, and the Office books it at another time or skips it
export type UnplacedVisit = { id: string; dueOn: IsoDate; since: string };

// a Service Plan for the Office: with its Client, every Job it has booked,
// soonest first, and its visits waiting to be booked
export type OfficeServicePlan = Omit<ServicePlanView, "upcoming"> & {
  client: ClientName;
  jobs: ScheduledJob[];
  unplaced: UnplacedVisit[];
};

// POST /api/service-plans/:id/visits/:visitId/book: the time, New York, the
// Office books an unplaced visit at
export type BookVisitInput = LocalDateTime;

// ---- Weekly Bills (#81, ADR-0016) ----

// how a Client billed weekly pays each Bill: charged to their saved Payment
// Method when it's made, or paid by them on its page by its due date
export type BillPayment = "automatic" | "on_page";

// a Client's weekly billing, for the Office. Only a commercial Client can be
// switched to it; how they pay and their terms stay set while it's off.
export type ClientBilling = {
  // the Monday of the week it was switched on, or null while it's off
  weeklyFrom: IsoDate | null;
  canBillWeekly: boolean;
  payment: BillPayment;
  // days from a Bill being made to its due date, when paid on its page
  termsDays: number;
  // where Bills and receipts go instead of the Client's own email
  billingEmail: string | null;
};

// PUT /api/clients/:id/billing
export type ClientBillingInput = {
  weekly: boolean;
  payment: BillPayment;
  termsDays: number;
  billingEmail: string | null;
};

// due until paid, or voided by Office Staff; processing while a bank debit
// paying it clears
export type BillStatus = "due" | "processing" | "paid" | "void";

// how a paid Bill was paid: its automatic Charge, on its page, a payment
// Office Staff recorded, or nothing to pay
export type BillPaidVia = "charge" | "page" | "outside" | "nothing_due";

// one thing a Bill charges or credits, tax included; a Job's lines link to
// it, an earlier Bill's credit has no Job
export type BillLineView = {
  jobId: string | null;
  label: string;
  amountCents: number;
  taxCents: number;
};

export type BillSummary = {
  id: string;
  // "EC-000123"
  number: string;
  client: ClientName;
  // Monday to Sunday, New York
  weekStart: IsoDate;
  weekEnd: IsoDate;
  madeAt: string;
  payment: BillPayment;
  dueOn: IsoDate;
  status: BillStatus;
  // tax included; below 0 it's a credit on the next Bill
  totalCents: number;
  taxCents: number;
  // its automatic Charge failed, and it hasn't been paid since
  unpaid: { since: string; reason: string } | null;
  paidAt: string | null;
  paidVia: BillPaidVia | null;
};

export type BillView = BillSummary & {
  lines: BillLineView[];
  // Office Staff's note on a payment made another way
  paymentNote: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  // whether the Client can pay it on its page now
  payable: boolean;
};

// the payment provider's form for paying a Bill on its page, by card or bank
// debit, with what POST /api/bills/mine/:id/payment then sends back
export type BillPaymentForm = PaymentForm & { secret: string; ref: string };

// POST /api/bills/mine/:id/payment, once the form is done
export type PayBillInput = { ref: string };

// POST /api/bills/:id/void
export type VoidBillInput = { reason: string };

// POST /api/bills/:id/outside-payment: a cheque or bank transfer
export type OutsidePaymentInput = { note: string };

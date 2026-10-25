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

// how dirty a Property is: stated by the Client, correctable by Staff
export type Condition = "light" | "moderate" | "heavy";

export type NewProperty = {
  type: PropertyType;
  street: string;
  unit?: string | null;
  postcode: string;
  bedrooms: number;
  // half-baths allowed, e.g. 1.5
  bathrooms: number;
  storeys: number;
  pets: boolean;
  floorArea?: number | null;
  accessInstructions?: string | null;
};

export type ContactDetails = { name: string; email: string; phone: string };

// what the Quote Request form sends to POST /api/quote-requests. Guests send
// their contact details; a signed-in Account not yet connected to a Client
// sends its name and phone (its proven email is used); a Client sends neither.
export type QuoteRequestSubmission = {
  contact?: ContactDetails | Omit<ContactDetails, "email">;
  property: { new: NewProperty } | { existing: string };
  condition: Condition;
  wantsRegularService: boolean;
  // the Add-ons chosen, by their key (see AddOnChoice)
  addOns?: string[];
  notes?: string | null;
};

// the reply: where the Quote will be emailed
export type QuoteRequestReceipt = { id: string; emailedTo: string };

export type PropertyView = NewProperty & {
  id: string;
  condition: Condition;
};

export type QuoteRequestView = {
  id: string;
  propertyId: string;
  condition: Condition;
  wantsRegularService: boolean;
  notes: string | null;
  addOns: AddOnChoice[];
  createdAt: string;
  // where it stands, from its latest Quote
  state: QuoteRequestState;
};

export type ClientView = ContactDetails & {
  id: string;
  properties: PropertyView[];
  quoteRequests: QuoteRequestView[];
};

// one row of the Office's open Quote Requests
export type OpenQuoteRequest = QuoteRequestView & {
  client: { id: string; name: string };
  property: Pick<
    PropertyView,
    "street" | "unit" | "postcode" | "type" | "bedrooms" | "bathrooms"
  >;
};

// ---- Price List and Suggested Price (#4) ----

export type CleanType = "standard" | "deep";

// an Add-on as a Client picks it: a name only, never a price (prices appear
// on the Quote). The key stays the same across Price List versions.
export type AddOnChoice = { key: string; name: string };

export type PriceListAddOn = {
  // absent on a new Add-on; the server gives it one
  key?: string;
  name: string;
  // price-relevant hours, not multiplied by Condition or Clean Type
  hours: number;
  taxExempt: boolean;
  // a retired Add-on is hidden from the form but still priced for requests
  // that already chose it
  active: boolean;
};

// what Office Staff edit. Money is in cents, before tax; percentages are
// whole numbers except tax rates, which may have decimals (8.875).
export type PriceListInput = {
  hourlyRateCents: number;
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
  taxOneOffPercent: number;
  taxServicePlanPercent: number;
  taxFeePercent: number;
  addOns: PriceListAddOn[];
};

// a saved version of the Price List; every save is a new version
export type PriceList = Omit<PriceListInput, "addOns"> & {
  id: string;
  version: number;
  // the starting figures, until Office Staff save their own
  placeholder: boolean;
  createdAt: string;
  createdByName: string | null;
  addOns: (PriceListAddOn & { key: string })[];
};

export type PriceBreakdown = {
  cleanType: CleanType;
  // the home's hours before Condition and Clean Type, by part
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
  // Staff may have corrected) is what prices use
  statedCondition: Condition;
  wantsRegularService: boolean;
  notes: string | null;
  addOns: AddOnChoice[];
  client: ContactDetails & { id: string };
  property: PropertyView;
  suggested: SuggestedPrices;
  state: QuoteRequestState;
  // every Quote for it, newest first
  quotes: QuoteSummary[];
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

// booked, then Completed by its assigned Staff (#10)
export type JobStatus = "booked" | "completed";

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
  client: { id: string; name: string };
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // whether every place on its crew is Confirmed (#9)
  assignment: AssignmentStatus;
};

// one day of the Schedule. Only Cleaners' hours count towards it.
export type ScheduleDay = {
  date: IsoDate;
  staffHours: number;
  bookedHours: number;
  // staffHours less bookedHours; negative when the day is overbooked
  freeHours: number;
  available: { id: string; name: string; hours: number }[];
  jobs: ScheduledJob[];
};

// whether a day can take a booking of this many Labour Hours
export type DayCapacity = {
  date: IsoDate;
  labourHours: number;
  staffHours: number;
  bookedHours: number;
  freeHours: number;
  hasRoom: boolean;
};

// ---- Office dashboard (#18) ----

// One thing waiting on the Office, of a kind told by `kind`. Later tickets add
// their kinds to this union: Reschedule Requests (#20), On Hold Service Plans
// (#15).
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
    };

export type NeedsAttentionKind = NeedsAttentionItem["kind"];

// A Job is Unassigned until all its places are Confirmed
export type AssignmentStatus = "unassigned" | "assigned";

// how a Job turned out on the day; No Access comes with #11
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
  quoteRequestId: string;
  status: QuoteStatus;
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // Deep Clean first, recommended
  options: QuoteOption[];
  addOns: QuoteAddOn[];
  crewSize: number;
  depositPercent: number;
  proposedStartsAt: string;
  sentAt: string;
  expiresAt: string;
  declinedAt: string | null;
  // once Accepted: when, and the Clean Type chosen
  acceptedAt: string | null;
  acceptedCleanType: CleanType | null;
  // the Clean Types that can still be booked: those the proposed day has room
  // for now, while the Quote is Sent; none once it's closed
  bookable: CleanType[];
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
  "options" | "proposedStartsAt" | "sentAt" | "expiresAt"
> & {
  client: { id: string; name: string; email: string };
  options: OfficeQuoteOption[];
  priceListVersion: number;
  validityDays: number;
  proposedStart: LocalDateTime | null;
  proposedStartsAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  // the Add-ons that can be put on it: those on offer, and any the request
  // chose that have since been retired
  addOnChoices: AddOnChoice[];
  // the Client's saved Payment Method, which recording acceptance on their
  // behalf charges; null until they add one
  paymentMethod: PaymentMethodView | null;
};

// what Office Staff change on a Draft (PATCH /api/quotes/:id); prices are
// worked out again from the current Price List on every save
export type QuoteDraftInput = {
  addOns: string[];
  crewSize: number;
  depositPercent: number;
  validityDays: number;
  proposedStart: LocalDateTime | null;
  // a price before tax replacing the Suggested Price, with a reason; null
  // keeps the Suggested Price
  overrides: Record<CleanType, { priceCents: number; reason: string } | null>;
};

// a Quote in a list, for the Office or its Client
export type QuoteSummary = {
  id: string;
  quoteRequestId: string;
  status: QuoteStatus;
  client: { id: string; name: string };
  property: Pick<PropertyView, "id" | "street" | "unit" | "postcode">;
  // the recommended (Deep Clean) total, tax included
  recommendedTotalCents: number;
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
  addOns: string[];
  // Offered and Confirmed first, then Released; each earliest Offered first
  assignments: AssignmentView[];
  // places nobody holds: Crew Size less those Offered or Confirmed
  openPlaces: number;
  // active Cleaners who could be Offered a place, with their Available Hours
  // on the Job's day
  cleaners: { id: string; name: string; hours: number }[];
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
  kind: "deposit" | "balance";
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
  charges: ChargeView[];
  // what has been taken, less refunds
  paidCents: number;
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
};

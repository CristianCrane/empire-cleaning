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

export type JobStatus = "booked";

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
// their kinds to this union: expiring Quotes (#5), Unassigned Jobs (#9),
// Unpaid Jobs (#10), Reschedule Requests (#20), On Hold Service Plans (#15).
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
    };

export type NeedsAttentionKind = NeedsAttentionItem["kind"];

// A Job is Unassigned until all its places are Confirmed. Nothing assigns
// Staff until #9, so every Job is Unassigned for now.
export type AssignmentStatus = "unassigned" | "assigned";

// how a Job turned out on the day; none until Completed (#10) or No Access
// (#11) exist
export type JobOutcome = "completed" | "no_access";

export type TodayJob = ScheduledJob & {
  assignment: AssignmentStatus;
  outcome: JobOutcome | null;
};

// today's Schedule (per the Clock), for the Office dashboard
export type Today = Omit<ScheduleDay, "jobs"> & { jobs: TodayJob[] };

// ---- First Clean Quotes (#5) ----

// Draft is being written by Staff and never shown to the Client; Expired is
// worked out from the Clock (validity end or proposed time, whichever is
// first). Accepted comes with #8.
export type QuoteStatus =
  "draft" | "sent" | "declined" | "expired" | "superseded";

// where a Quote Request stands, from its latest Quote that isn't a Draft:
// none yet or Expired, it's awaiting a Quote; Sent, it's quoted; Declined,
// it has ended and the Client may ask again
export type QuoteRequestState = "awaiting_quote" | "quoted" | "ended";

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

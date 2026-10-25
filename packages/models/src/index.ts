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
  createdAt: string;
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

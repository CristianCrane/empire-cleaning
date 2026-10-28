import { useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, House, Houses, Store } from "lucide-react";
import type {
  AddOnChoice,
  Condition,
  HomeRooms,
  NewHome,
  NewPremises,
  OpenQuote,
  PremisesTypeChoice,
  PropertyKind,
  PropertyType,
  PropertyView,
  QuoteAskReceipt,
  QuoteAsk,
  ServiceOffer,
  Weekday,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  ChoiceTile,
  ChoiceTiles,
  Form,
  Heading,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  TextField,
} from "@empire-cleaning/ui";
import { loadAddOns } from "./add-ons.ts";
import { Optional } from "./Optional.tsx";
import { loadPremisesTypes } from "./premises-types.ts";
import { isHeld, loadServices, offeredAt } from "./services.ts";
import { submitQuoteRequest, type SubmitResult } from "./submit.ts";

// who is asking, which decides what the form needs from them (ADR-0006)
export type Asker =
  // the landing page: everything, including contact details
  | { kind: "guest" }
  // signed up but not yet a Client: their proven email is used
  | { kind: "account"; email: string }
  // a Client: a new home or one of theirs; their details are already known.
  // A home with a Quote open that the Service asked for would overlap is
  // listed but not selectable. A business Client's name isn't asked again.
  | {
      kind: "client";
      properties: PropertyView[];
      open?: OpenQuote[];
      businessName?: string | null;
    }
  // Office Staff entering a caller's request (#34): for a Client they found,
  // with their homes as for a Client, or a new one, whose email is optional
  | {
      kind: "office";
      client: {
        id: string;
        properties: PropertyView[];
        open: OpenQuote[];
        businessName: string | null;
      } | null;
    };

export type QuoteRequestFormProps<R = QuoteAskReceipt> = {
  asker: Asker;
  // the API's origin; "" when the page is served alongside it (the web app)
  apiUrl?: string;
  // the level of the form's step headings: one below the page's heading it
  // sits under, so the outline never skips a level
  headingLevel?: 2 | 3;
  // where the request goes, if not the API's own endpoint for asking
  submit?: (body: object) => Promise<SubmitResult<R>>;
  onSubmitted: (receipt: R) => void;
};

// the form speaks to whoever fills it in: the person asking, or Office Staff
// on a caller's behalf
const ownWords = {
  need: "What you need",
  service: "What can we help with?",
  servicesFailed:
    "We couldn't load what we offer. Please try again, or call us on (646) 320-9076.",
  what: "What kind of place is it?",
  details: "Your details",
  email: "Email",
  emailNote: "We'll email your Quote here.",
  phoneNote: "Your Cleaners can reach you on the day.",
  home: "Your home",
  premises: "Your business premises",
  when: "When would you like us to clean?",
  extrasNote: "Optional. Your Quote will show what each one costs.",
  regular:
    "After my first clean, I'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
  submit: "Request a Quote",
  waiting: "This home has a Quote open already for this.",
  premisesWaiting: "These premises have a Quote open already for this.",
  businessName: "Business name",
  contactNote: "The person we'll deal with at the business.",
  failed:
    "Your request didn't go through. Please try again, or call us on (646) 320-9076.",
};
const officeWords: typeof ownWords = {
  need: "What they need",
  service: "What can we help them with?",
  servicesFailed: "The Services didn't load. Please try again.",
  what: "What kind of place is it?",
  details: "Their details",
  email: "Email (optional)",
  emailNote:
    "Their Quote is emailed here. Without an email it can't be sent until one is added.",
  phoneNote: "Their Cleaners can reach them on the day.",
  home: "Their home",
  premises: "Their business premises",
  when: "When would they like us to clean?",
  extrasNote: "Optional. The Quote shows what each one costs.",
  regular:
    "After their first clean, they'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
  submit: "Draft a Quote",
  waiting: "This home has a Quote open already for this.",
  premisesWaiting: "These premises have a Quote open already for this.",
  businessName: "Business name",
  contactNote: "The person we'll deal with at the business.",
  failed: "The request didn't save. Please try again.",
};

const NEW_PLACE = "new";

// how much cleaning a place needs, as asked here and wherever the Office
// records it
export const conditions: {
  value: Condition;
  label: string;
  description: string;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Tidy, with everyday dust and marks",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Lived in, with some build-up in the kitchen and bathrooms",
  },
  {
    value: "heavy",
    label: "Heavy",
    description: "Not cleaned in a while, or after a move, renovation or party",
  },
];

const blankHome: NewHome = {
  kind: "residential",
  type: "house",
  street: "",
  unit: "",
  postcode: "",
  floorArea: null,
  accessInstructions: "",
};

// a home's rooms, as asked before anything is changed
const blankRooms: HomeRooms = {
  bedrooms: 2,
  bathrooms: 1,
  storeys: 1,
  pets: false,
};

const blankPremises: NewPremises = {
  kind: "commercial",
  street: "",
  unit: "",
  postcode: "",
  premisesType: "",
  floorArea: null,
  accessInstructions: "",
};

const weekdays: { day: Weekday; label: string }[] = [
  { day: 0, label: "Monday" },
  { day: 1, label: "Tuesday" },
  { day: 2, label: "Wednesday" },
  { day: 3, label: "Thursday" },
  { day: 4, label: "Friday" },
  { day: 5, label: "Saturday" },
  { day: 6, label: "Sunday" },
];

// "18:00" -> "6:00 PM"
const clockLabel = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours! % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours! < 12 ? "AM" : "PM"}`;
};

// a preferred start, on the half hour from 5am to 11pm
const startTimes = Array.from({ length: 37 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const addressOf = (p: Pick<PropertyView, "street" | "unit" | "postcode">) =>
  [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

// the fields on the second step: what the place is and where. A message
// from the API for any of them sends the form back there.
const WHERE_FIELDS =
  /^(property\.existing|property\.new\.(type|street|unit|postcode))$/;

// the Request a Quote form, shared by the landing page (Guests), the Client
// portal and the Office (callers). It asks in steps, so only a few fields
// show at once (#96): the Service, from those on offer now (#122), then what
// and where, then about the place, asking only what that Service needs, then
// who is asking (when the form needs that). The API validates everything;
// its messages show beside each field, on its step.
export function QuoteRequestForm<R = QuoteAskReceipt>({
  asker,
  apiUrl = "",
  headingLevel = 3,
  submit,
  onSubmitted,
}: QuoteRequestFormProps<R>) {
  const words = asker.kind === "office" ? officeWords : ownWords;
  // whose Properties are offered: a Client's own, or the one the Office found
  const placesOf =
    asker.kind === "client"
      ? asker
      : asker.kind === "office"
        ? asker.client
        : null;
  const ownPlaces = placesOf?.properties ?? [];
  const open = placesOf?.open ?? [];
  // a business Client's name, which isn't asked again
  const knownBusinessName = placesOf?.businessName ?? null;
  // contact details: a Guest's or Account's own, or a new caller's
  const asksContact =
    asker.kind === "guest" ||
    asker.kind === "account" ||
    (asker.kind === "office" && !asker.client);
  const [services, setServices] = useState<ServiceOffer[]>();
  const [serviceKey, setServiceKey] = useState<string | null>(null);
  const service = services?.find((s) => s.key === serviceKey);
  // whether a Property can't be asked about for the Service chosen
  const held = (propertyId: string) =>
    !!services &&
    !!serviceKey &&
    isHeld(services, open, propertyId, serviceKey);
  const firstFree = (kind: PropertyKind) =>
    ownPlaces.find((p) => p.kind === kind && !held(p.id));
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [kind, setKind] = useState<PropertyKind>("residential");
  const [place, setPlace] = useState<string>(NEW_PLACE);
  const [newHome, setNewHome] = useState<NewHome>(blankHome);
  const [rooms, setRooms] = useState<HomeRooms>(blankRooms);
  const [newPremises, setNewPremises] = useState<NewPremises>(blankPremises);
  const [condition, setCondition] = useState<Condition>(
    firstFree("residential")?.condition ?? "moderate",
  );
  const [offered, setOffered] = useState<AddOnChoice[]>([]);
  const [premisesTypes, setPremisesTypes] = useState<PremisesTypeChoice[]>();
  const [chosen, setChosen] = useState<string[]>([]);
  const [area, setArea] = useState<number | null>(null);
  const [wantsRegularService, setWantsRegularService] = useState(false);
  const [businessName, setBusinessName] = useState("");
  // business premises: regular cleaning on some weekdays, or a one-off
  const [regular, setRegular] = useState(true);
  const [days, setDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [isSending, setSending] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    void loadServices(apiUrl).then(setServices);
  }, [apiUrl]);
  // a home's Add-ons are the Service's own
  useEffect(() => {
    if (!serviceKey) return;
    void loadAddOns(apiUrl, serviceKey).then(setOffered);
  }, [apiUrl, serviceKey]);
  useEffect(() => {
    void loadPremisesTypes(apiUrl).then(setPremisesTypes);
  }, [apiUrl]);

  const premises = kind === "commercial";
  const places = ownPlaces.filter((p) => p.kind === kind);
  // the kinds of place the Service is offered for: both, or only one, which
  // then isn't asked
  const forHomes = !service || offeredAt(service, false);
  const forPremises = !service || offeredAt(service, true);
  // a Service priced by area that Condition doesn't apply to, like
  // Painting, is for part of a place: the Client gives a rough area to work
  // on. Commercial cleaning's is the premises' floor area, asked about them.
  const asksArea = service?.method === "area" && !service.conditionApplies;
  const asksCondition = !premises && !!service?.conditionApplies;
  // a home's rooms, where the Service is priced from them: a new home's, or
  // one of the Client's that hasn't given them yet (it was asked about only
  // for something else, like Painting)
  const asksRooms = !premises && service?.method === "rooms";
  const chosenPlace = places.find((p) => p.id === place);
  const givesRooms =
    asksRooms &&
    chosenPlace?.kind === "residential" &&
    chosenPlace.bedrooms === null;
  const canRecur = !!service?.canRecur;

  // a place to start from at a kind of place: the first that can be asked
  // about for the Service, or a new one
  const startAt = (next: PropertyKind, key: string | null) => {
    const free = ownPlaces.find(
      (p) =>
        p.kind === next &&
        !(services && key && isHeld(services, open, p.id, key)),
    );
    setPlace(free?.id ?? NEW_PLACE);
    if (free?.condition) setCondition(free.condition);
  };

  const chooseKind = (next: PropertyKind) => {
    setKind(next);
    startAt(next, serviceKey);
    setFieldErrors({});
    setRefusal(undefined);
  };

  // the kind of place follows the Service: where it's offered for only one,
  // that one; otherwise where the Client has a place free to ask about
  const chooseService = (key: string) => {
    const next = services!.find((s) => s.key === key)!;
    setServiceKey(key);
    setChosen([]);
    setFieldErrors({});
    setRefusal(undefined);
    const homes = offeredAt(next, false);
    const businesses = offeredAt(next, true);
    const free = (k: PropertyKind) =>
      ownPlaces.some(
        (p) => p.kind === k && !isHeld(services!, open, p.id, key),
      );
    const nextKind: PropertyKind = !businesses
      ? "residential"
      : !homes
        ? "commercial"
        : free("residential") || !free("commercial")
          ? "residential"
          : "commercial";
    setKind(nextKind);
    startAt(nextKind, key);
  };

  // the new Property as the API takes it: empty optional fields as null
  const newPlace = () => {
    const fresh = premises
      ? newPremises
      : { ...newHome, ...(asksRooms && rooms) };
    return {
      ...fresh,
      unit: fresh.unit || null,
      accessInstructions: fresh.accessInstructions || null,
    };
  };

  // what was asked, or for the Office, with its Client: one they found
  // or a new one, without an email if they gave none
  const submission = (): QuoteAsk & {
    clientId?: string;
    contact?: { email?: string | null };
  } => ({
    ...(asker.kind === "guest" && { contact }),
    ...(asker.kind === "account" && {
      contact: { name: contact.name, phone: contact.phone },
    }),
    ...(asker.kind === "office" &&
      (asker.client
        ? { clientId: asker.client.id }
        : { contact: { ...contact, email: contact.email || null } })),
    property:
      place === NEW_PLACE
        ? { new: newPlace() }
        : { existing: place, ...(givesRooms && { rooms }) },
    serviceKey: serviceKey!,
    notes: notes || null,
    ...(asksArea && { area }),
    ...(premises
      ? {
          businessName: knownBusinessName ?? (businessName || null),
          wantsRegularService: canRecur && regular,
          weekdays:
            canRecur && regular
              ? weekdays
                  .map((w) => w.day)
                  .filter((d) => days.includes(String(d)))
              : [],
          preferredTime: canRecur && regular ? preferredTime : null,
        }
      : {
          ...(asksCondition && { condition }),
          wantsRegularService: canRecur && wantsRegularService,
          // in the order offered, only those still offered
          addOns: offered
            .filter((a) => chosen.includes(a.key))
            .map((a) => a.key),
        }),
  });

  // a field's message from the API, by its path in the request
  const error = (path: string) => fieldErrors[path];

  // the Services on offer, each with what it is. Nothing is chosen at first:
  // the Client says what they want.
  const serviceField =
    services?.length === 0 ? (
      <Notice tone="danger">{words.servicesFailed}</Notice>
    ) : (
      services && (
        <RadioGroup
          label={words.service}
          name="serviceKey"
          isRequired
          value={serviceKey}
          onChange={chooseService}
          errorMessage={error("serviceKey")}
        >
          {services.map((s) => (
            <Radio key={s.key} value={s.key} description={s.description}>
              {s.name}
            </Radio>
          ))}
        </RadioGroup>
      )
    );

  // one question for what kind of place and, for a home, its type: business
  // premises are just another kind of place (#96). A home's type only
  // matters for a new one. A Service for business premises alone doesn't
  // ask it.
  const kindField = !forHomes ? null : (
    <ChoiceTiles
      label={words.what}
      name="property.new.type"
      value={premises ? "commercial" : newHome.type}
      onChange={(value) => {
        if (value === "commercial") return chooseKind("commercial");
        if (premises) chooseKind("residential");
        setNewHome((current) => ({ ...current, type: value as PropertyType }));
      }}
      errorMessage={error("property.new.type")}
    >
      <ChoiceTile value="house" icon={House}>
        House
      </ChoiceTile>
      <ChoiceTile value="apartment" icon={Building2}>
        Apartment
      </ChoiceTile>
      <ChoiceTile value="townhouse" icon={Houses}>
        Townhouse
      </ChoiceTile>
      {forPremises && (
        <ChoiceTile value="commercial" icon={Store}>
          Business premises
        </ChoiceTile>
      )}
    </ChoiceTiles>
  );

  const businessNameField = (
    <TextField
      label={words.businessName}
      name="businessName"
      autoComplete="organization"
      isRequired
      value={businessName}
      onChange={setBusinessName}
      errorMessage={error("businessName")}
    />
  );

  const contactFields = (
    <>
      {premises && businessNameField}
      <TextField
        label="Full name"
        description={premises ? words.contactNote : undefined}
        name="contact.name"
        autoComplete={asker.kind === "office" ? "off" : "name"}
        isRequired
        value={contact.name}
        onChange={(name) => setContact({ ...contact, name })}
        errorMessage={error("contact.name")}
      />
      {asker.kind === "account" ? (
        <p className="text-sm text-fg-muted">
          We'll email your Quote to {asker.email}.
        </p>
      ) : (
        <TextField
          label={words.email}
          name="contact.email"
          type="email"
          autoComplete={asker.kind === "office" ? "off" : "email"}
          isRequired={asker.kind === "guest"}
          description={words.emailNote}
          value={contact.email}
          onChange={(email) => setContact({ ...contact, email })}
          errorMessage={error("contact.email")}
        />
      )}
      <TextField
        label="Phone"
        name="contact.phone"
        type="tel"
        autoComplete={asker.kind === "office" ? "off" : "tel"}
        isRequired
        description={words.phoneNote}
        value={contact.phone}
        onChange={(phone) => setContact({ ...contact, phone })}
        errorMessage={error("contact.phone")}
      />
    </>
  );

  // which of their places, or where a new one is
  const whereFields = (
    <>
      {places.length > 0 && (
        <RadioGroup
          label={premises ? "Which premises?" : "Which home?"}
          value={place}
          onChange={(id) => {
            setPlace(id);
            const chosen = places.find((p) => p.id === id);
            if (chosen?.condition) setCondition(chosen.condition);
          }}
        >
          {places.map((p) => (
            <Radio
              key={p.id}
              value={p.id}
              isDisabled={held(p.id)}
              description={
                held(p.id)
                  ? premises
                    ? words.premisesWaiting
                    : words.waiting
                  : undefined
              }
            >
              {addressOf(p)}
            </Radio>
          ))}
          <Radio value={NEW_PLACE}>
            {premises ? "Different premises" : "A different home"}
          </Radio>
        </RadioGroup>
      )}

      {place === NEW_PLACE &&
        (premises ? (
          <AddressFields
            place={newPremises}
            unitLabel="Suite, floor or unit (optional)"
            update={(change) =>
              setNewPremises((current) => ({ ...current, ...change }))
            }
            error={error}
          />
        ) : (
          <AddressFields
            place={newHome}
            unitLabel="Apartment or unit (optional)"
            update={(change) =>
              setNewHome((current) => ({ ...current, ...change }))
            }
            error={error}
          />
        ))}
    </>
  );

  // the rough area to work on, for a Service like Painting: its main
  // question, so it comes first
  const areaField = asksArea && (
    <NumberField
      label="Area in sq ft (optional)"
      name="area"
      description="Roughly how much there is to do. If you're not sure, we'll measure on our visit."
      minValue={10}
      maxValue={1_000_000}
      step={50}
      value={area ?? Number.NaN}
      onChange={(value) => setArea(Number.isNaN(value) ? null : value)}
      errorMessage={error("area")}
    />
  );

  const notesField = (
    <Optional add="Add a note" shown={!!notes || !!error("notes")}>
      <TextField
        label="Anything else we should know?"
        name="notes"
        multiline
        value={notes}
        onChange={setNotes}
        errorMessage={error("notes")}
      />
    </Optional>
  );

  const homeFields = (
    <>
      {areaField}
      {place === NEW_PLACE && (
        <NewHomeFields
          home={newHome}
          rooms={asksRooms ? rooms : null}
          update={(change) =>
            setNewHome((current) => ({ ...current, ...change }))
          }
          updateRooms={(change) =>
            setRooms((current) => ({ ...current, ...change }))
          }
          error={error}
        />
      )}
      {givesRooms && (
        <RoomsFields
          rooms={rooms}
          at="property.rooms"
          update={(change) =>
            setRooms((current) => ({ ...current, ...change }))
          }
          error={error}
        />
      )}
      {asksCondition && (
        <SegmentedControl
          label="How much cleaning does it need?"
          name="condition"
          isRequired
          value={condition}
          onChange={(value) => setCondition(value as Condition)}
          description={
            conditions.find((c) => c.value === condition)?.description
          }
          errorMessage={error("condition")}
        >
          {conditions.map((c) => (
            <Segment key={c.value} value={c.value}>
              {c.label}
            </Segment>
          ))}
        </SegmentedControl>
      )}
      {offered.length > 0 && (
        <ChipGroup
          label="Any extras?"
          description={words.extrasNote}
          value={chosen}
          onChange={setChosen}
        >
          {offered.map((addOn) => (
            <Chip key={addOn.key} value={addOn.key}>
              {addOn.name}
            </Chip>
          ))}
        </ChipGroup>
      )}
      {canRecur && (
        <Checkbox
          isSelected={wantsRegularService}
          onChange={setWantsRegularService}
        >
          {words.regular}
        </Checkbox>
      )}
    </>
  );

  // when business premises want cleaning, for a Service that can recur
  const whenFields = (
    <>
      <Heading level={headingLevel === 2 ? 3 : 4} size={4}>
        {words.when}
      </Heading>
      <SegmentedControl
        label="How often?"
        value={regular ? "regular" : "one_off"}
        onChange={(value) => setRegular(value === "regular")}
        description={regular ? "On set days each week" : undefined}
      >
        <Segment value="regular">Regularly</Segment>
        <Segment value="one_off">One-off</Segment>
      </SegmentedControl>
      {regular && (
        <>
          <ChipGroup
            label="Which days?"
            value={days}
            onChange={setDays}
            errorMessage={error("weekdays")}
          >
            {weekdays.map(({ day, label }) => (
              <Chip key={day} value={String(day)} aria-label={label}>
                {label.slice(0, 3)}
              </Chip>
            ))}
          </ChipGroup>
          <Select
            label="Preferred start time"
            name="preferredTime"
            placeholder="Choose a time"
            selectedKey={preferredTime}
            onSelectionChange={(key) => setPreferredTime(String(key))}
            errorMessage={error("preferredTime")}
          >
            {startTimes.map((time) => (
              <SelectItem key={time} id={time}>
                {clockLabel(time)}
              </SelectItem>
            ))}
          </Select>
        </>
      )}
    </>
  );

  const premisesFields = (
    <>
      {!asksContact && !knownBusinessName && businessNameField}
      {areaField}
      {place === NEW_PLACE && (
        <NewPremisesFields
          premises={newPremises}
          premisesTypes={premisesTypes}
          update={(change) =>
            setNewPremises((current) => ({ ...current, ...change }))
          }
          error={error}
        />
      )}
      {canRecur && whenFields}
    </>
  );

  const steps: { title: string; fields: ReactNode }[] = [
    { title: words.need, fields: serviceField },
    {
      title: kindField ? "What and where" : "Where",
      fields: (
        <>
          {kindField}
          {whereFields}
        </>
      ),
    },
    {
      title: premises ? words.premises : words.home,
      fields: (
        <>
          {premises ? premisesFields : homeFields}
          {!asksContact && notesField}
        </>
      ),
    },
    ...(asksContact
      ? [
          {
            title: words.details,
            fields: (
              <>
                {contactFields}
                {notesField}
              </>
            ),
          },
        ]
      : []),
  ];
  const at = Math.min(step, steps.length - 1);
  const isLast = at === steps.length - 1;

  // the step with a field the API refused: the Service first, then where,
  // who's asking last, and everything about the place in between
  const stepOf = (path: string) =>
    path === "serviceKey"
      ? 0
      : WHERE_FIELDS.test(path)
        ? 1
        : path.startsWith("contact.") ||
            path === "notes" ||
            (path === "businessName" && asksContact)
          ? steps.length - 1
          : 2;

  // a new step takes the focus to its heading, for screen readers and so a
  // long page scrolls back to its top
  const heading = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [at]);

  const send = async () => {
    setSending(true);
    setFailed(false);
    setRefusal(undefined);
    const result = submit
      ? await submit(submission())
      : ((await submitQuoteRequest(
          apiUrl,
          submission(),
          asker.kind === "guest",
        )) as SubmitResult<R>);
    setSending(false);
    if (result.ok) {
      onSubmitted(result.receipt);
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      setStep(Math.min(...Object.keys(result.fieldErrors).map(stepOf)));
      // an Add-on withdrawn since the form loaded: say so, and show what is
      // on offer now
      const addOnError = Object.keys(result.fieldErrors).some((path) =>
        path.startsWith("addOns"),
      );
      if (addOnError) {
        setRefusal(
          "Some of the extras you chose are no longer offered. Please check your choices.",
        );
        void loadAddOns(apiUrl, serviceKey!).then(setOffered);
      }
    } else if (result.refusal) {
      setRefusal(result.refusal);
    } else {
      setFailed(true);
    }
  };

  return (
    <Form
      validationErrors={fieldErrors}
      // Next submits too, so the browser checks the step's required fields
      onSubmit={(e) => {
        e.preventDefault();
        if (isLast) void send();
        else setStep(at + 1);
      }}
    >
      <div
        ref={heading}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
      >
        <div className="flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full ${i <= at ? "bg-primary" : "bg-surface-sunken"}`}
            />
          ))}
        </div>
        <p className="text-sm text-fg-muted">
          Step {at + 1} of {steps.length}
        </p>
        <Heading level={headingLevel} size={3}>
          {steps[at]!.title}
        </Heading>
      </div>

      {steps[at]!.fields}

      {refusal && <Notice>{refusal}</Notice>}

      {failed && <Notice tone="danger">{words.failed}</Notice>}

      <Actions>
        {at > 0 && (
          <Button variant="secondary" onPress={() => setStep(at - 1)}>
            Back
          </Button>
        )}
        <Button type="submit" isPending={isLast && isSending}>
          {isLast ? words.submit : "Next"}
        </Button>
      </Actions>
    </Form>
  );
}

// business premises: what kind and how big. Where they are is asked first.
// The Condition and any extras are agreed after a visit, so they aren't asked.
function NewPremisesFields({
  premises,
  premisesTypes,
  update,
  error,
}: {
  premises: NewPremises;
  // undefined while loading
  premisesTypes: PremisesTypeChoice[] | undefined;
  update: (change: Partial<NewPremises>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewPremises) => `property.new.${name}`;

  return (
    <>
      {premisesTypes?.length === 0 ? (
        <Notice tone="danger">
          We couldn't load the types of premises. Please try again, or call us
          on (646) 320-9076.
        </Notice>
      ) : (
        <Select
          label="Type of premises"
          name={field("premisesType")}
          placeholder="Choose one"
          isRequired
          selectedKey={premises.premisesType || null}
          onSelectionChange={(key) => update({ premisesType: String(key) })}
          errorMessage={error(field("premisesType"))}
        >
          {(premisesTypes ?? []).map((t) => (
            <SelectItem key={t.key} id={t.key}>
              {t.name}
            </SelectItem>
          ))}
        </Select>
      )}
      <Optional
        add="Add the floor area"
        shown={premises.floorArea !== null || !!error(field("floorArea"))}
      >
        <NumberField
          label="Floor area in sq ft (optional)"
          name={field("floorArea")}
          description="Roughly is fine. If you're not sure, we'll measure on our visit."
          minValue={100}
          maxValue={1_000_000}
          step={100}
          value={premises.floorArea ?? Number.NaN}
          onChange={(area) =>
            update({ floorArea: Number.isNaN(area) ? null : area })
          }
          errorMessage={error(field("floorArea"))}
        />
      </Optional>
      <Optional
        add="Add how we get in"
        shown={
          !!premises.accessInstructions || !!error(field("accessInstructions"))
        }
      >
        <TextField
          label="How do we get in? (optional)"
          name={field("accessInstructions")}
          multiline
          description="Alarm codes, who has the keys, parking. Only your Cleaners see this."
          value={premises.accessInstructions ?? ""}
          onChange={(accessInstructions) => update({ accessInstructions })}
          errorMessage={error(field("accessInstructions"))}
        />
      </Optional>
    </>
  );
}

// a Property's address: street, unit and ZIP code. The unit is optional but
// stays in view: it's part of the address, not something extra.
function AddressFields({
  place,
  unitLabel,
  update,
  error,
}: {
  place: Pick<NewHome, "street" | "unit" | "postcode">;
  unitLabel: string;
  update: (
    change: Partial<Pick<NewHome, "street" | "unit" | "postcode">>,
  ) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: string) => `property.new.${name}`;

  return (
    <>
      <TextField
        label="Street address"
        name={field("street")}
        autoComplete="address-line1"
        isRequired
        value={place.street}
        onChange={(street) => update({ street })}
        errorMessage={error(field("street"))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={unitLabel}
          name={field("unit")}
          autoComplete="address-line2"
          value={place.unit ?? ""}
          onChange={(unit) => update({ unit })}
          errorMessage={error(field("unit"))}
        />
        <TextField
          label="ZIP code"
          name={field("postcode")}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={5}
          isRequired
          value={place.postcode}
          onChange={(postcode) => update({ postcode })}
          errorMessage={error(field("postcode"))}
        />
      </div>
    </>
  );
}

// a home's rooms, all four, at `at` in the request
function RoomsFields({
  rooms,
  at,
  update,
  error,
}: {
  rooms: HomeRooms;
  at: string;
  update: (change: Partial<HomeRooms>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof HomeRooms) => `${at}.${name}`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Bedrooms"
          name={field("bedrooms")}
          description="0 for a studio"
          minValue={0}
          maxValue={20}
          value={rooms.bedrooms}
          onChange={(bedrooms) => update({ bedrooms })}
          errorMessage={error(field("bedrooms"))}
        />
        <NumberField
          label="Bathrooms"
          name={field("bathrooms")}
          description="Half-baths count as 0.5"
          minValue={0.5}
          maxValue={20}
          step={0.5}
          value={rooms.bathrooms}
          onChange={(bathrooms) => update({ bathrooms })}
          errorMessage={error(field("bathrooms"))}
        />
        <NumberField
          label="Floors"
          name={field("storeys")}
          minValue={1}
          maxValue={5}
          value={rooms.storeys}
          onChange={(storeys) => update({ storeys })}
          errorMessage={error(field("storeys"))}
        />
      </div>
      <Checkbox isSelected={rooms.pets} onChange={(pets) => update({ pets })}>
        There are pets at home
      </Checkbox>
    </>
  );
}

// a new home's rooms, where the Service is priced from them (`rooms` null
// otherwise), and what the Cleaners should know. Its type and address are
// asked first.
function NewHomeFields({
  home,
  rooms,
  update,
  updateRooms,
  error,
}: {
  home: NewHome;
  rooms: HomeRooms | null;
  update: (change: Partial<NewHome>) => void;
  updateRooms: (change: Partial<HomeRooms>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewHome) => `property.new.${name}`;

  return (
    <>
      {rooms && (
        <>
          <RoomsFields
            rooms={rooms}
            at="property.new"
            update={updateRooms}
            error={error}
          />
          <Optional
            add="Add the floor area"
            shown={home.floorArea !== null || !!error(field("floorArea"))}
          >
            <NumberField
              label="Floor area in sq ft (optional)"
              name={field("floorArea")}
              minValue={100}
              maxValue={100_000}
              step={50}
              value={home.floorArea ?? Number.NaN}
              onChange={(area) =>
                update({ floorArea: Number.isNaN(area) ? null : area })
              }
              errorMessage={error(field("floorArea"))}
            />
          </Optional>
        </>
      )}
      <Optional
        add="Add how we get in"
        shown={
          !!home.accessInstructions || !!error(field("accessInstructions"))
        }
      >
        <TextField
          label="How do we get in? (optional)"
          name={field("accessInstructions")}
          multiline
          description="Door codes, where the key is, parking. Only your Cleaners see this."
          value={home.accessInstructions ?? ""}
          onChange={(accessInstructions) => update({ accessInstructions })}
          errorMessage={error(field("accessInstructions"))}
        />
      </Optional>
    </>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import type {
  AddOnChoice,
  Condition,
  NewHome,
  NewPremises,
  PremisesTypeChoice,
  PropertyKind,
  PropertyType,
  PropertyView,
  QuoteAskReceipt,
  QuoteAsk,
  Weekday,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
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
import {
  Optional,
  PrototypeSwitcher,
  SoftFields,
  useVariant,
} from "./prototype.tsx";
import { loadAddOns } from "./add-ons.ts";
import { loadPremisesTypes } from "./premises-types.ts";
import { submitQuoteRequest, type SubmitResult } from "./submit.ts";

// who is asking, which decides what the form needs from them (ADR-0006)
export type Asker =
  // the landing page: everything, including contact details
  | { kind: "guest" }
  // signed up but not yet a Client: their proven email is used
  | { kind: "account"; email: string }
  // a Client: a new home or one of theirs; their details are already known.
  // A home with a Quote open can't be asked about again, so it is
  // listed but not selectable. A business Client's name isn't asked again.
  | {
      kind: "client";
      properties: PropertyView[];
      waiting?: string[];
      businessName?: string | null;
    }
  // Office Staff entering a caller's request (#34): for a Client they found,
  // with their homes as for a Client, or a new one, whose email is optional
  | {
      kind: "office";
      client: {
        id: string;
        properties: PropertyView[];
        waiting: string[];
        businessName: string | null;
      } | null;
    };

export type QuoteRequestFormProps<R = QuoteAskReceipt> = {
  asker: Asker;
  // the API's origin; "" when the page is served alongside it (the web app)
  apiUrl?: string;
  // the level of the form's section headings: one below the page's heading
  // it sits under, so the outline never skips a level
  headingLevel?: 2 | 3;
  // where the request goes, if not the API's own endpoint for asking
  submit?: (body: object) => Promise<SubmitResult<R>>;
  onSubmitted: (receipt: R) => void;
};

// the form speaks to whoever fills it in: the person asking, or Office Staff
// on a caller's behalf
const ownWords = {
  what: "What needs cleaning?",
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
  waiting: "This home has a Quote open already.",
  premisesWaiting: "These premises have a Quote open already.",
  businessName: "Business name",
  contactNote: "The person we'll deal with at the business.",
  failed:
    "Your request didn't go through. Please try again, or call us on (646) 320-9076.",
};
const officeWords: typeof ownWords = {
  what: "What needs cleaning?",
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
  waiting: "This home has a Quote open already.",
  premisesWaiting: "These premises have a Quote open already.",
  businessName: "Business name",
  contactNote: "The person we'll deal with at the business.",
  failed: "The request didn't save. Please try again.",
};

const NEW_PLACE = "new";

const conditions: { value: Condition; label: string; description: string }[] = [
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
  bedrooms: 2,
  bathrooms: 1,
  storeys: 1,
  pets: false,
  floorArea: null,
  accessInstructions: "",
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

type Option = {
  value: string;
  label: string;
  // PROTOTYPE: the label on a segment, when the full one is too long
  short?: string;
  description?: string;
};

// PROTOTYPE (#96): a one-of choice, as radio boxes (A) or a segmented control
// showing only the picked option's description (B–D)
function OneOf({
  quiet,
  label,
  options,
  value,
  onChange,
  name,
  errorMessage,
  isRequired,
  horizontal,
}: {
  quiet: boolean;
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  errorMessage?: string;
  isRequired?: boolean;
  horizontal?: boolean;
}) {
  if (quiet) {
    const picked = options.find((o) => o.value === value);
    return (
      <SegmentedControl
        label={label}
        name={name}
        isRequired={isRequired}
        value={value}
        onChange={onChange}
        errorMessage={errorMessage}
        description={picked?.description}
      >
        {options.map((o) => (
          <Segment key={o.value} value={o.value}>
            {o.short ?? o.label}
          </Segment>
        ))}
      </SegmentedControl>
    );
  }
  return (
    <RadioGroup
      label={label}
      name={name}
      isRequired={isRequired}
      orientation={horizontal ? "horizontal" : "vertical"}
      value={value}
      onChange={onChange}
      errorMessage={errorMessage}
    >
      {options.map((o) => (
        <Radio key={o.value} value={o.value} description={o.description}>
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}

// a group of fields under a heading
function Group({
  title,
  headingLevel,
  children,
}: {
  title: string;
  headingLevel: 2 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="contents">
        <Heading level={headingLevel} size={3}>
          {title}
        </Heading>
      </legend>
      {children}
    </fieldset>
  );
}

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

// the Request a Quote form, shared by the landing page (Guests), the Client
// portal and the Office (callers). The API validates everything; its
// messages show beside each field.
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
  const waiting = new Set(placesOf?.waiting);
  // a business Client's name, which isn't asked again
  const knownBusinessName = placesOf?.businessName ?? null;
  // contact details: a Guest's or Account's own, or a new caller's
  const asksContact =
    asker.kind === "guest" ||
    asker.kind === "account" ||
    (asker.kind === "office" && !asker.client);
  const firstFree = (kind: PropertyKind) =>
    ownPlaces.find((p) => p.kind === kind && !waiting.has(p.id));
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [kind, setKind] = useState<PropertyKind>(
    firstFree("residential") || !firstFree("commercial")
      ? "residential"
      : "commercial",
  );
  const [place, setPlace] = useState<string>(firstFree(kind)?.id ?? NEW_PLACE);
  const [newHome, setNewHome] = useState<NewHome>(blankHome);
  const [newPremises, setNewPremises] = useState<NewPremises>(blankPremises);
  const [condition, setCondition] = useState<Condition>(
    firstFree("residential")?.condition ?? "moderate",
  );
  const [offered, setOffered] = useState<AddOnChoice[]>([]);
  const [premisesTypes, setPremisesTypes] = useState<PremisesTypeChoice[]>();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [wantsRegularService, setWantsRegularService] = useState(false);
  const [businessName, setBusinessName] = useState("");
  // business premises: regular cleaning on some weekdays, or a one-off
  const [regular, setRegular] = useState(true);
  const [days, setDays] = useState<Set<Weekday>>(new Set());
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [isSending, setSending] = useState(false);
  // PROTOTYPE (#96): which variant, and in steps (D) which step
  const v = useVariant();
  const [step, setStep] = useState(0);

  useEffect(() => {
    void loadAddOns(apiUrl).then(setOffered);
  }, [apiUrl]);
  useEffect(() => {
    void loadPremisesTypes(apiUrl).then(setPremisesTypes);
  }, [apiUrl]);

  const premises = kind === "commercial";
  const places = ownPlaces.filter((p) => p.kind === kind);

  const chooseKind = (next: PropertyKind) => {
    setKind(next);
    setPlace(firstFree(next)?.id ?? NEW_PLACE);
    setFieldErrors({});
    setRefusal(undefined);
  };

  const toggleAddOn = (key: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleDay = (day: Weekday, on: boolean) =>
    setDays((current) => {
      const next = new Set(current);
      if (on) next.add(day);
      else next.delete(day);
      return next;
    });

  // the new Property as the API takes it: empty optional fields as null
  const newPlace = () => {
    const fresh = premises ? newPremises : newHome;
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
    property: place === NEW_PLACE ? { new: newPlace() } : { existing: place },
    notes: notes || null,
    ...(premises
      ? {
          businessName: knownBusinessName ?? (businessName || null),
          wantsRegularService: regular,
          weekdays: regular
            ? weekdays.map((w) => w.day).filter((d) => days.has(d))
            : [],
          preferredTime: regular ? preferredTime : null,
        }
      : {
          condition,
          wantsRegularService,
          // in the order offered, only those still offered
          addOns: offered.filter((a) => chosen.has(a.key)).map((a) => a.key),
        }),
  });

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
      // PROTOTYPE: in steps, go back to the first step with a message
      const first = Object.keys(result.fieldErrors)[0];
      if (v.steps && first) setStep(stepOf(first));
      // an Add-on withdrawn since the form loaded: say so, and show what is
      // on offer now
      const addOnError = Object.entries(result.fieldErrors).find(([path]) =>
        path.startsWith("addOns"),
      );
      if (addOnError) {
        setRefusal(
          "Some of the extras you chose are no longer offered. Please check your choices.",
        );
        void loadAddOns(apiUrl).then(setOffered);
      }
    } else if (result.refusal) {
      setRefusal(result.refusal);
    } else {
      setFailed(true);
    }
  };

  // a field's message from the API, by its path in the request
  const error = (path: string) => fieldErrors[path];

  const kindField = (
    <OneOf
      quiet={v.quiet}
      horizontal
      label={words.what}
      options={[
        { value: "residential", label: "A home" },
        { value: "commercial", label: "Business premises" },
      ]}
      value={kind}
      onChange={(value) => chooseKind(value as PropertyKind)}
    />
  );

  const contactFields = asksContact && (
    <>
      {premises && (
        <BusinessName
          label={words.businessName}
          value={businessName}
          onChange={setBusinessName}
          error={error("businessName")}
        />
      )}
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
  const placeFields = (part: "all" | "where") => (
    <>
      {premises && !asksContact && !knownBusinessName && (
        <BusinessName
          label={words.businessName}
          value={businessName}
          onChange={setBusinessName}
          error={error("businessName")}
        />
      )}

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
              isDisabled={waiting.has(p.id)}
              description={
                waiting.has(p.id)
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

      {place === NEW_PLACE && newPlaceFields(part)}
    </>
  );

  const newPlaceFields = (part: "all" | "where" | "details") =>
    premises ? (
      <NewPremisesFields
        part={part}
        tuck={v.tuck}
        premises={newPremises}
        premisesTypes={premisesTypes}
        update={(change) =>
          setNewPremises((current) => ({ ...current, ...change }))
        }
        error={error}
      />
    ) : (
      <NewHomeFields
        part={part}
        quiet={v.quiet}
        tuck={v.tuck}
        home={newHome}
        update={(change) =>
          setNewHome((current) => ({ ...current, ...change }))
        }
        error={error}
      />
    );

  const conditionField = (
    <OneOf
      quiet={v.quiet}
      label="How much cleaning does it need?"
      name="condition"
      isRequired
      options={conditions}
      value={condition}
      onChange={(value) => setCondition(value as Condition)}
      errorMessage={error("condition")}
    />
  );

  const whenFields = (
    <>
      <OneOf
        quiet={v.quiet}
        label="How often?"
        options={[
          {
            value: "regular",
            label: "Regularly, on set days each week",
            short: "Regularly",
            description: "On set days each week",
          },
          { value: "one_off", label: "A one-off clean", short: "One-off" },
        ]}
        value={regular ? "regular" : "one_off"}
        onChange={(value) => setRegular(value === "regular")}
      />
      {regular && (
        <>
          {v.quiet ? (
            <ChipGroup
              label="Which days?"
              value={[...days].map(String)}
              onChange={(value) =>
                setDays(new Set(value.map((d) => Number(d) as Weekday)))
              }
              errorMessage={error("weekdays")}
            >
              {weekdays.map(({ day, label }) => (
                <Chip key={day} value={String(day)} aria-label={label}>
                  {label.slice(0, 3)}
                </Chip>
              ))}
            </ChipGroup>
          ) : (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-semibold text-fg">
                Which days?
              </legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
                {weekdays.map(({ day, label }) => (
                  <Checkbox
                    key={day}
                    isSelected={days.has(day)}
                    onChange={(on) => toggleDay(day, on)}
                  >
                    {label}
                  </Checkbox>
                ))}
              </div>
              {error("weekdays") && (
                <p className="text-sm font-medium text-danger-strong">
                  {error("weekdays")}
                </p>
              )}
            </fieldset>
          )}
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

  const extrasFields =
    offered.length === 0 ? null : v.quiet ? (
      <ChipGroup
        label="Any extras?"
        description={words.extrasNote}
        value={[...chosen]}
        onChange={(value) => setChosen(new Set(value))}
      >
        {offered.map((addOn) => (
          <Chip key={addOn.key} value={addOn.key}>
            {addOn.name}
          </Chip>
        ))}
      </ChipGroup>
    ) : (
      <fieldset className="flex flex-col gap-1">
        <legend className="contents">
          <Heading level={headingLevel} size={3}>
            Any extras?
          </Heading>
        </legend>
        <p className="text-sm text-fg-muted">{words.extrasNote}</p>
        {offered.map((addOn) => (
          <Checkbox
            key={addOn.key}
            isSelected={chosen.has(addOn.key)}
            onChange={(on) => toggleAddOn(addOn.key, on)}
          >
            {addOn.name}
          </Checkbox>
        ))}
      </fieldset>
    );

  const regularField = (
    <Checkbox
      isSelected={wantsRegularService}
      onChange={setWantsRegularService}
    >
      {words.regular}
    </Checkbox>
  );

  const notesField = (
    <Optional tuck={v.tuck} add="Add a note" hasValue={!!notes}>
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

  const notices = (
    <>
      {refusal && <Notice>{refusal}</Notice>}
      {failed && <Notice tone="danger">{words.failed}</Notice>}
    </>
  );

  // PROTOTYPE (#96): D asks one group per step: what and where, then about
  // the place, then who (when the form asks)
  const steps = [
    {
      title: words.what,
      body: (
        <>
          {kindField}
          {placeFields("where")}
        </>
      ),
    },
    {
      title: premises ? words.premises : words.home,
      body: premises ? (
        <>
          {place === NEW_PLACE && newPlaceFields("details")}
          <Heading level={headingLevel} size={3}>
            {words.when}
          </Heading>
          {whenFields}
          {!asksContact && notesField}
        </>
      ) : (
        <>
          {place === NEW_PLACE && newPlaceFields("details")}
          {conditionField}
          {extrasFields}
          {regularField}
          {!asksContact && notesField}
        </>
      ),
    },
    ...(asksContact
      ? [
          {
            title: words.details,
            body: (
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
  // the step a field the API refused is on
  const stepOf = (path: string) =>
    path.startsWith("contact") || (path === "businessName" && asksContact)
      ? steps.length - 1
      : /^property\.new\.(street|unit|postcode|type)$/.test(path) ||
          path === "businessName" ||
          path.startsWith("property.existing")
        ? 0
        : path === "notes"
          ? steps.length - 1
          : 1;

  if (v.steps) {
    return (
      <SoftFields on={v.soft}>
        <Form
          validationErrors={fieldErrors}
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast) void send();
            else setStep(at + 1);
          }}
        >
          <div className="flex flex-col gap-2">
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

          {steps[at]!.body}

          {isLast && notices}

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
        <PrototypeSwitcher variant={v} />
      </SoftFields>
    );
  }

  return (
    <SoftFields on={v.soft}>
      <Form
        validationErrors={fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {kindField}

        {asksContact && (
          <Group title={words.details} headingLevel={headingLevel}>
            {contactFields}
          </Group>
        )}

        <Group
          title={premises ? words.premises : words.home}
          headingLevel={headingLevel}
        >
          {placeFields("all")}
          {!premises && conditionField}
        </Group>

        {premises ? (
          <Group title={words.when} headingLevel={headingLevel}>
            {whenFields}
          </Group>
        ) : (
          <>
            {extrasFields}
            {regularField}
          </>
        )}

        {notesField}

        {notices}

        <Actions>
          <Button type="submit" isPending={isSending} className="sm:w-full">
            {words.submit}
          </Button>
        </Actions>
      </Form>
      <PrototypeSwitcher variant={v} />
    </SoftFields>
  );
}

function BusinessName({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  error?: string;
}) {
  return (
    <TextField
      label={label}
      name="businessName"
      autoComplete="organization"
      isRequired
      value={value}
      onChange={onChange}
      errorMessage={error}
    />
  );
}

// business premises: where, what kind and how big. The Condition and any
// extras are agreed after a visit, so they aren't asked. PROTOTYPE: `part`
// splits where from the rest for steps (D); `tuck` hides optional fields.
function NewPremisesFields({
  part,
  tuck,
  premises,
  premisesTypes,
  update,
  error,
}: {
  part: "all" | "where" | "details";
  tuck: boolean;
  premises: NewPremises;
  // undefined while loading
  premisesTypes: PremisesTypeChoice[] | undefined;
  update: (change: Partial<NewPremises>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewPremises) => `property.new.${name}`;

  return (
    <>
      {part !== "details" && (
        <AddressFields
          tuck={tuck}
          place={premises}
          unitLabel="Suite, floor or unit (optional)"
          addUnit="Add a suite, floor or unit"
          update={update}
          error={error}
        />
      )}
      {part !== "where" && (
        <>
          {premisesTypes?.length === 0 ? (
            <Notice tone="danger">
              We couldn't load the types of premises. Please try again, or call
              us on (646) 320-9076.
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
            tuck={tuck}
            add="Add the floor area"
            hasValue={premises.floorArea !== null}
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
            tuck={tuck}
            add="Add how we get in"
            hasValue={!!premises.accessInstructions}
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
      )}
    </>
  );
}

// a Property's address: street, unit and ZIP code
function AddressFields({
  tuck,
  place,
  unitLabel,
  addUnit,
  update,
  error,
}: {
  tuck: boolean;
  place: Pick<NewHome, "street" | "unit" | "postcode">;
  unitLabel: string;
  addUnit: string;
  update: (
    change: Partial<Pick<NewHome, "street" | "unit" | "postcode">>,
  ) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: string) => `property.new.${name}`;
  const unit = (
    <TextField
      label={unitLabel}
      name={field("unit")}
      autoComplete="address-line2"
      value={place.unit ?? ""}
      onChange={(unit) => update({ unit })}
      errorMessage={error(field("unit"))}
    />
  );
  const postcode = (
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
  );

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
      {tuck ? (
        <>
          <Optional tuck add={addUnit} hasValue={!!place.unit}>
            {unit}
          </Optional>
          <div className="sm:w-1/2">{postcode}</div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {unit}
          {postcode}
        </div>
      )}
    </>
  );
}

function NewHomeFields({
  part,
  quiet,
  tuck,
  home,
  update,
  error,
}: {
  part: "all" | "where" | "details";
  quiet: boolean;
  tuck: boolean;
  home: NewHome;
  update: (change: Partial<NewHome>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewHome) => `property.new.${name}`;

  return (
    <>
      {part !== "details" && (
        <>
          <OneOf
            quiet={quiet}
            horizontal
            label="Type of home"
            name={field("type")}
            options={[
              { value: "house", label: "House" },
              { value: "apartment", label: "Apartment" },
              { value: "townhouse", label: "Townhouse" },
            ]}
            value={home.type}
            onChange={(type) => update({ type: type as PropertyType })}
            errorMessage={error(field("type"))}
          />
          <AddressFields
            tuck={tuck}
            place={home}
            unitLabel="Apartment or unit (optional)"
            addUnit="Add an apartment or unit"
            update={update}
            error={error}
          />
        </>
      )}
      {part !== "where" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Bedrooms"
              name={field("bedrooms")}
              description="0 for a studio"
              minValue={0}
              maxValue={20}
              value={home.bedrooms}
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
              value={home.bathrooms}
              onChange={(bathrooms) => update({ bathrooms })}
              errorMessage={error(field("bathrooms"))}
            />
            <NumberField
              label="Floors"
              name={field("storeys")}
              minValue={1}
              maxValue={5}
              value={home.storeys}
              onChange={(storeys) => update({ storeys })}
              errorMessage={error(field("storeys"))}
            />
          </div>
          <Optional
            tuck={tuck}
            add="Add the floor area"
            hasValue={home.floorArea !== null}
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
          <Checkbox
            isSelected={home.pets}
            onChange={(pets) => update({ pets })}
          >
            There are pets at home
          </Checkbox>
          <Optional
            tuck={tuck}
            add="Add how we get in"
            hasValue={!!home.accessInstructions}
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
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import type {
  AddOnChoice,
  Condition,
  NewProperty,
  PropertyType,
  PropertyView,
  QuoteRequestReceipt,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Checkbox,
  Form,
  Heading,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
} from "@empire-cleaning/ui";
import { loadAddOns } from "./add-ons.ts";
import { submitQuoteRequest, type SubmitResult } from "./submit.ts";

// who is asking, which decides what the form needs from them (ADR-0006)
export type Asker =
  // the landing page: everything, including contact details
  | { kind: "guest" }
  // signed up but not yet a Client: their proven email is used
  | { kind: "account"; email: string }
  // a Client: a new home or one of theirs; their details are already known.
  // A home with a request still waiting can't be asked about again, so it is
  // listed but not selectable.
  | { kind: "client"; properties: PropertyView[]; waiting?: string[] }
  // Office Staff entering a caller's request (#34): for a Client they found,
  // with their homes as for a Client, or a new one, whose email is optional
  | {
      kind: "office";
      client: {
        id: string;
        properties: PropertyView[];
        waiting: string[];
      } | null;
    };

export type QuoteRequestFormProps<R = QuoteRequestReceipt> = {
  asker: Asker;
  // the API's origin; "" when the page is served alongside it (the web app)
  apiUrl?: string;
  // the level of the form's section headings: one below the page's heading
  // it sits under, so the outline never skips a level
  headingLevel?: 2 | 3;
  // where the request goes, if not the API's own Quote Request endpoint
  submit?: (body: object) => Promise<SubmitResult<R>>;
  onSubmitted: (receipt: R) => void;
};

// the form speaks to whoever fills it in: the person asking, or Office Staff
// on a caller's behalf
const ownWords = {
  details: "Your details",
  email: "Email",
  emailNote: "We'll email your Quote here.",
  phoneNote: "Your Cleaners can reach you on the day.",
  home: "Your home",
  extrasNote: "Optional. Your Quote will show what each one costs.",
  regular:
    "After my first clean, I'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
  submit: "Request a Quote",
  waiting: "We're preparing your Quote for this home.",
  failed:
    "Your request didn't go through. Please try again, or call us on (646) 320-9076.",
};
const officeWords: typeof ownWords = {
  details: "Their details",
  email: "Email (optional)",
  emailNote:
    "Their Quote is emailed here. Without an email it can't be sent until one is added.",
  phoneNote: "Their Cleaners can reach them on the day.",
  home: "Their home",
  extrasNote: "Optional. The Quote shows what each one costs.",
  regular:
    "After their first clean, they'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
  submit: "Draft a Quote",
  waiting: "A Quote Request for this home is waiting already.",
  failed: "The request didn't save. Please try again.",
};

const NEW_HOME = "new";

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

const blankHome: NewProperty = {
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

const addressOf = (p: Pick<PropertyView, "street" | "unit" | "postcode">) =>
  [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

// the Quote Request form, shared by the landing page (Guests), the Client
// portal and the Office (callers). The API validates everything; its
// messages show beside each field.
export function QuoteRequestForm<R = QuoteRequestReceipt>({
  asker,
  apiUrl = "",
  headingLevel = 3,
  submit,
  onSubmitted,
}: QuoteRequestFormProps<R>) {
  const words = asker.kind === "office" ? officeWords : ownWords;
  // whose homes are offered: a Client's own, or the one the Office found
  const homesOf =
    asker.kind === "client"
      ? asker
      : asker.kind === "office"
        ? asker.client
        : null;
  const ownHomes = homesOf?.properties ?? [];
  const waiting = new Set(homesOf?.waiting);
  // contact details: a Guest's or Account's own, or a new caller's
  const asksContact =
    asker.kind === "guest" ||
    asker.kind === "account" ||
    (asker.kind === "office" && !asker.client);
  const firstFree = ownHomes.find((p) => !waiting.has(p.id));
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [home, setHome] = useState<string>(firstFree?.id ?? NEW_HOME);
  const [newHome, setNewHome] = useState<NewProperty>(blankHome);
  const [condition, setCondition] = useState<Condition>(
    firstFree?.condition ?? "moderate",
  );
  const [offered, setOffered] = useState<AddOnChoice[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [wantsRegularService, setWantsRegularService] = useState(false);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [isSending, setSending] = useState(false);

  useEffect(() => {
    void loadAddOns(apiUrl).then(setOffered);
  }, [apiUrl]);

  const toggleAddOn = (key: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const updateHome = (change: Partial<NewProperty>) =>
    setNewHome((current) => ({ ...current, ...change }));

  // a Quote Request, or for the Office, one with its Client: one they found
  // or a new one, without an email if they gave none
  const submission = (): QuoteRequestSubmission & {
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
      home === NEW_HOME
        ? {
            new: {
              ...newHome,
              unit: newHome.unit || null,
              accessInstructions: newHome.accessInstructions || null,
            },
          }
        : { existing: home },
    condition,
    wantsRegularService,
    // in the order offered, only those still offered
    addOns: offered.filter((a) => chosen.has(a.key)).map((a) => a.key),
    notes: notes || null,
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

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {asksContact && (
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <Heading level={headingLevel} size={3}>
              {words.details}
            </Heading>
          </legend>
          <TextField
            label="Full name"
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
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="contents">
          <Heading level={headingLevel} size={3}>
            {words.home}
          </Heading>
        </legend>

        {ownHomes.length > 0 && (
          <RadioGroup
            label="Which home?"
            value={home}
            onChange={(id) => {
              setHome(id);
              const chosen = ownHomes.find((p) => p.id === id);
              if (chosen) setCondition(chosen.condition);
            }}
          >
            {ownHomes.map((p) => (
              <Radio
                key={p.id}
                value={p.id}
                isDisabled={waiting.has(p.id)}
                description={waiting.has(p.id) ? words.waiting : undefined}
              >
                {addressOf(p)}
              </Radio>
            ))}
            <Radio value={NEW_HOME}>A different home</Radio>
          </RadioGroup>
        )}

        {home === NEW_HOME && (
          <NewHomeFields home={newHome} update={updateHome} error={error} />
        )}

        <RadioGroup
          label="How much cleaning does it need?"
          name="condition"
          isRequired
          value={condition}
          onChange={(value) => setCondition(value as Condition)}
          errorMessage={error("condition")}
        >
          {conditions.map((c) => (
            <Radio key={c.value} value={c.value} description={c.description}>
              {c.label}
            </Radio>
          ))}
        </RadioGroup>
      </fieldset>

      {offered.length > 0 && (
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
      )}

      <Checkbox
        isSelected={wantsRegularService}
        onChange={setWantsRegularService}
      >
        {words.regular}
      </Checkbox>

      <TextField
        label="Anything else we should know?"
        name="notes"
        multiline
        value={notes}
        onChange={setNotes}
        errorMessage={error("notes")}
      />

      {refusal && <Notice>{refusal}</Notice>}

      {failed && <Notice tone="danger">{words.failed}</Notice>}

      <Actions>
        <Button type="submit" isPending={isSending} className="sm:w-full">
          {words.submit}
        </Button>
      </Actions>
    </Form>
  );
}

function NewHomeFields({
  home,
  update,
  error,
}: {
  home: NewProperty;
  update: (change: Partial<NewProperty>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewProperty) => `property.new.${name}`;

  return (
    <>
      <RadioGroup
        label="Type of home"
        orientation="horizontal"
        name={field("type")}
        value={home.type}
        onChange={(type) => update({ type: type as PropertyType })}
        errorMessage={error(field("type"))}
      >
        <Radio value="house">House</Radio>
        <Radio value="apartment">Apartment</Radio>
        <Radio value="townhouse">Townhouse</Radio>
      </RadioGroup>
      <TextField
        label="Street address"
        name={field("street")}
        autoComplete="address-line1"
        isRequired
        value={home.street}
        onChange={(street) => update({ street })}
        errorMessage={error(field("street"))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Apartment or unit (optional)"
          name={field("unit")}
          autoComplete="address-line2"
          value={home.unit ?? ""}
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
          value={home.postcode}
          onChange={(postcode) => update({ postcode })}
          errorMessage={error(field("postcode"))}
        />
      </div>
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
      <Checkbox isSelected={home.pets} onChange={(pets) => update({ pets })}>
        There are pets at home
      </Checkbox>
      <TextField
        label="How do we get in? (optional)"
        name={field("accessInstructions")}
        multiline
        description="Door codes, where the key is, parking. Only your Cleaners see this."
        value={home.accessInstructions ?? ""}
        onChange={(accessInstructions) => update({ accessInstructions })}
        errorMessage={error(field("accessInstructions"))}
      />
    </>
  );
}

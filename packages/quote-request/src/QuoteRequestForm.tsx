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
import { submitQuoteRequest } from "./submit.ts";

// who is asking, which decides what the form needs from them (ADR-0006)
export type Asker =
  // the landing page: everything, including contact details
  | { kind: "guest" }
  // signed up but not yet a Client: their proven email is used
  | { kind: "account"; email: string }
  // a Client: a new home or one of theirs; their details are already known.
  // A home with a request still waiting can't be asked about again, so it is
  // listed but not selectable.
  | { kind: "client"; properties: PropertyView[]; waiting?: string[] };

export type QuoteRequestFormProps = {
  asker: Asker;
  // the API's origin; "" when the page is served alongside it (the web app)
  apiUrl?: string;
  // the level of the form's section headings: one below the page's heading
  // it sits under, so the outline never skips a level
  headingLevel?: 2 | 3;
  onSubmitted: (receipt: QuoteRequestReceipt) => void;
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

// the Quote Request form, shared by the landing page (Guests) and the Client
// portal. The API validates everything; its messages show beside each field.
export function QuoteRequestForm({
  asker,
  apiUrl = "",
  headingLevel = 3,
  onSubmitted,
}: QuoteRequestFormProps) {
  const ownHomes = asker.kind === "client" ? asker.properties : [];
  const waiting = new Set(asker.kind === "client" ? asker.waiting : []);
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

  const submission = (): QuoteRequestSubmission => ({
    ...(asker.kind === "guest" && { contact }),
    ...(asker.kind === "account" && {
      contact: { name: contact.name, phone: contact.phone },
    }),
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
    const result = await submitQuoteRequest(
      apiUrl,
      submission(),
      asker.kind === "guest",
    );
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
      {asker.kind !== "client" && (
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <Heading level={headingLevel} size={3}>
              Your details
            </Heading>
          </legend>
          <TextField
            label="Full name"
            name="contact.name"
            autoComplete="name"
            isRequired
            value={contact.name}
            onChange={(name) => setContact({ ...contact, name })}
            errorMessage={error("contact.name")}
          />
          {asker.kind === "guest" ? (
            <TextField
              label="Email"
              name="contact.email"
              type="email"
              autoComplete="email"
              isRequired
              description="We'll email your Quote here."
              value={contact.email}
              onChange={(email) => setContact({ ...contact, email })}
              errorMessage={error("contact.email")}
            />
          ) : (
            <p className="text-sm text-fg-muted">
              We'll email your Quote to {asker.email}.
            </p>
          )}
          <TextField
            label="Phone"
            name="contact.phone"
            type="tel"
            autoComplete="tel"
            isRequired
            description="Your Cleaners can reach you on the day."
            value={contact.phone}
            onChange={(phone) => setContact({ ...contact, phone })}
            errorMessage={error("contact.phone")}
          />
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="contents">
          <Heading level={headingLevel} size={3}>
            Your home
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
                description={
                  waiting.has(p.id)
                    ? "We're preparing your Quote for this home."
                    : undefined
                }
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
          <p className="text-sm text-fg-muted">
            Optional. Your Quote will show what each one costs.
          </p>
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
        After my first clean, I'd like regular visits (weekly, bi-weekly or
        monthly) at 10% off.
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

      {failed && (
        <Notice tone="danger">
          Your request didn't go through. Please try again, or call us on (646)
          320-9076.
        </Notice>
      )}

      <Actions>
        <Button type="submit" isPending={isSending} className="sm:w-full">
          Request a Quote
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

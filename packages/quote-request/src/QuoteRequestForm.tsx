import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Building2,
  House,
  Houses,
  PaintRoller,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type {
  AddOnChoice,
  Condition,
  HomeRooms,
  Language,
  NewHome,
  NewPremises,
  OpenQuote,
  PremisesTypeChoice,
  PropertyKind,
  PropertyType,
  PropertyView,
  QuoteAskReceipt,
  QuoteAsk,
  QuoteSource,
  ServiceIcon,
  ServiceOffer,
  Weekday,
} from "@empire-cleaning/models";
import { PICK_TIMES, formats, messages } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  ChoiceTile,
  ChoiceTiles,
  ChoiceTilesLoading,
  Form,
  Heading,
  Notice,
  Section,
  NumberField,
  Radio,
  RadioGroup,
  LanguagePicker,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  TextField,
  useLanguage,
} from "@empire-cleaning/ui";
import { loadAddOns } from "./add-ons.ts";
import { Optional } from "./Optional.tsx";
import { loadPremisesTypes } from "./premises-types.ts";
import { isHeld, loadServices, offeredAt } from "./services.ts";
import { submitQuoteRequest, type SubmitResult } from "./submit.ts";
import {
  accessHelp,
  conditions,
  officeWords,
  words as formWords,
} from "./words.ts";

type FormWords = (typeof formWords)["en"];

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
  // everything on one page, for the Office on the phone (#96): who's
  // calling first, with `contactActions` in its header; `before` above
  // the rest, and `aside` beside it on a wide screen, or after it
  page?: { before?: ReactNode; aside?: ReactNode; contactActions?: ReactNode };
  // what would be asked as it's filled in, once a Service is chosen
  onAskChange?: (ask: QuoteAsk | null) => void;
  // a Service to start with, by key, chosen once the Services arrive if
  // it's on offer; and regular visits already asked for (a page about a
  // Service, #177)
  start?: { serviceKey: string; regular?: boolean };
  // where a Guest is asking from on the landing site (#185), worked out as
  // they send it
  source?: () => QuoteSource;
};

const NEW_PLACE = "new";

// how many Services are usually on offer, for the blank tiles while they
// load: five or six fill the same rows on a phone (two a row) and wider
// (three a row), so either arrives without a jump
const USUAL_SERVICES = 6;

// each Service's picture, as the landing page's "What we clean" draws it
const serviceIcons: Record<ServiceIcon, LucideIcon> = {
  sparkles: Sparkles,
  house: House,
  truck: Truck,
  building: Building2,
  "paint-roller": PaintRoller,
  custom: SlidersHorizontal,
};

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

// a preferred start, from the times a picker offers, 5am to 11pm
const startTimes = PICK_TIMES.filter((t) => t >= "05:00" && t <= "23:00");

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
  page,
  onAskChange,
  start,
  source,
}: QuoteRequestFormProps<R>) {
  // the language it's in, as LanguageProvider gives it: the page's, or a
  // Client's Preferred Language; the Office's is English (ADR-0025). Its
  // requests say it, so the API's messages and the names it lists come in
  // it too
  const lang = useLanguage();
  const t = formWords[lang];
  const words = asker.kind === "office" ? officeWords : t.own;
  const { openAlready, quoteEmailedTo } = messages[lang];
  const { formatClock } = formats[lang];
  const weekdays = formats[lang].weekdays.map((label, day) => ({
    day: day as Weekday,
    label,
  }));
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
  // a new caller's Preferred Language, which the Office sets (ADR-0025)
  const [callerLanguage, setCallerLanguage] = useState<Language>("en");
  const [kind, setKind] = useState<PropertyKind>("residential");
  const [place, setPlace] = useState<string>(NEW_PLACE);
  const [newHome, setNewHome] = useState<NewHome>(blankHome);
  const [rooms, setRooms] = useState<HomeRooms>(blankRooms);
  const [newPremises, setNewPremises] = useState<NewPremises>(blankPremises);
  const [condition, setCondition] = useState<Condition>(
    firstFree("residential")?.condition ?? "moderate",
  );
  // the Add-ons loaded, with the Service they're for; asked for again after
  // a send refused some (addOnsAsked)
  const [loadedAddOns, setLoadedAddOns] = useState<{
    serviceKey: string;
    addOns: AddOnChoice[];
  }>();
  const [addOnsAsked, setAddOnsAsked] = useState(0);
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
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const [isSending, setSending] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    void loadServices(apiUrl, lang).then(setServices);
  }, [apiUrl, lang]);
  // the Service to start with, once, as the Services arrive
  const startWith = useEffectEvent((services: ServiceOffer[]) => {
    if (!start || serviceKey) return;
    if (!services.some((s) => s.key === start.serviceKey)) return;
    chooseService(start.serviceKey);
    if (start.regular) setWantsRegularService(true);
  });
  useEffect(() => {
    if (services) startWith(services);
  }, [services]);
  // a home's Add-ons are the Service's own: those of the one chosen now,
  // never a slower answer for one chosen before, and none till they come
  useEffect(() => {
    if (!serviceKey) return;
    let current = true;
    void loadAddOns(apiUrl, lang, serviceKey).then(
      (addOns) => current && setLoadedAddOns({ serviceKey, addOns }),
    );
    return () => {
      current = false;
    };
  }, [apiUrl, lang, serviceKey, addOnsAsked]);
  const offered =
    loadedAddOns?.serviceKey === serviceKey ? loadedAddOns.addOns : [];
  useEffect(() => {
    void loadPremisesTypes(apiUrl, lang).then(setPremisesTypes);
  }, [apiUrl, lang]);

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
  // or a new one, without an email if they gave none, in the language set
  const submission = (): QuoteAsk & {
    clientId?: string;
    contact?: { email?: string | null; preferredLanguage?: Language };
  } => ({
    ...(asker.kind === "guest" && { contact }),
    ...(asker.kind === "guest" && source && { source: source() }),
    ...(asker.kind === "guest" && website && { website }),
    ...(asker.kind === "account" && {
      contact: { name: contact.name, phone: contact.phone },
    }),
    ...(asker.kind === "office" &&
      (asker.client
        ? { clientId: asker.client.id }
        : {
            contact: {
              ...contact,
              email: contact.email || null,
              preferredLanguage: callerLanguage,
            },
          })),
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

  // what's asked so far, for a page showing what it comes to
  const asked = serviceKey ? JSON.stringify(submission()) : null;
  const tellAsked = useEffectEvent((asked: string | null) =>
    onAskChange?.(asked === null ? null : (JSON.parse(asked) as QuoteAsk)),
  );
  useEffect(() => tellAsked(asked), [asked]);

  // a field's message from the API, by its path in the request
  const error = (path: string) => fieldErrors[path];

  // the Services on offer as tiles, the one chosen saying what it is.
  // Nothing is chosen at first: the Client says what they want. Until they
  // arrive, blank tiles hold their room (as many as are usually offered), so
  // the form doesn't jump when they do.
  const serviceField =
    services === undefined ? (
      <ChoiceTilesLoading label={words.service} count={USUAL_SERVICES} />
    ) : services.length === 0 ? (
      <Notice tone="danger">{words.servicesFailed}</Notice>
    ) : (
      <ChoiceTiles
        label={words.service}
        name="serviceKey"
        isRequired
        value={serviceKey}
        onChange={chooseService}
        description={service?.description}
        errorMessage={error("serviceKey")}
      >
        {services.map((s) => (
          <ChoiceTile key={s.key} value={s.key} icon={serviceIcons[s.icon]}>
            {s.name}
          </ChoiceTile>
        ))}
      </ChoiceTiles>
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
        {t.house}
      </ChoiceTile>
      <ChoiceTile value="apartment" icon={Building2}>
        {t.apartment}
      </ChoiceTile>
      <ChoiceTile value="townhouse" icon={Houses}>
        {t.townhouse}
      </ChoiceTile>
      {forPremises && (
        <ChoiceTile value="commercial" icon={Store}>
          {t.aBusiness}
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
        label={t.fullName}
        description={premises ? words.contactNote : undefined}
        name="contact.name"
        autoComplete={asker.kind === "office" ? "off" : "name"}
        isRequired
        value={contact.name}
        onChange={(name) => setContact({ ...contact, name })}
        errorMessage={error("contact.name")}
      />
      {asker.kind === "account" ? (
        <p className="text-sm text-fg-muted">{quoteEmailedTo(asker.email)}</p>
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
        label={t.phone}
        name="contact.phone"
        type="tel"
        autoComplete={asker.kind === "office" ? "off" : "tel"}
        isRequired
        description={words.phoneNote}
        value={contact.phone}
        onChange={(phone) => setContact({ ...contact, phone })}
        errorMessage={error("contact.phone")}
      />
      {asker.kind === "office" && (
        <LanguagePicker
          label="Preferred language"
          value={callerLanguage}
          onChange={setCallerLanguage}
          description="Their screens and emails come in it."
        />
      )}
      {asker.kind === "guest" && (
        // a field people never see or reach, for bots that fill in every
        // field; filled, the ask is quietly dropped (#32)
        <input
          aria-hidden
          aria-label="Website"
          tabIndex={-1}
          autoComplete="off"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] size-px"
        />
      )}
    </>
  );

  // which of their places, or where a new one is
  const whereFields = (
    <>
      {places.length > 0 && (
        <RadioGroup
          label={premises ? t.whichBusiness : t.whichHome}
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
                  ? openAlready(premises ? "commercial" : "residential")
                  : undefined
              }
            >
              {addressOf(p)}
            </Radio>
          ))}
          <Radio value={NEW_PLACE}>
            {premises ? t.differentBusiness : t.differentHome}
          </Radio>
        </RadioGroup>
      )}

      {place === NEW_PLACE &&
        (premises ? (
          <AddressFields
            place={newPremises}
            unitLabel={t.premisesUnit}
            t={t}
            update={(change) =>
              setNewPremises((current) => ({ ...current, ...change }))
            }
            error={error}
          />
        ) : (
          <AddressFields
            place={newHome}
            unitLabel={t.homeUnit}
            t={t}
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
      label={t.area}
      name="area"
      description={t.areaNote}
      minValue={10}
      maxValue={1_000_000}
      step={50}
      value={area ?? Number.NaN}
      onChange={(value) => setArea(Number.isNaN(value) ? null : value)}
      errorMessage={error("area")}
    />
  );

  const notesField = (
    <Optional add={t.addNote} shown={!!notes || !!error("notes")}>
      <TextField
        label={t.notes}
        name="notes"
        multiline
        value={notes}
        onChange={setNotes}
        errorMessage={error("notes")}
      />
    </Optional>
  );

  // a home's rooms, where the Service is priced from them: a new home's, or
  // those of one of theirs that hasn't given them yet
  const roomsAt =
    place === NEW_PLACE && asksRooms
      ? "property.new"
      : givesRooms
        ? "property.rooms"
        : null;
  const updateRooms = (change: Partial<HomeRooms>) =>
    setRooms((current) => ({ ...current, ...change }));

  // how much cleaning it needs first, then the home's rooms and the extras,
  // its yes-or-no questions together, and what's optional last
  const homeFields = (
    <>
      {asksCondition && (
        <SegmentedControl
          label={t.condition}
          name="condition"
          isRequired
          value={condition}
          onChange={(value) => setCondition(value as Condition)}
          description={
            conditions[lang].find((c) => c.value === condition)?.description
          }
          errorMessage={error("condition")}
        >
          {conditions[lang].map((c) => (
            <Segment key={c.value} value={c.value}>
              {c.label}
            </Segment>
          ))}
        </SegmentedControl>
      )}
      {areaField}
      {roomsAt && (
        <RoomsFields
          rooms={rooms}
          at={roomsAt}
          update={updateRooms}
          error={error}
          t={t}
        />
      )}
      {offered.length > 0 && (
        <ChipGroup
          label={t.extras}
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
      {(roomsAt || canRecur) && (
        // each already a full touch target tall, so close together
        <div className="flex flex-col gap-1">
          {roomsAt && (
            <Checkbox
              isSelected={rooms.pets}
              onChange={(pets) => updateRooms({ pets })}
            >
              {t.pets}
            </Checkbox>
          )}
          {canRecur && (
            <Checkbox
              isSelected={wantsRegularService}
              onChange={setWantsRegularService}
            >
              {words.regular}
            </Checkbox>
          )}
        </div>
      )}
      {place === NEW_PLACE && (
        <NewHomeFields
          home={newHome}
          asksFloorArea={asksRooms}
          lang={lang}
          update={(change) =>
            setNewHome((current) => ({ ...current, ...change }))
          }
          error={error}
        />
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
        label={t.howOften}
        value={regular ? "regular" : "one_off"}
        onChange={(value) => setRegular(value === "regular")}
        description={regular ? t.regularNote : undefined}
      >
        <Segment value="regular">{t.regularly}</Segment>
        <Segment value="one_off">{t.oneOff}</Segment>
      </SegmentedControl>
      {regular && (
        <>
          <ChipGroup
            label={t.whichDays}
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
            label={t.startTime}
            name="preferredTime"
            placeholder={t.chooseTime}
            selectedKey={preferredTime}
            onSelectionChange={(key) => setPreferredTime(String(key))}
            errorMessage={error("preferredTime")}
          >
            {startTimes.map((time) => (
              <SelectItem key={time} id={time}>
                {formatClock(time)}
              </SelectItem>
            ))}
          </Select>
        </>
      )}
    </>
  );

  const updatePremises = (change: Partial<NewPremises>) =>
    setNewPremises((current) => ({ ...current, ...change }));

  const premisesFields = (
    <>
      {!asksContact && !knownBusinessName && businessNameField}
      {areaField}
      {place === NEW_PLACE && (
        <PremisesTypeField
          premises={newPremises}
          premisesTypes={premisesTypes}
          update={updatePremises}
          error={error}
          t={t}
        />
      )}
      {canRecur && whenFields}
      {/* what's optional, last */}
      {place === NEW_PLACE && (
        <NewPremisesFields
          premises={newPremises}
          update={updatePremises}
          error={error}
          lang={lang}
        />
      )}
    </>
  );

  const steps: { title: string; fields: ReactNode }[] = [
    { title: words.need, fields: serviceField },
    {
      title: kindField ? t.whatAndWhere : t.where,
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
          {/* on one page, the note goes with the place, not who is calling */}
          {(!asksContact || page) && notesField}
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
                {!page && notesField}
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
          lang,
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
        setRefusal(t.extrasGone);
        setAddOnsAsked((n) => n + 1);
      }
    } else if (result.refusal) {
      setRefusal(result.refusal);
    } else {
      setFailed(true);
    }
  };

  if (page) {
    const contact = steps.find((s) => s.title === words.details);
    const sections = [
      ...(contact ? [{ ...contact, actions: page.contactActions }] : []),
      ...steps
        .filter((s) => s !== contact)
        .map((s) => ({ ...s, actions: undefined })),
    ];
    return (
      <Form
        validationErrors={fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {/* in one column; `aside` beside it from xl, in view as it
            scrolls, or after the place below that */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {page.before}
          {sections.map((section) => (
            <Section
              key={section.title}
              title={section.title}
              headingLevel={headingLevel}
              actions={section.actions}
            >
              <Card>{section.fields}</Card>
            </Section>
          ))}
          {page.aside && (
            <div className="xl:sticky xl:top-6 xl:col-start-2 xl:row-span-6 xl:row-start-1 xl:self-start">
              {page.aside}
            </div>
          )}
          <div className="flex flex-col gap-5">
            {refusal && <Notice>{refusal}</Notice>}
            {failed && <Notice tone="danger">{words.failed}</Notice>}
            <Actions>
              <Button type="submit" isPending={isSending}>
                {words.submit}
              </Button>
            </Actions>
          </div>
        </div>
      </Form>
    );
  }

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
        <p className="text-sm text-fg-muted">{t.step(at + 1, steps.length)}</p>
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
            {t.back}
          </Button>
        )}
        <Button type="submit" isPending={isLast && isSending}>
          {isLast ? words.submit : t.next}
        </Button>
      </Actions>
    </Form>
  );
}

// new business premises: what kind they are. Where they are is asked first,
// what's optional last (NewPremisesFields). The Condition and any extras are
// agreed after a visit, so they aren't asked.
function PremisesTypeField({
  premises,
  premisesTypes,
  update,
  error,
  t,
}: {
  t: FormWords;
  premises: NewPremises;
  // undefined while loading
  premisesTypes: PremisesTypeChoice[] | undefined;
  update: (change: Partial<NewPremises>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewPremises) => `property.new.${name}`;

  return premisesTypes?.length === 0 ? (
    <Notice tone="danger">{t.typesFailed}</Notice>
  ) : (
    <Select
      label={t.typeOfBusiness}
      name={field("premisesType")}
      placeholder={t.chooseOne}
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
  );
}

// what's optional about new business premises, asked last: how big they
// are and what the Cleaners should know
function NewPremisesFields({
  premises,
  update,
  error,
  lang,
}: {
  lang: Language;
  premises: NewPremises;
  update: (change: Partial<NewPremises>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewPremises) => `property.new.${name}`;
  const t = formWords[lang];

  return (
    <>
      <Optional
        add={t.addFloorArea}
        shown={premises.floorArea !== null || !!error(field("floorArea"))}
      >
        <NumberField
          label={t.floorArea}
          name={field("floorArea")}
          description={t.floorAreaNote}
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
        add={t.addAccess}
        shown={
          !!premises.accessInstructions || !!error(field("accessInstructions"))
        }
      >
        <TextField
          label={t.access}
          name={field("accessInstructions")}
          multiline
          description={accessHelp[lang].commercial}
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
  t,
}: {
  t: FormWords;
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
        label={t.street}
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
          label={t.zip}
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

// a home's rooms, at `at` in the request; whether there are pets is asked
// with the form's other yes-or-no questions
function RoomsFields({
  rooms,
  at,
  update,
  error,
  t,
}: {
  t: FormWords;
  rooms: HomeRooms;
  at: string;
  update: (change: Partial<HomeRooms>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof HomeRooms) => `${at}.${name}`;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <NumberField
        label={t.bedrooms}
        name={field("bedrooms")}
        description={t.studio}
        minValue={0}
        maxValue={20}
        value={rooms.bedrooms}
        onChange={(bedrooms) => update({ bedrooms })}
        errorMessage={error(field("bedrooms"))}
      />
      <NumberField
        label={t.bathrooms}
        name={field("bathrooms")}
        description={t.halfBaths}
        minValue={0.5}
        maxValue={20}
        step={0.5}
        value={rooms.bathrooms}
        onChange={(bathrooms) => update({ bathrooms })}
        errorMessage={error(field("bathrooms"))}
      />
      <NumberField
        label={t.floors}
        name={field("storeys")}
        minValue={1}
        maxValue={5}
        value={rooms.storeys}
        onChange={(storeys) => update({ storeys })}
        errorMessage={error(field("storeys"))}
      />
    </div>
  );
}

// what's optional about a new home, asked last: its floor area, where the
// Service is priced from its rooms, and what the Cleaners should know. Its
// type and address are asked first, its rooms with the other questions.
function NewHomeFields({
  home,
  asksFloorArea,
  update,
  error,
  lang,
}: {
  lang: Language;
  home: NewHome;
  asksFloorArea: boolean;
  update: (change: Partial<NewHome>) => void;
  error: (path: string) => string | undefined;
}) {
  const field = (name: keyof NewHome) => `property.new.${name}`;
  const t = formWords[lang];

  return (
    <>
      {asksFloorArea && (
        <Optional
          add={t.addFloorArea}
          shown={home.floorArea !== null || !!error(field("floorArea"))}
        >
          <NumberField
            label={t.floorArea}
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
      )}
      <Optional
        add={t.addAccess}
        shown={
          !!home.accessInstructions || !!error(field("accessInstructions"))
        }
      >
        <TextField
          label={t.access}
          name={field("accessInstructions")}
          multiline
          description={accessHelp[lang].residential}
          value={home.accessInstructions ?? ""}
          onChange={(accessInstructions) => update({ accessInstructions })}
          errorMessage={error(field("accessInstructions"))}
        />
      </Optional>
    </>
  );
}

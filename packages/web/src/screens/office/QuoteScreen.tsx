import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  CleanType,
  Condition,
  FirstCleanFindings,
  OfficeQuote,
  OfficeQuoteOption,
  PlanChange,
  QuoteDraftInput,
  Recurrence,
  ScheduleDay,
  ServicePlanInput,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  NumberField,
  Radio,
  RadioCard,
  RadioGroup,
  Select,
  SelectItem,
  TextField,
  TimeField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, getJson, patchJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  adjustmentLabel,
  cleanTypeLabel,
  conditionLabel,
  formatClock,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMoney,
  recurrenceLabel,
  recurrenceWeeks,
} from "../format.ts";
import {
  AddOnList,
  OptionCard,
  PlanCard,
  PlanFigures,
  PlanSaving,
  QuoteStatusBadge,
  planTitle,
} from "../QuoteParts.tsx";
import { crewAt } from "../schedule-layout.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";

// where a Quote was started from: the request it answers, or for a Service
// Plan offered unprompted, its home
const homeOf = (quote: OfficeQuote) =>
  quote.quoteRequestId
    ? {
        label: "Quote Request",
        href: linkTo({
          to: "/office/requests/$requestId",
          params: { requestId: quote.quoteRequestId },
        }),
      }
    : {
        label: "home's page",
        href: linkTo({
          to: "/office/properties/$propertyId",
          params: { propertyId: quote.property.id },
        }),
      };

// a one-off Quote's options, or a Service Plan Quote's one, as cards
function OfferCard({
  quote,
  option,
  children,
}: {
  quote: OfficeQuote;
  option: OfficeQuoteOption;
  children: ReactNode;
}) {
  const terms = {
    option,
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
  };
  return quote.plan ? (
    <PlanCard {...terms} plan={quote.plan} change={quote.changesPlan}>
      {children}
    </PlanCard>
  ) : (
    <OptionCard {...terms}>{children}</OptionCard>
  );
}

// one Quote for the Office: edited while it's a Draft, read-only once Sent
export function QuoteScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            ...homeCrumbs(quote.client, quote.property),
            ...(quote.quoteRequestId ? [homeOf(quote)] : []),
            { label: quote.plan ? "Service Plan Quote" : "Quote" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>
            {quote.plan ? "Service Plan Quote" : "Quote"} for{" "}
            {quote.client.name}
          </Heading>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <p className="text-fg-muted">{addressOf(quote.property)}</p>
      </div>
      {quote.changesPlan && (
        <PlanChangeNotice quote={quote} change={quote.changesPlan} />
      )}
      {quote.status === "draft" ? (
        // a save gives fresh prices; the form keeps what's typed
        <DraftEditor key={quote.id} quote={quote} />
      ) : (
        <SentQuote quote={quote} />
      )}
    </div>
  );
}

// what accepting a Quote for a home with a plan does to that plan
function PlanChangeNotice({
  quote,
  change,
}: {
  quote: OfficeQuote;
  change: PlanChange;
}) {
  const from = quote.proposedStartsAt
    ? formatDateTime(quote.proposedStartsAt)
    : "its start";
  return (
    <Notice>
      <p>
        <strong>This changes {quote.client.name}'s </strong>
        <Link
          href={linkTo({
            to: "/office/service-plans/$planId",
            params: { planId: change.servicePlanId },
          })}
        >
          Service Plan
        </Link>
        <strong> from {from}.</strong> Its Jobs before then go ahead as they
        are.
      </p>
      {change.replaces.length > 0 && (
        <p>
          Its booked Jobs from then on are cancelled, free:{" "}
          {change.replaces.map((at) => formatDateTime(at)).join("; ")}.
        </p>
      )}
      <p>
        The plan's {formatMoney(change.depositCents)} Deposit carries over, so
        accepting charges nothing.
      </p>
    </Notice>
  );
}

function SentQuote({ quote }: { quote: OfficeQuote }) {
  return (
    <>
      <Card title="Offer">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">
            {quote.changesPlan || quote.changedPlan
              ? "New terms start"
              : quote.plan
                ? "Starts"
                : "Proposed time"}
          </dt>
          <dd>{formatDateTime(quote.proposedStartsAt!)}</dd>
          {quote.plan && (
            <>
              <dt className="font-semibold">Then</dt>
              <dd>
                {cleanTypeLabel[quote.plan.cleanType]}s{" "}
                {recurrenceLabel[quote.plan.recurrence].toLowerCase()}, priced
                for {conditionLabel[quote.plan.condition].toLowerCase()}{" "}
                Condition
              </dd>
            </>
          )}
          <dt className="font-semibold">Sent</dt>
          <dd>
            {formatDateTime(quote.sentAt!)} to {quote.client.email}
          </dd>
          <dt className="font-semibold">
            {quote.status === "expired" ? "Expired" : "Expires"}
          </dt>
          <dd>{formatDateTime(quote.expiresAt!)}</dd>
          {quote.declinedAt && (
            <>
              <dt className="font-semibold">Declined</dt>
              <dd>{formatDateTime(quote.declinedAt)}</dd>
            </>
          )}
          {quote.acceptedAt && (
            <>
              <dt className="font-semibold">Accepted</dt>
              <dd>
                {formatDateTime(quote.acceptedAt)}:{" "}
                {quote.servicePlanId ? (
                  <Link
                    href={linkTo({
                      to: "/office/service-plans/$planId",
                      params: { planId: quote.servicePlanId },
                    })}
                  >
                    {quote.changedPlan
                      ? "its Service Plan has changed"
                      : "its Service Plan has started"}
                  </Link>
                ) : (
                  `${cleanTypeLabel[quote.acceptedCleanType!]}, booked`
                )}
              </dd>
            </>
          )}
        </dl>
      </Card>
      {quote.status === "sent" &&
        (quote.bookable.length > 0 ? (
          <RecordAcceptance quote={quote} />
        ) : (
          <Notice tone="danger">
            {formatDateTime(quote.proposedStartsAt!)} has filled up since this
            Quote was sent, so {quote.client.name} can't accept it. Draft a new
            Quote with another time from their{" "}
            <Link href={homeOf(quote).href}>{homeOf(quote).label}</Link>: it
            replaces this one.
          </Notice>
        ))}
      <div className="grid gap-4 lg:grid-cols-2">
        {quote.options.map((option) => (
          <OfferCard key={option.cleanType} quote={quote} option={option}>
            <PricedFrom option={option} />
          </OfferCard>
        ))}
      </div>
      <Card
        title="Add-ons"
        description={
          quote.plan ? "On every clean, before the Plan Discount." : undefined
        }
      >
        <AddOnList addOns={quote.addOns} />
      </Card>
      {quote.firstClean && <FirstCleanCard firstClean={quote.firstClean} />}
      <p className="text-sm text-fg-muted">
        Priced from Price List version {quote.priceListVersion}. A Sent Quote
        never changes: to offer something different, draft a new one.
      </p>
    </>
  );
}

// The Client said yes another way, e.g. by phone: the Office records it,
// charging the Deposit to the card the Client saved. Office Staff never take
// card details, so without one they email the Client a link to add it.
function RecordAcceptance({ quote }: { quote: OfficeQuote }) {
  const router = useRouter();
  const [cleanType, setCleanType] = useState<CleanType>(
    quote.bookable.includes("deep") ? "deep" : quote.bookable[0]!,
  );
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState<"accept" | "link">();
  const chosen = quote.options.find((o) => o.cleanType === cleanType)!;
  const [firstName] = quote.client.name.split(" ");

  const attempt = async (
    action: "accept" | "link",
    run: () => Promise<void>,
  ) => {
    setBusy(action);
    setProblem(undefined);
    try {
      await run();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "That didn't work. Please try again.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const accept = (close: () => void) =>
    attempt("accept", async () => {
      await postJson<OfficeQuote>(`/api/quotes/${quote.id}/accept`, {
        cleanType,
      });
      close();
      showToast({
        tone: "success",
        title: quote.changesPlan
          ? "Accepted: the Service Plan has changed"
          : quote.plan
            ? "Accepted: the Service Plan has started"
            : "Accepted and booked",
      });
      await router.invalidate();
    });

  const sendLink = () =>
    attempt("link", async () => {
      await postJson("/api/payment-methods/requests", {
        clientId: quote.client.id,
      });
      showToast({
        tone: "success",
        title: `Link sent to ${quote.client.email}`,
      });
    });

  const linkButton = (
    <Button
      variant="secondary"
      isPending={busy === "link"}
      onPress={() => void sendLink()}
    >
      Email {firstName} a link to add a card
    </Button>
  );

  // changing a plan charges nothing: its Deposit carries over
  if (quote.changesPlan) {
    return (
      <Card
        title="Record acceptance"
        description="If the Client accepts by phone or in person."
      >
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Actions>
          <DialogTrigger>
            <Button>Record acceptance</Button>
            <Dialog title="Record acceptance?" role="alertdialog">
              {({ close }) => (
                <>
                  <p>
                    This changes {quote.client.name}'s Service Plan to{" "}
                    {cleanTypeLabel[cleanType]}s{" "}
                    {recurrenceLabel[quote.plan!.recurrence].toLowerCase()} from{" "}
                    {formatDateTime(quote.proposedStartsAt!)}, cancelling its
                    booked Jobs from then on. Nothing is charged. Only do this
                    if they've told you they accept.
                  </p>
                  {problem && <Notice tone="danger">{problem}</Notice>}
                  <Actions>
                    <Button variant="secondary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      isPending={busy === "accept"}
                      onPress={() => void accept(close)}
                    >
                      Change the plan
                    </Button>
                  </Actions>
                </>
              )}
            </Dialog>
          </DialogTrigger>
        </Actions>
      </Card>
    );
  }

  if (!quote.paymentMethod) {
    return (
      <Card
        title="Record acceptance"
        description="If the Client accepts by phone or in person."
      >
        <Notice>
          {quote.client.name} hasn't saved a Payment Method yet. We never take
          card details for them: email them a link to add one, then record their
          acceptance here.
        </Notice>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Actions>{linkButton}</Actions>
      </Card>
    );
  }

  return (
    <Card
      title="Record acceptance"
      description="If the Client accepts by phone or in person."
    >
      {!quote.plan && (
        <RadioGroup
          label="Clean Type they chose"
          value={cleanType}
          onChange={(value) => setCleanType(value as CleanType)}
        >
          {quote.options.map((option) => (
            <Radio
              key={option.cleanType}
              value={option.cleanType}
              isDisabled={!quote.bookable.includes(option.cleanType)}
              description={
                quote.bookable.includes(option.cleanType)
                  ? `${formatMoney(option.totalCents)}, Deposit ${formatMoney(option.depositCents)}`
                  : "No longer fits: its time has filled up"
              }
            >
              {cleanTypeLabel[option.cleanType]}
            </Radio>
          ))}
        </RadioGroup>
      )}
      <p className="text-sm text-fg-muted">
        Charged to their {quote.paymentMethod.label}, saved{" "}
        {formatDateTime(quote.paymentMethod.savedAt)}.
      </p>
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        {linkButton}
        <DialogTrigger>
          <Button>Record acceptance</Button>
          <Dialog title="Record acceptance?" role="alertdialog">
            {({ close }) => (
              <>
                {quote.plan ? (
                  <p>
                    This charges the {formatMoney(chosen.depositCents)} Deposit
                    to {quote.client.name}'s {quote.paymentMethod!.label}, held
                    for the life of the plan, and starts their Service Plan with
                    its first {cleanTypeLabel[cleanType]} on{" "}
                    {formatDateTime(quote.proposedStartsAt!)}. Only do this if
                    they've told you they accept.
                  </p>
                ) : (
                  <p>
                    This charges the {formatMoney(chosen.depositCents)} Deposit
                    to {quote.client.name}'s {quote.paymentMethod!.label} and
                    books their {cleanTypeLabel[cleanType]} for{" "}
                    {formatDateTime(quote.proposedStartsAt!)}. Only do this if
                    they've told you they accept.
                  </p>
                )}
                {problem && <Notice tone="danger">{problem}</Notice>}
                <Actions>
                  <Button variant="secondary" onPress={close}>
                    Cancel
                  </Button>
                  <Button
                    isPending={busy === "accept"}
                    onPress={() => void accept(close)}
                  >
                    Charge and book
                  </Button>
                </Actions>
              </>
            )}
          </Dialog>
        </DialogTrigger>
      </Actions>
    </Card>
  );
}

// the Suggested Price, and the override that replaced it
function PricedFrom({ option }: { option: OfficeQuoteOption }) {
  if (option.overrideCents === null) {
    return (
      <p className="text-sm text-fg-muted">
        The Suggested Price, {formatMoney(option.suggested.priceCents)} before
        tax.
      </p>
    );
  }
  return (
    <Notice>
      Overridden to {formatMoney(option.overrideCents)} before tax from the
      Suggested {formatMoney(option.suggested.priceCents)}:{" "}
      {option.overrideReason}
    </Notice>
  );
}

// what's on screen: money in dollars, the time as the pickers hold it
type Override = { on: boolean; price: number; reason: string };
type Fields = {
  addOns: string[];
  crewSize: number;
  depositPercent: number;
  validityDays: number;
  date: CalendarDate | null;
  time: Time | null;
  overrides: Record<CleanType, Override>;
  // a Service Plan Quote's
  plan: ServicePlanInput | null;
};

const toFields = (quote: OfficeQuote): Fields => {
  // a Service Plan Quote has only its own Clean Type to override
  const override = (cleanType: CleanType): Override => {
    const option = quote.options.find((o) => o.cleanType === cleanType);
    return {
      on: option?.overrideCents != null,
      price: (option?.overrideCents ?? option?.suggested.priceCents ?? 0) / 100,
      reason: option?.overrideReason ?? "",
    };
  };
  return {
    addOns: quote.addOns.map((a) => a.key),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    validityDays: quote.validityDays,
    plan: quote.plan && {
      recurrence: quote.plan.recurrence,
      cleanType: quote.plan.cleanType,
      discountPercent: quote.plan.discountPercent,
      condition: quote.plan.condition,
    },
    date: quote.proposedStart && parseDate(quote.proposedStart.date),
    time: quote.proposedStart && parseTime(quote.proposedStart.time),
    overrides: { deep: override("deep"), standard: override("standard") },
  };
};

const toInput = (fields: Fields): QuoteDraftInput => {
  // a Service Plan Quote's only for its own Clean Type
  const override = (cleanType: CleanType) => {
    const { on, price, reason } = fields.overrides[cleanType];
    return on && (!fields.plan || fields.plan.cleanType === cleanType)
      ? { priceCents: Math.round(price * 100), reason }
      : null;
  };
  return {
    addOns: fields.addOns,
    crewSize: fields.crewSize,
    depositPercent: fields.depositPercent,
    validityDays: fields.validityDays,
    proposedStart:
      fields.date && fields.time
        ? {
            date: fields.date.toString(),
            time: fields.time.toString().slice(0, 5),
          }
        : null,
    overrides: { deep: override("deep"), standard: override("standard") },
    plan: fields.plan,
  };
};

const dollars = { style: "currency", currency: "USD" } as const;

// Whether the proposed day has room for each Clean Type, from its free
// Cleaner hours now and the Labour Hours as last saved, and whether a crew
// is free at the proposed time (#62). A warning, not a rule: the Office may
// be about to add hours or a Cleaner. A Quote sent for a full day or time
// can't be accepted, and goes straight under Needs attention.
function RoomOnDay({
  day,
  time,
  crewSize,
  options,
}: {
  day: string;
  time?: string;
  crewSize: number;
  options: OfficeQuoteOption[];
}) {
  const [found, setFound] = useState<ScheduleDay>();

  useEffect(() => {
    let current = true;
    getJson<ScheduleDay[]>(`/api/schedule?from=${day}&to=${day}`)
      .then(([found]) => current && setFound(found))
      // nothing to say if it can't be found out
      .catch(() => current && setFound(undefined));
    return () => {
      current = false;
    };
  }, [day]);

  if (found?.date !== day) return null;
  const free = { day, hours: found.freeHours };
  // in hundredths, as the server compares them
  const fits = (option: OfficeQuoteOption) =>
    Math.round(free.hours * 100) >= Math.round(option.labourHours * 100);
  const crew = (option: OfficeQuoteOption) =>
    time ? crewAt(found, time, option.hoursOnSite, { crewSize }) : undefined;
  // those with the hours but no crew free then
  const crewless = options.filter((o) => fits(o) && crew(o)?.hasCrew === false);
  const crewNotice = crewless.length > 0 && time && (
    <Notice tone="danger">
      {noCrewAt(time, crewSize, crew(crewless[0]!)!)}{" "}
      {crewless.length === options.length
        ? `The Client couldn't accept this Quote: choose another time, or give a Cleaner hours that day.`
        : `The Client couldn't choose ${crewless.map(describeOption).join(" or ")}.`}
    </Notice>
  );
  const fitting = options.filter(fits);
  const missing = options.filter((o) => !fits(o));
  const describe = describeOption;
  const opening = `${formatDay(day)} has ${formatHours(Math.max(free.hours, 0))} of Cleaner time free`;

  if (missing.length === 0) {
    return (
      <>
        <p className="text-sm text-fg-muted">
          {opening}: room for {options.length === 1 ? "it" : "either clean"}.
        </p>
        {crewNotice}
      </>
    );
  }
  return (
    <>
      <Notice tone="danger">
        {fitting.length > 0
          ? `${opening}: room for ${fitting.map(describe).join(" and ")}, but not ${missing.map(describe).join(" or ")}. The Client will only be able to choose ${fitting.length === 1 ? "that one" : "those"}.`
          : `${opening}, not enough for ${missing.map(describe).join(" or ")}. The Client couldn't accept this Quote: choose another day, or give a Cleaner more hours that day.`}
      </Notice>
      {crewNotice}
    </>
  );
}

const describeOption = (o: OfficeQuoteOption) =>
  `the ${cleanTypeLabel[o.cleanType]} (${formatHours(o.labourHours)})`;

// why a crew can't be had at a time
const noCrewAt = (
  time: string,
  crewSize: number,
  { busy, cleaners }: { busy: number; cleaners: number },
) => {
  const free = Math.max(cleaners - busy, 0);
  return `Not enough Cleaners are free at ${formatClock(time)}: a crew of ${crewSize} is needed, and ${free} of the ${cleaners} available that day ${free === 1 ? "is" : "are"}.`;
};

// A Service Plan Quote's own terms: how often, the Plan Discount, and the
// Condition it's priced for, which is moderate unless changed here (the
// home's own Condition is left as it is). Its Clean Type is chosen from the
// price cards.
function PlanTerms({
  plan,
  onChange,
}: {
  plan: ServicePlanInput;
  onChange: (change: Partial<ServicePlanInput>) => void;
}) {
  return (
    <Card title="Plan">
      <RadioGroup
        label="How often"
        name="plan.recurrence"
        value={plan.recurrence}
        onChange={(value) => onChange({ recurrence: value as Recurrence })}
      >
        {(["weekly", "fortnightly", "four_weekly"] as const).map((r) => (
          <Radio key={r} value={r}>
            {recurrenceLabel[r]}
          </Radio>
        ))}
      </RadioGroup>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        <NumberField
          label="Plan Discount (%)"
          name="plan.discountPercent"
          minValue={0}
          maxValue={100}
          value={plan.discountPercent}
          onChange={(discountPercent) => onChange({ discountPercent })}
        />
        <Select
          label="Priced for Condition"
          selectedKey={plan.condition}
          onSelectionChange={(key) => onChange({ condition: key as Condition })}
        >
          {(["light", "moderate", "heavy"] as const).map((c) => (
            <SelectItem key={c} id={c}>
              {conditionLabel[c]}
            </SelectItem>
          ))}
        </Select>
      </div>
    </Card>
  );
}

// the Suggested Price, and the way to replace it with a price and a reason
function OverrideFields({
  option,
  override,
  label,
  onChange,
}: {
  option: OfficeQuoteOption;
  override: Override;
  // what the price is called: "Deep Clean", or a plan's "one-off"
  label: string;
  onChange: (change: Partial<Override>) => void;
}) {
  return (
    <>
      <p className="text-sm text-fg-muted">
        Suggested Price {formatMoney(option.suggested.priceCents)} before tax,
        for {option.suggested.labourHours} Labour Hours.
      </p>
      <Checkbox isSelected={override.on} onChange={(on) => onChange({ on })}>
        Override the {label} price
      </Checkbox>
      {override.on && (
        <div className="flex flex-col gap-4">
          <NumberField
            label={`${label === "one-off" ? "One-off" : label} price before tax`}
            name={`overrides.${option.cleanType}.priceCents`}
            minValue={0}
            formatOptions={dollars}
            value={override.price}
            onChange={(price) => onChange({ price })}
          />
          <TextField
            label="Reason for the override"
            name={`overrides.${option.cleanType}.reason`}
            value={override.reason}
            onChange={(reason) => onChange({ reason })}
          />
        </div>
      )}
    </>
  );
}

// where the Draft stands against what's on screen
type SaveState =
  | "saved"
  // changed, and about to be saved
  | "changed"
  | "saving"
  // an override without its reason yet: nothing to save until it has one
  | "incomplete"
  // the API refused it: see the fields marked
  | "invalid"
  | "failed";

const saveStateLabel: Record<SaveState, string> = {
  saved: "All changes saved",
  changed: "Updating prices…",
  saving: "Updating prices…",
  incomplete: "Give a reason for the override to update the prices",
  invalid: "Fix the fields marked to update the prices",
  failed: "Changes couldn't be saved. They'll be tried again as you edit.",
};

// how long after the last change the Draft is saved and priced again
const SAVE_DELAY_MS = 500;

// the prices as last worked out, in a line: what the bar at the bottom shows
const priceSummary = (quote: OfficeQuote) => {
  if (quote.plan) {
    const [option] = quote.options;
    return `${cleanTypeLabel[option!.cleanType]} ${recurrenceLabel[quote.plan.recurrence].toLowerCase()}: ${formatMoney(option!.totalCents)} a clean`;
  }
  return quote.options
    .map((o) => `${cleanTypeLabel[o.cleanType]} ${formatMoney(o.totalCents)}`)
    .join(" · ");
};

/**
 * A Draft, saved and priced again by the server a moment after each change,
 * so the prices always follow what's on screen; a bar at the bottom keeps
 * them in view wherever the change was made. On a Service Plan Quote, the
 * plan's Clean Type is chosen from its price cards.
 */
function DraftEditor({ quote: loaded }: { quote: OfficeQuote }) {
  const router = useRouter();
  const [quote, setQuote] = useState(loaded);
  const [fields, setFields] = useState(() => toFields(loaded));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isSending, setSending] = useState(false);

  // every change counts up; a save records the change it saved, so a save
  // started before a later change doesn't count as saving it
  const latest = useRef(fields);
  const edits = useRef(0);
  const saved = useRef({ edit: 0, ok: true });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  const set = (change: Partial<Fields>) => {
    edits.current += 1;
    setFields((current) => {
      latest.current = { ...current, ...change };
      return latest.current;
    });
    setSaveState("changed");
  };
  const setOverride = (cleanType: CleanType, change: Partial<Override>) =>
    set({
      overrides: {
        ...fields.overrides,
        [cleanType]: { ...fields.overrides[cleanType], ...change },
      },
    });

  const missingReason = (f: Fields) =>
    (Object.keys(f.overrides) as CleanType[]).some(
      (t) =>
        f.overrides[t].on &&
        !f.overrides[t].reason.trim() &&
        (!f.plan || f.plan.cleanType === t),
    );

  // saves what's on screen, one save at a time; says whether it's all saved
  const saveNow = (): Promise<boolean> => {
    queue.current = queue.current.then(async () => {
      const edit = edits.current;
      if (edit === saved.current.edit) return saved.current.ok;
      setSaveState("saving");
      try {
        setQuote(
          await patchJson<OfficeQuote>(
            `/api/quotes/${quote.id}`,
            toInput(latest.current),
          ),
        );
        setFieldErrors({});
        setFailure(undefined);
        saved.current = { edit, ok: true };
      } catch (e) {
        const invalid =
          e instanceof ApiError && Object.keys(e.fieldErrors).length > 0;
        if (invalid) setFieldErrors(e.fieldErrors);
        saved.current = { edit, ok: false };
        if (edit === edits.current)
          setSaveState(invalid ? "invalid" : "failed");
        return false;
      }
      if (edit === edits.current) setSaveState("saved");
      return true;
    });
    return queue.current;
  };

  useEffect(() => {
    if (edits.current === saved.current.edit) return;
    if (missingReason(fields)) {
      setSaveState("incomplete");
      return;
    }
    const timer = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // saveNow reads the latest fields itself
  }, [fields]);

  // what's on screen is what's sent: save it, then send it
  const onSend = async () => {
    setSending(true);
    setFailure(undefined);
    try {
      if (!(await saveNow())) return;
      await postJson<OfficeQuote>(`/api/quotes/${quote.id}/send`);
      showToast({
        tone: "success",
        title: `Quote sent to ${quote.client.email}`,
      });
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setFailure(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "That didn't work. Please try again.",
        );
      }
    } finally {
      setSending(false);
    }
  };

  const stale = saveState === "changed" || saveState === "saving";
  const plan = fields.plan;
  const chosen =
    plan &&
    quote.planChoices?.find((c) => c.option.cleanType === plan.cleanType);

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow();
      }}
    >
      {failure && <Notice tone="danger">{failure}</Notice>}

      <section
        aria-labelledby="prices-title"
        aria-busy={stale}
        className="flex flex-col gap-4"
      >
        <Heading level={2} id="prices-title">
          Prices
        </Heading>
        <div
          className={`flex flex-col gap-4 transition-opacity ${stale ? "opacity-60" : ""}`}
        >
          {plan && quote.planChoices ? (
            <>
              <RadioGroup
                label="Clean Type"
                description="Choose the one the plan is for. The Client is offered only that."
                layout="cards"
                value={plan.cleanType}
                onChange={(value) =>
                  set({ plan: { ...plan, cleanType: value as CleanType } })
                }
              >
                {quote.planChoices.map((choice) => (
                  <RadioCard
                    key={choice.option.cleanType}
                    value={choice.option.cleanType}
                    title={planTitle(choice.option, choice.plan)}
                    badge={<PlanSaving plan={choice.plan} />}
                  >
                    <PlanFigures
                      option={choice.option}
                      plan={choice.plan}
                      crewSize={quote.crewSize}
                      depositPercent={quote.depositPercent}
                    />
                  </RadioCard>
                ))}
              </RadioGroup>
              {chosen && (
                <Card
                  title={`${cleanTypeLabel[plan.cleanType]} price`}
                  headingLevel={3}
                  description="The Plan Discount comes off the one-off price, overridden or not."
                >
                  <OverrideFields
                    option={chosen.option}
                    override={fields.overrides[plan.cleanType]}
                    label="one-off"
                    onChange={(change) => setOverride(plan.cleanType, change)}
                  />
                </Card>
              )}
            </>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {quote.options.map((option) => (
                <OfferCard key={option.cleanType} quote={quote} option={option}>
                  <OverrideFields
                    option={option}
                    override={fields.overrides[option.cleanType]}
                    label={cleanTypeLabel[option.cleanType]}
                    onChange={(change) => setOverride(option.cleanType, change)}
                  />
                </OfferCard>
              ))}
            </div>
          )}
        </div>
        <p className="text-sm text-fg-muted">
          Prices are worked out again from the current Price List (version{" "}
          {quote.priceListVersion}) and the home's details as you make changes.
          Sending fixes them.
        </p>
      </section>

      {plan && (
        <PlanTerms
          plan={plan}
          onChange={(change) => set({ plan: { ...plan, ...change } })}
        />
      )}
      {quote.firstClean && <FirstCleanCard firstClean={quote.firstClean} />}

      <Card
        title="Add-ons"
        description={
          quote.plan
            ? "Done on every clean. Each adds its hours to the price, and the Plan Discount comes off it too."
            : "Each adds its hours to both prices."
        }
      >
        <div className="flex flex-col">
          {quote.addOnChoices.map((addOn) => (
            <Checkbox
              key={addOn.key}
              isSelected={fields.addOns.includes(addOn.key)}
              onChange={(on) =>
                set({
                  addOns: on
                    ? [...fields.addOns, addOn.key]
                    : fields.addOns.filter((key) => key !== addOn.key),
                })
              }
            >
              {addOn.name}
            </Checkbox>
          ))}
        </div>
      </Card>

      <Card title="Terms">
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          <NumberField
            label="Crew Size"
            name="crewSize"
            minValue={1}
            maxValue={10}
            value={fields.crewSize}
            onChange={(crewSize) => set({ crewSize })}
          />
          <NumberField
            label="Deposit (%)"
            name="depositPercent"
            minValue={0}
            maxValue={100}
            value={fields.depositPercent}
            onChange={(depositPercent) => set({ depositPercent })}
          />
          <NumberField
            label="Valid for (days)"
            name="validityDays"
            minValue={1}
            maxValue={90}
            value={fields.validityDays}
            onChange={(validityDays) => set({ validityDays })}
          />
        </div>
      </Card>

      <Card
        title={quote.plan ? "Start" : "Proposed time"}
        description={
          plan
            ? `New York time. Then ${recurrenceLabel[plan.recurrence].toLowerCase()} on the same weekday. The Quote Expires at this time if it isn't accepted first.`
            : "New York time. The Quote Expires at this time if it isn't accepted first."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Date"
            name="proposedStart"
            value={fields.date}
            onChange={(date) => set({ date })}
          />
          <TimeField
            label="Start time"
            value={fields.time}
            onChange={(time) => set({ time })}
          />
        </div>
        <PickFromSchedule
          date={fields.date?.toString()}
          time={fields.time?.toString().slice(0, 5)}
          hoursOnSite={Math.max(
            0,
            ...quote.options
              .filter((o) => !plan || o.cleanType === plan.cleanType)
              .map((o) => o.hoursOnSite),
          )}
          crew={{ crewSize: fields.crewSize }}
          repeats={
            plan
              ? {
                  everyWeeks: recurrenceWeeks[plan.recurrence],
                  label: recurrenceLabel[plan.recurrence],
                }
              : undefined
          }
          onPick={({ date, time }) =>
            set({ date: parseDate(date), time: parseTime(time) })
          }
        />
        {fields.date && (
          <RoomOnDay
            day={fields.date.toString()}
            time={fields.time?.toString().slice(0, 5)}
            crewSize={fields.crewSize}
            options={quote.options}
          />
        )}
      </Card>

      {/* a Quote goes by email, and is accepted signed in with it (#34) */}
      {!quote.client.email && (
        <Notice>
          <p>
            {quote.client.name} has no email yet, so this Quote can't be sent.
            Add their email on{" "}
            <Link
              href={linkTo({
                to: "/office/clients/$clientId",
                params: { clientId: quote.client.id },
              })}
            >
              their Client screen
            </Link>
            , then send it.
          </p>
        </Notice>
      )}

      {/* the prices stay in view wherever the change was made */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 shadow-raised sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold tabular-nums">
            {priceSummary(quote)}
          </span>
          <span role="status" className="text-sm text-fg-muted">
            {saveStateLabel[saveState]}
          </span>
        </div>
        <Button
          isPending={isSending}
          isDisabled={!quote.client.email}
          onPress={() => void onSend()}
        >
          Send to {quote.client.name}
        </Button>
      </div>
    </Form>
  );
}

// What the home's First Clean found, to price the plan by: the Condition
// its Cleaner reported, and any Adjustments
function FirstCleanCard({ firstClean }: { firstClean: FirstCleanFindings }) {
  const { job } = firstClean;
  return (
    <Card
      title="First Clean"
      description={`${cleanTypeLabel[job.cleanType]} on ${formatDateTime(job.startsAt)}, Completed ${formatDate(firstClean.completedAt)}`}
      actions={
        <Link
          href={linkTo({
            to: "/office/jobs/$jobId",
            params: { jobId: job.id },
          })}
        >
          See the Job
        </Link>
      }
    >
      <p>
        Its Cleaner found the home{" "}
        <strong>{conditionLabel[firstClean.condition].toLowerCase()}</strong>.
      </p>
      {firstClean.adjustments.length === 0 ? (
        <p className="text-fg-muted">No Adjustments.</p>
      ) : (
        <List aria-label="First Clean Adjustments">
          {firstClean.adjustments.map((a) => (
            <ListItem
              key={a.id}
              id={a.id}
              title={`${adjustmentLabel(a)}: ${formatMoney(a.totalCents)}`}
              description={`"${a.reason}"`}
            />
          ))}
        </List>
      )}
    </Card>
  );
}

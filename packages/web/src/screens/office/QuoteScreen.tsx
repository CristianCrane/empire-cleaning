import { useEffect, useState, type ReactNode } from "react";
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
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMoney,
  recurrenceLabel,
} from "../format.ts";
import {
  AddOnList,
  OptionCard,
  PlanCard,
  QuoteStatusBadge,
} from "../QuoteParts.tsx";

// where a Quote was started from: the request it answers, or for a Service
// Plan offered unprompted, its Client
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
        label: "page",
        href: linkTo({
          to: "/office/clients/$clientId",
          params: { clientId: quote.client.id },
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
    <PlanCard {...terms} plan={quote.plan}>
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
            { label: quote.client.name, href: homeOf(quote).href },
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
      {quote.status === "draft" ? (
        // a save gives fresh prices; the form keeps what's typed
        <DraftEditor key={quote.id} quote={quote} />
      ) : (
        <SentQuote quote={quote} />
      )}
    </div>
  );
}

function SentQuote({ quote }: { quote: OfficeQuote }) {
  return (
    <>
      <Card title="Offer">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">
            {quote.plan ? "Starts" : "Proposed time"}
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
                {cleanTypeLabel[quote.acceptedCleanType!]}, booked
              </dd>
            </>
          )}
        </dl>
      </Card>
      {quote.status === "sent" &&
        (quote.bookable.length > 0 ? (
          quote.plan ? (
            <Notice>
              Service Plan Quotes can't be accepted yet, by {quote.client.name}{" "}
              or for them.
            </Notice>
          ) : (
            <RecordAcceptance quote={quote} />
          )
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
      showToast({ tone: "success", title: "Accepted and booked" });
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
                : "No longer fits: the day has filled up"
            }
          >
            {cleanTypeLabel[option.cleanType]}
          </Radio>
        ))}
      </RadioGroup>
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
                <p>
                  This charges the {formatMoney(chosen.depositCents)} Deposit to{" "}
                  {quote.client.name}'s {quote.paymentMethod!.label} and books
                  their {cleanTypeLabel[cleanType]} for{" "}
                  {formatDateTime(quote.proposedStartsAt!)}. Only do this if
                  they've told you they accept.
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
// Cleaner hours now and the Labour Hours as last saved. A warning, not a
// rule: the Office may be about to add hours. A Quote sent for a full day
// can't be accepted, and goes straight under Needs attention.
function RoomOnDay({
  day,
  options,
}: {
  day: string;
  options: OfficeQuoteOption[];
}) {
  const [free, setFree] = useState<{ day: string; hours: number }>();

  useEffect(() => {
    let current = true;
    getJson<ScheduleDay[]>(`/api/schedule?from=${day}&to=${day}`)
      .then(([found]) => current && setFree({ day, hours: found!.freeHours }))
      // nothing to say if it can't be found out
      .catch(() => current && setFree(undefined));
    return () => {
      current = false;
    };
  }, [day]);

  if (free?.day !== day) return null;
  // in hundredths, as the server compares them
  const fits = (option: OfficeQuoteOption) =>
    Math.round(free.hours * 100) >= Math.round(option.labourHours * 100);
  const fitting = options.filter(fits);
  const missing = options.filter((o) => !fits(o));
  const describe = (o: OfficeQuoteOption) =>
    `the ${cleanTypeLabel[o.cleanType]} (${formatHours(o.labourHours)})`;
  const opening = `${formatDay(day)} has ${formatHours(Math.max(free.hours, 0))} of Cleaner time free`;

  if (missing.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        {opening}: room for {options.length === 1 ? "it" : "either clean"}.
      </p>
    );
  }
  return (
    <Notice tone="danger">
      {fitting.length > 0
        ? `${opening}: room for ${fitting.map(describe).join(" and ")}, but not ${missing.map(describe).join(" or ")}. The Client will only be able to choose ${fitting.length === 1 ? "that one" : "those"}.`
        : `${opening}, not enough for ${missing.map(describe).join(" or ")}. The Client couldn't accept this Quote: choose another day, or give a Cleaner more hours that day.`}
    </Notice>
  );
}

// A Service Plan Quote's own terms: how often, the Clean Type, the Plan
// Discount, and the Condition it's priced for, which is moderate unless
// changed here (the home's own Condition is left as it is)
function PlanTerms({
  plan,
  onChange,
}: {
  plan: ServicePlanInput;
  onChange: (change: Partial<ServicePlanInput>) => void;
}) {
  return (
    <Card
      title="Plan"
      description="Saving works the prices out again with these."
    >
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
      <RadioGroup
        label="Clean Type"
        name="plan.cleanType"
        orientation="horizontal"
        value={plan.cleanType}
        onChange={(value) => onChange({ cleanType: value as CleanType })}
      >
        {(["standard", "deep"] as const).map((t) => (
          <Radio key={t} value={t}>
            {cleanTypeLabel[t]}
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

function DraftEditor({ quote: loaded }: { quote: OfficeQuote }) {
  const router = useRouter();
  const [quote, setQuote] = useState(loaded);
  const [fields, setFields] = useState(() => toFields(loaded));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState<"save" | "send">();

  const set = (change: Partial<Fields>) =>
    setFields((current) => ({ ...current, ...change }));
  const setOverride = (cleanType: CleanType, change: Partial<Override>) =>
    set({
      overrides: {
        ...fields.overrides,
        [cleanType]: { ...fields.overrides[cleanType], ...change },
      },
    });

  // errors beside their fields where the API names one, otherwise above
  const attempt = async (action: "save" | "send", run: () => Promise<void>) => {
    setBusy(action);
    setFailure(undefined);
    try {
      await run();
      setFieldErrors({});
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
      setBusy(undefined);
    }
  };

  const save = () =>
    patchJson<OfficeQuote>(`/api/quotes/${quote.id}`, toInput(fields));

  const onSave = () =>
    attempt("save", async () => {
      setQuote(await save());
      showToast({ tone: "success", title: "Draft saved" });
    });

  // what's on screen is what's sent: save it, then send it
  const onSend = () =>
    attempt("send", async () => {
      setQuote(await save());
      await postJson<OfficeQuote>(`/api/quotes/${quote.id}/send`);
      showToast({
        tone: "success",
        title: `Quote sent to ${quote.client.email}`,
      });
      await router.invalidate();
    });

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave();
      }}
    >
      {failure && <Notice tone="danger">{failure}</Notice>}

      <section aria-labelledby="prices-title" className="flex flex-col gap-4">
        <Heading level={2} id="prices-title">
          Prices
        </Heading>
        <div className="grid gap-4 lg:grid-cols-2">
          {quote.options.map((option) => {
            const override = fields.overrides[option.cleanType];
            // on a Service Plan Quote, the Plan Discount comes off the
            // one-off price, overridden or not
            const label = quote.plan
              ? "one-off"
              : cleanTypeLabel[option.cleanType];
            return (
              <OfferCard key={option.cleanType} quote={quote} option={option}>
                <p className="text-sm text-fg-muted">
                  Suggested Price {formatMoney(option.suggested.priceCents)}{" "}
                  before tax, for {option.suggested.labourHours} Labour Hours.
                </p>
                <Checkbox
                  isSelected={override.on}
                  onChange={(on) => setOverride(option.cleanType, { on })}
                >
                  Override the {label} price
                </Checkbox>
                {override.on && (
                  <div className="flex flex-col gap-4">
                    <NumberField
                      label={
                        quote.plan
                          ? "One-off price before tax"
                          : `${label} price before tax`
                      }
                      name={`overrides.${option.cleanType}.priceCents`}
                      minValue={0}
                      formatOptions={dollars}
                      value={override.price}
                      onChange={(price) =>
                        setOverride(option.cleanType, { price })
                      }
                    />
                    <TextField
                      label="Reason for the override"
                      name={`overrides.${option.cleanType}.reason`}
                      value={override.reason}
                      onChange={(reason) =>
                        setOverride(option.cleanType, { reason })
                      }
                    />
                  </div>
                )}
              </OfferCard>
            );
          })}
        </div>
        <p className="text-sm text-fg-muted">
          Prices are worked out again from the current Price List (version{" "}
          {quote.priceListVersion}) and the home's details each time you save.
          Sending fixes them.
        </p>
      </section>

      {fields.plan && (
        <PlanTerms
          plan={fields.plan}
          onChange={(change) => set({ plan: { ...fields.plan!, ...change } })}
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
          fields.plan
            ? `New York time. Then ${recurrenceLabel[fields.plan.recurrence].toLowerCase()} on the same weekday. The Quote Expires at this time if it isn't accepted first.`
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
        {fields.date && (
          <RoomOnDay day={fields.date.toString()} options={quote.options} />
        )}
      </Card>

      <Actions>
        <Button type="submit" variant="secondary" isPending={busy === "save"}>
          Save draft
        </Button>
        <Button isPending={busy === "send"} onPress={() => void onSend()}>
          Send to {quote.client.name}
        </Button>
      </Actions>
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

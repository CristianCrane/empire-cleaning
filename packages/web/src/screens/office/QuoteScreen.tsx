import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  CleanType,
  OfficeQuote,
  OfficeQuoteOption,
  QuoteDraftInput,
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
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  TimeField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, patchJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  formatDateTime,
  formatMoney,
} from "../format.ts";
import { AddOnList, OptionCard, QuoteStatusBadge } from "../QuoteParts.tsx";

// one Quote for the Office: edited while it's a Draft, read-only once Sent
export function QuoteScreen() {
  const quote = useLoaderData({ from: "/office/quotes/$quoteId" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            {
              label: quote.client.name,
              href: linkTo({
                to: "/office/requests/$requestId",
                params: { requestId: quote.quoteRequestId },
              }),
            },
            { label: "Quote" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>Quote for {quote.client.name}</Heading>
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
          <dt className="font-semibold">Proposed time</dt>
          <dd>{formatDateTime(quote.proposedStartsAt!)}</dd>
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
          <RecordAcceptance quote={quote} />
        ) : (
          <Notice tone="danger">
            {formatDateTime(quote.proposedStartsAt!)} has filled up since this
            Quote was sent, so {quote.client.name} can't accept it. Draft a new
            Quote with another time from their{" "}
            <Link
              href={linkTo({
                to: "/office/requests/$requestId",
                params: { requestId: quote.quoteRequestId },
              })}
            >
              Quote Request
            </Link>
            : it replaces this one.
          </Notice>
        ))}
      <div className="grid gap-4 lg:grid-cols-2">
        {quote.options.map((option) => (
          <OptionCard
            key={option.cleanType}
            option={option}
            crewSize={quote.crewSize}
            depositPercent={quote.depositPercent}
          >
            <PricedFrom option={option} />
          </OptionCard>
        ))}
      </div>
      <Card title="Add-ons">
        <AddOnList addOns={quote.addOns} />
      </Card>
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
};

const toFields = (quote: OfficeQuote): Fields => {
  const override = (cleanType: CleanType): Override => {
    const option = quote.options.find((o) => o.cleanType === cleanType)!;
    return {
      on: option.overrideCents !== null,
      price: (option.overrideCents ?? option.suggested.priceCents) / 100,
      reason: option.overrideReason ?? "",
    };
  };
  return {
    addOns: quote.addOns.map((a) => a.key),
    crewSize: quote.crewSize,
    depositPercent: quote.depositPercent,
    validityDays: quote.validityDays,
    date: quote.proposedStart && parseDate(quote.proposedStart.date),
    time: quote.proposedStart && parseTime(quote.proposedStart.time),
    overrides: { deep: override("deep"), standard: override("standard") },
  };
};

const toInput = (fields: Fields): QuoteDraftInput => {
  const override = ({ on, price, reason }: Override) =>
    on ? { priceCents: Math.round(price * 100), reason } : null;
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
    overrides: {
      deep: override(fields.overrides.deep),
      standard: override(fields.overrides.standard),
    },
  };
};

const dollars = { style: "currency", currency: "USD" } as const;

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
            const label = cleanTypeLabel[option.cleanType];
            return (
              <OptionCard
                key={option.cleanType}
                option={option}
                crewSize={quote.crewSize}
                depositPercent={quote.depositPercent}
              >
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
                      label={`${label} price before tax`}
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
              </OptionCard>
            );
          })}
        </div>
        <p className="text-sm text-fg-muted">
          Prices are worked out again from the current Price List (version{" "}
          {quote.priceListVersion}) and the home's details each time you save.
          Sending fixes them.
        </p>
      </section>

      <Card title="Add-ons" description="Each adds its hours to both prices.">
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
        title="Proposed time"
        description="New York time. The Quote Expires at this time if it isn't accepted first."
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

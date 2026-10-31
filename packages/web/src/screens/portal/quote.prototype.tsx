// PROTOTYPE: throwaway. A Client's Quote, on made-up data, at
// /prototype/quote?case=1..3&layout=A..C (no sign-in). A is today's tidied:
// tap a card to choose the clean, then pay below; B reads like a Quote
// document, the choice and payment at its foot; C is a checkout, the offer
// left and paying for it right. For the UX pass (#96). Lives only on
// prototype-quote.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CreditCard,
  FileText,
  House,
  MapPin,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  IconTile,
  type NavItem,
  Notice,
  RadioCard,
  RadioGroup,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";

const here = linkTo({ to: "/prototype/quote" });

// ---- made-up data ----

type Option = {
  key: string;
  name: string;
  line: string;
  total: number;
  tax: number;
  deposit: number;
  hours: number;
  onSite: string;
  recommended?: boolean;
  // a plan's: what it'd cost as a one-off
  oneOff?: number;
  day?: string;
};

type QuoteCase = {
  key: string;
  name: string;
  status: "sent" | "accepted";
  plan: boolean;
  address: string;
  when: string;
  until: string;
  options: Option[];
  extras: string[];
  card: string | null;
  crew: number;
};

const oneOff: QuoteCase = {
  key: "1",
  name: "One-off, two to choose from",
  status: "sent",
  plan: false,
  address: "35-06 Ditmars Blvd, Apt 4B, 11105",
  when: "Tue, Nov 10 at 9:00 AM",
  until: "Sat, Nov 7",
  crew: 2,
  card: null,
  extras: ["Inside the oven"],
  options: [
    {
      key: "deep",
      name: "Deep Clean",
      line: "Top to bottom, inside and out: brings your home up to standard",
      total: 299.41,
      tax: 24.41,
      deposit: 75,
      hours: 5,
      onSite: "2 h 30 min",
      recommended: true,
    },
    {
      key: "standard",
      name: "Standard Clean",
      line: "Kitchen, bathrooms, dusting and floors throughout",
      total: 194.89,
      tax: 15.89,
      deposit: 49,
      hours: 3.25,
      onSite: "1 h 38 min",
    },
  ],
};

const cases: QuoteCase[] = [
  oneOff,
  {
    key: "2",
    name: "Service Plan, saved card",
    status: "sent",
    plan: true,
    address: "12 Shore Rd, 11375",
    when: "Tue, Nov 10 at 9:00 AM",
    until: "Sat, Nov 7",
    crew: 2,
    card: "Visa ending 4242",
    extras: [],
    options: [
      {
        key: "tue",
        name: "Standard Clean",
        day: "Every Tuesday at 9:00 AM",
        line: "Kitchen, bathrooms, dusting and floors throughout",
        total: 175.4,
        oneOff: 194.89,
        tax: 14.3,
        deposit: 0,
        hours: 3.25,
        onSite: "1 h 38 min",
      },
      {
        key: "fri",
        name: "Standard Clean",
        day: "Every Friday at 1:00 PM",
        line: "Kitchen, bathrooms, dusting and floors throughout",
        total: 175.4,
        oneOff: 194.89,
        tax: 14.3,
        deposit: 0,
        hours: 3.25,
        onSite: "1 h 38 min",
      },
    ],
  },
  { ...oneOff, key: "3", name: "Accepted", status: "accepted" },
];

const layouts = [
  { key: "A", name: "Tap a card, pay below" },
  { key: "B", name: "Read like a Quote" },
  { key: "C", name: "Checkout, paying on the right" },
];

const nav: NavItem[] = [
  { href: here, label: "Home", icon: House, isCurrent: true },
  { href: here, label: "Cleans", icon: Sparkles },
  { href: here, label: "Payments", icon: Wallet },
  { href: here, label: "Your details", icon: UserRound },
];

const money = (n: number) => `$${n.toFixed(2)}`;

// ---- the page ----

export function QuotePrototype() {
  const { case: key = "1", layout = "C" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/quote",
      search: { case: key, layout, ...search } as never,
    });
  const q = cases.find((x) => x.key === key) ?? oneOff;

  return (
    <AppLayout
      area="Client"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey</span>}
    >
      <Page key={q.key + layout} q={q} layout={layout} />
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={q.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

function Page({ q, layout }: { q: QuoteCase; layout: string }) {
  const [chosen, setChosen] = useState(q.options[0]!.key);
  const option = q.options.find((o) => o.key === chosen)!;
  const open = q.status === "sent";

  const header = (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[{ label: "Home", href: here }, { label: "Your Quote" }]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>
          {q.plan ? "Your Service Plan Quote" : "Your Quote"}
        </Heading>
        {open ? (
          <StatusBadge tone="info">Open until {q.until}</StatusBadge>
        ) : (
          <StatusBadge tone="success">Accepted</StatusBadge>
        )}
      </div>
    </div>
  );

  const standing =
    q.status === "accepted" ? (
      <Notice tone="success">
        You're booked: a {option.name} on {q.when}. We'll see you then.
      </Notice>
    ) : null;

  if (layout === "A") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {standing}
        <Notice tone="info">
          {q.plan ? "Starting" : "Proposed for"} {q.when}. This Quote is open
          until {q.until}.
        </Notice>
        <Choice q={q} chosen={chosen} setChosen={setChosen} />
        <Extras q={q} />
        {open && <Pay q={q} option={option} />}
      </div>
    );
  }

  if (layout === "B") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {standing}
        <Section title="Quote details">
          <Card>
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <IconTile icon={FileText} />
                <div className="flex flex-col">
                  <span className="font-display text-4xl font-bold tracking-wide">
                    {money(option.total)}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {q.plan ? "a clean, " : ""}tax included
                  </span>
                </div>
              </div>
              <WhenWhere q={q} option={option} />
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <Choice q={q} chosen={chosen} setChosen={setChosen} bare />
              </div>
              <Lines q={q} option={option} />
              {open && <Pay q={q} option={option} inline />}
            </div>
          </Card>
        </Section>
      </div>
    );
  }

  // C: a checkout
  return (
    <div className="flex flex-col gap-6">
      {header}
      {standing}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Section title="When and where">
            <Card>
              <WhenWhere q={q} option={option} />
            </Card>
          </Section>
          <Choice q={q} chosen={chosen} setChosen={setChosen} />
          <Extras q={q} />
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          {open ? (
            <Pay q={q} option={option} summary />
          ) : (
            <Section title="Paid so far">
              <Card>
                <Lines q={q} option={option} />
              </Card>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- the parts ----

function WhenWhere({ q, option }: { q: QuoteCase; option: Option }) {
  return (
    <div className="@container">
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
        <Fact
          icon={CalendarClock}
          label="When"
          value={q.plan ? option.day : q.when}
          line={q.plan ? `From ${q.when}` : "Your clean"}
        />
        <Fact icon={MapPin} label="Where" value={q.address} line="Your home" />
        <Fact
          icon={Users}
          label="Crew"
          value={`${q.crew} Cleaners, about ${option.onSite}`}
          line="On site"
        />
      </dl>
    </div>
  );
}

function Choice({
  q,
  chosen,
  setChosen,
  bare,
}: {
  q: QuoteCase;
  chosen: string;
  setChosen: (key: string) => void;
  bare?: boolean;
}) {
  const cards = q.plan ? (
    <div className="grid gap-4 lg:grid-cols-2">
      {q.options.map((o) => (
        <Card key={o.key} title={o.day} headingLevel={3}>
          <p className="font-display text-3xl font-bold">{money(o.total)}</p>
          <p className="text-sm text-fg-muted">
            {o.name} · <s>{money(o.oneOff!)}</s> as a one-off: save{" "}
            {money(o.oneOff! - o.total)} a clean
          </p>
        </Card>
      ))}
    </div>
  ) : (
    <RadioGroup
      label="Your clean"
      value={chosen}
      onChange={setChosen}
      layout="cards"
      isDisabled={q.status !== "sent"}
    >
      {q.options.map((o) => (
        <RadioCard
          key={o.key}
          value={o.key}
          title={o.name}
          badge={
            o.recommended && (
              <StatusBadge tone="success">Recommended</StatusBadge>
            )
          }
        >
          <span className="font-display text-3xl font-bold">
            {money(o.total)}
          </span>
          <span className="text-sm text-fg-muted">{o.line}</span>
          <span className="text-sm text-fg-muted">
            {o.hours} h of cleaning · {money(o.deposit)} Deposit today
          </span>
        </RadioCard>
      ))}
    </RadioGroup>
  );
  if (bare) return cards;
  return (
    <Section
      title={q.plan ? "Your Service Plan" : "Choose your clean"}
      description={
        q.plan
          ? "Each clean is 10% off a one-off. Prices include tax."
          : "We recommend a Deep Clean for a first visit: it brings your home up to standard. A Standard Clean costs less. Prices include tax."
      }
    >
      {cards}
    </Section>
  );
}

function Extras({ q }: { q: QuoteCase }) {
  return (
    <Section title="Extras" description="Included in the prices above.">
      <Card>
        <p className={q.extras.length ? "text-fg" : "text-fg-muted"}>
          {q.extras.length ? q.extras.join(", ") : "None"}
        </p>
      </Card>
    </Section>
  );
}

// the money, line by line
function Lines({ q, option }: { q: QuoteCase; option: Option }) {
  const today = q.plan ? 0 : option.deposit;
  return (
    <dl className="flex flex-col gap-1 text-sm">
      <Row label={option.name} value={money(option.total - option.tax)} />
      {q.extras.map((x) => (
        <Row key={x} label={`+ ${x}`} value="included" />
      ))}
      <Row label="Tax" value={money(option.tax)} />
      <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
        <dt>{q.plan ? "Each clean" : "Total"}</dt>
        <dd className="tabular-nums">{money(option.total)}</dd>
      </div>
      {!q.plan && (
        <>
          <Row
            label={q.status === "sent" ? "Deposit, today" : "Deposit, paid"}
            value={money(today)}
            strong
          />
          <Row
            label="The rest, when the clean is done"
            value={money(option.total - today)}
          />
        </>
      )}
      {q.plan && (
        <Row label="Charged after each clean" value={money(option.total)} />
      )}
    </dl>
  );
}

const Row = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className="flex justify-between gap-4">
    <dt className={strong ? "font-semibold text-fg" : "text-fg-muted"}>
      {label}
    </dt>
    <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
  </div>
);

function Pay({
  q,
  option,
  summary,
  inline,
}: {
  q: QuoteCase;
  option: Option;
  summary?: boolean;
  // at the Quote's foot, not a Section of its own
  inline?: boolean;
}) {
  const [newCard, setNewCard] = useState(!q.card);
  const today = q.plan ? 0 : option.deposit;
  const accept =
    today > 0
      ? `Accept and pay ${money(today)}`
      : q.plan
        ? "Start my plan"
        : "Accept and book";
  const body = (
    <div className="flex flex-col gap-4">
      {inline && (
        <Heading level={3} size={4}>
          {q.plan ? "Start your plan" : "Accept and book"}
        </Heading>
      )}
      {summary && <Lines q={q} option={option} />}
      {newCard ? (
        <div className="flex flex-col gap-2">
          {/* Stripe's Payment Element draws these, in its own frame */}
          <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-border p-3">
            <TextField
              label="Card number"
              placeholder="1234 1234 1234 1234"
              className="col-span-2"
            />
            <TextField label="Expiration date" placeholder="MM / YY" />
            <TextField label="Security code" placeholder="CVC" />
            <TextField label="Country" defaultValue="United States" />
            <TextField label="ZIP code" placeholder="12345" />
            <p className="col-span-2 text-xs text-fg-muted">
              Drawn by Stripe: the card number never reaches our server.
            </p>
          </div>
          {q.card && (
            <Button
              variant="text"
              size="sm"
              className="self-start"
              onPress={() => setNewCard(false)}
            >
              Use your {q.card}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CreditCard aria-hidden size={18} className="text-fg-muted" />
            Your {q.card}
          </span>
          <Button variant="text" size="sm" onPress={() => setNewCard(true)}>
            Use another card
          </Button>
        </div>
      )}
      <p className="text-sm text-fg-muted">
        {q.plan
          ? `Nothing is taken now. Each clean is charged when it's done; the first is on ${q.when}.`
          : `We take the ${money(today)} Deposit now and the rest when the clean is done, on ${q.when}.`}
      </p>
      {inline ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="text" size="sm" className="self-center">
            Decline this Quote
          </Button>
          <Button className="w-full sm:w-auto">{accept}</Button>
        </div>
      ) : (
        <>
          <Actions>
            <Button className="w-full sm:w-auto">{accept}</Button>
          </Actions>
          <Button variant="text" size="sm" className="self-center">
            Not for me: decline this Quote
          </Button>
        </>
      )}
    </div>
  );
  if (inline) return <div className="border-t border-border pt-4">{body}</div>;
  return (
    <Section title={q.plan ? "Start your plan" : "Accept and book"}>
      <Card>{body}</Card>
    </Section>
  );
}

// PROTOTYPE: throwaway. The Client's Quote (#493), on made-up data, at
// /prototype/client-quote?layout=A..C&case=1..10&lang=en|es (no sign-in),
// inside the portal's own AppLayout and nav. ↑/↓ switch layouts, ←/→
// switch cases. Lives only on prototype-client-quote.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  CreditCard,
  MapPin,
  Repeat,
  Sparkles,
  X,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Avatar,
  Button,
  Card,
  DateTile,
  DetailsCard,
  Dialog,
  Fact,
  Facts,
  type NavItem,
  RecordPage,
  Radio,
  RadioGroup,
  Segment,
  SegmentedControl,
  StatusBadge,
  type StatusTone,
  showToast,
  type Alert,
} from "@empire-cleaning/ui";
import { catalog, theTimeEs } from "@empire-cleaning/models";
import { areaLabels } from "../../session.ts";
import { navFor } from "../AreaLayout.tsx";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { quotePartsWords } from "../QuoteParts.tsx";
import { portalQuoteWords } from "./PortalQuote.tsx";
import { useSaid } from "../words.ts";

// ---- made-up data ----

type ServiceKey = "deep" | "standard";
type Day = "mon" | "wed" | "thu";

type Option = {
  key: ServiceKey;
  totalCents: number;
  taxCents: number;
  depositCents: number;
  // how long the crew is there, worked out by the Office: shown rounded
  hours: number;
  recommended?: boolean;
  bookable?: boolean;
  extras: ("fridge" | "oven")[];
};

type Plan = {
  everyWeeks: 1 | 2;
  days: Day[];
  // the same clean as a one-off, for the saving
  oneOffCents: number;
  savingCents: number;
  // the plan's deposit: one clean's on each weekday
  depositCents: number;
  // the first cleans, for a picture of how often
  firstCleans: string[];
};

type PlanChange = {
  from: string;
  before: { everyWeeks: 1 | 2; days: Day[]; totalCents: number };
  // booked cleans before the change, kept
  kept: string[];
  // booked cleans from then, cancelled at no charge
  cancelled: string[];
  depositCents: number;
};

type Status = "asked" | "sent" | "accepted" | "expired" | "declined";

type QuoteCase = {
  key: string;
  name: string;
  status: Status;
  startsAt: string;
  openUntil: string;
  options: Option[];
  plan?: Plan;
  change?: PlanChange;
  savedCard: string | null;
  bookedUp?: boolean;
  closedAt?: string;
  // while it's asked for: what, how often, and a visit first
  asked?: { service: ServiceKey; everyWeeks: 1 | 2 | null };
  visit?: { who: string; at: string; minutes: number };
};

const address = "41-12 Austin St, 4B";

const deep: Option = {
  key: "deep",
  totalCents: 29941,
  taxCents: 2445,
  depositCents: 7485,
  hours: 2.5,
  recommended: true,
  extras: ["fridge", "oven"],
};
const standard: Option = {
  key: "standard",
  totalCents: 22428,
  taxCents: 1828,
  depositCents: 5607,
  hours: 1.9,
  extras: [],
};
const planClean: Option = {
  key: "standard",
  totalCents: 20185,
  taxCents: 1645,
  depositCents: 5046,
  hours: 3.75,
  extras: [],
};

const jan12 = "2026-01-12T14:00:00Z";
const jan11 = "2026-01-11T14:00:00Z";

const cases: QuoteCase[] = [
  {
    key: "1",
    name: "one-off, one clean",
    status: "sent",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep],
    savedCard: "4242",
  },
  {
    key: "2",
    name: "one-off, two to pick from",
    status: "sent",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep, standard],
    // a new Client: no card saved yet
    savedCard: null,
  },
  {
    key: "3",
    name: "plan, every week",
    status: "sent",
    startsAt: "2026-01-19T14:00:00Z",
    openUntil: "2026-01-18T14:00:00Z",
    options: [planClean],
    plan: {
      everyWeeks: 1,
      days: ["mon"],
      oneOffCents: 22428,
      savingCents: 2243,
      depositCents: 5046,
      firstCleans: [
        "2026-01-19T14:00:00Z",
        "2026-01-26T14:00:00Z",
        "2026-02-02T14:00:00Z",
        "2026-02-09T14:00:00Z",
      ],
    },
    savedCard: "4242",
  },
  {
    key: "4",
    name: "plan, two days a week",
    status: "sent",
    startsAt: "2026-01-19T14:00:00Z",
    openUntil: "2026-01-18T14:00:00Z",
    options: [planClean, planClean],
    plan: {
      everyWeeks: 1,
      days: ["mon", "thu"],
      oneOffCents: 22428,
      savingCents: 2243,
      depositCents: 10092,
      firstCleans: [
        "2026-01-19T14:00:00Z",
        "2026-01-22T14:00:00Z",
        "2026-01-26T14:00:00Z",
        "2026-01-29T14:00:00Z",
      ],
    },
    savedCard: "4242",
  },
  {
    key: "5",
    name: "new terms for a plan (a price change to OK)",
    status: "sent",
    startsAt: "2026-02-04T14:00:00Z",
    openUntil: "2026-01-30T14:00:00Z",
    options: [{ ...planClean, totalCents: 21306, taxCents: 1737 }],
    plan: {
      everyWeeks: 2,
      days: ["wed"],
      oneOffCents: 22428,
      savingCents: 1122,
      depositCents: 5046,
      firstCleans: ["2026-02-04T14:00:00Z", "2026-02-18T14:00:00Z"],
    },
    change: {
      from: "2026-02-02T14:00:00Z",
      before: { everyWeeks: 1, days: ["mon"], totalCents: 20185 },
      kept: ["2026-01-26T14:00:00Z"],
      cancelled: ["2026-02-02T14:00:00Z", "2026-02-09T14:00:00Z"],
      depositCents: 5046,
    },
    savedCard: "4242",
  },
  {
    key: "6",
    name: "asked for, a visit first",
    status: "asked",
    startsAt: jan12,
    openUntil: jan11,
    options: [],
    savedCard: null,
    asked: { service: "deep", everyWeeks: 2 },
    visit: { who: "Olive", at: "2026-01-08T15:00:00Z", minutes: 30 },
  },
  {
    key: "7",
    name: "accepted",
    status: "accepted",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep, standard],
    savedCard: "4242",
    closedAt: "2026-01-05T21:00:00Z",
  },
  {
    key: "8",
    name: "expired",
    status: "expired",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep],
    savedCard: null,
    closedAt: jan11,
  },
  {
    key: "9",
    name: "declined",
    status: "declined",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep, standard],
    savedCard: null,
    closedAt: "2026-01-09T17:00:00Z",
  },
  {
    key: "10",
    name: "its day filled up",
    status: "sent",
    startsAt: jan12,
    openUntil: jan11,
    options: [deep],
    savedCard: "4242",
    bookedUp: true,
  },
];

// ---- words ----

// rounded to the half hour, as a person says it
const half = (h: number) => {
  const r = Math.round(h * 2) / 2;
  const whole = Math.floor(r);
  return { r, text: `${whole || ""}${r % 1 ? "½" : ""}` || "½" };
};

const words = catalog({
  en: {
    service: { deep: "Deep Clean", standard: "Standard Clean" },
    extra: { fridge: "Inside the fridge", oven: "Inside the oven" },
    days: { mon: "Mondays", wed: "Wednesdays", thu: "Thursdays" },
    and: (a: string, b: string) => `${a} and ${b}`,
    often: (every: 1 | 2, days: string, time: string) =>
      `${every === 1 ? "Every week" : "Every 2 weeks"}, ${days} at ${time}`,
    aboutHours: (h: number) => {
      const { r, text } = half(h);
      return `About ${text} ${r <= 1 ? "hour" : "hours"}`;
    },
    // the reader's questions
    howOften: "How often",
    starts: "Starts",
    howLong: "How long",
    included: "Included",
    tax: (amount: string) => `includes ${amount} tax`,
    insteadOf: (amount: string) => `instead of ${amount}`,
    card: (last4: string) => `Visa ending ${last4}`,
    dayFull: "Day filled up",
    whichClean: "Which clean",
    // status, from the Client's side
    badge: {
      A: "Ready for you",
      B: "Waiting on you",
      C: "New",
    },
    asked: "Being prepared",
    // titles
    titleA: {
      oneOff: (service: string, day: string) => `${service} on ${day}`,
      choice: (day: string) => `Your clean on ${day}`,
      twice: "twice a week",
      change: "New terms for your plan",
      asked: (service: string) => `${service}: your quote`,
    },
    titleB: {
      oneOff: (service: string) => service,
      change: "Your plan's new terms",
    },
    titleC: {
      oneOff: (service: string) => `Book your ${service}`,
      choice: "Book your clean",
      plan: "Start your cleaning plan",
      change: "OK your plan's new terms",
      asked: "We're writing your quote",
      booked: (service: string) => `Your ${service} is booked`,
    },
    // the answer
    nothingNow: "Nothing to pay now",
    // after the press
    payToBook: (amount: string) => `Pay ${amount} to book`,
    payToStart: (amount: string) => `Pay ${amount} to start your plan`,
    payWith: "Pay with",
    differentCard: "A different card",
    cardNumber: "Card number",
    termsOneOff: (now: string, rest: string) =>
      `${now} now. The rest, ${rest}, when the clean is done.`,
    termsPlan: (now: string) =>
      `${now} now, held while your plan runs: it comes off your last clean. Each clean is charged when it's done.`,
    consent: "We save this card to charge your cleans.",
    payBook: (amount: string) => `Pay ${amount} and book`,
    payStart: (amount: string) => `Pay ${amount} and start`,
    back: "Back",
    termsToast: "Your plan has its new terms",
    // how it ended
    bookedNotice: (card: string, now: string, rest: string) =>
      `You're booked. We took ${now} from your ${card}, and the rest, ${rest}, when the clean is done.`,
    seeClean: "See your clean",
    askAgain: "Ask for a new quote",
    filledUp: (when: string) =>
      `${when} has filled up since we sent this, so it can't be booked. We'll send you a new time.`,
    // a plan's new terms
    now: "Your plan now",
    stays: "Stays",
    cancelledFree: "Cancelled, no charge",
    newClean: "New",
    // asked for
    visitFirst: "We'll come and look first",
    visits: (who: string, length: string) => `${who} visits, ${length}`,
    free: "Free",
    afterVisit: "We email your quote after the visit.",
    callToMove: "To change the time, call us: (646) 320-9076",
    oneOff: "Once",
    minutes: (n: number) => `about ${n} min`,
  },
  es: {
    service: { deep: "Limpieza profunda", standard: "Limpieza estándar" },
    extra: { fridge: "Dentro del refrigerador", oven: "Dentro del horno" },
    days: { mon: "los lunes", wed: "los miércoles", thu: "los jueves" },
    and: (a: string, b: string) => `${a} y ${b.replace(/^los /, "")}`,
    often: (every: 1 | 2, days: string, time: string) =>
      `${every === 1 ? "Cada semana" : "Cada 2 semanas"}, ${days} a ${theTimeEs(time)}`,
    aboutHours: (h: number) => {
      const { r, text } = half(h);
      return `Cerca de ${text} ${r <= 1 ? "hora" : "horas"}`;
    },
    howOften: "Cada cuánto",
    starts: "Empieza",
    howLong: "Cuánto dura",
    included: "Incluye",
    tax: (amount: string) => `incluye ${amount} de impuestos`,
    insteadOf: (amount: string) => `en vez de ${amount}`,
    card: (last4: string) => `Visa terminada en ${last4}`,
    dayFull: "Día lleno",
    whichClean: "Qué limpieza",
    badge: {
      A: "Lista para usted",
      B: "Espera su respuesta",
      C: "Nueva",
    },
    asked: "En preparación",
    titleA: {
      oneOff: (service: string, day: string) => `${service} el ${day}`,
      choice: (day: string) => `Su limpieza del ${day}`,
      twice: "dos veces por semana",
      change: "Nuevas condiciones para su plan",
      asked: (service: string) => `${service}: su cotización`,
    },
    titleB: {
      oneOff: (service: string) => service,
      change: "Las nuevas condiciones de su plan",
    },
    titleC: {
      oneOff: (service: string) => `Reserve su ${service.toLowerCase()}`,
      choice: "Reserve su limpieza",
      plan: "Empiece su plan de limpieza",
      change: "Apruebe las nuevas condiciones",
      asked: "Estamos preparando su cotización",
      booked: (service: string) => `Su ${service.toLowerCase()} está reservada`,
    },
    nothingNow: "No paga nada ahora",
    payToBook: (amount: string) => `Pague ${amount} para reservar`,
    payToStart: (amount: string) => `Pague ${amount} para empezar su plan`,
    payWith: "Pagar con",
    differentCard: "Otra tarjeta",
    cardNumber: "Número de tarjeta",
    termsOneOff: (now: string, rest: string) =>
      `${now} ahora. El resto, ${rest}, cuando la limpieza esté terminada.`,
    termsPlan: (now: string) =>
      `${now} ahora, que guardamos mientras dure su plan: se descuenta de su última limpieza. Cada limpieza se cobra cuando esté terminada.`,
    consent: "Guardamos esta tarjeta para cobrar sus limpiezas.",
    payBook: (amount: string) => `Pagar ${amount} y reservar`,
    payStart: (amount: string) => `Pagar ${amount} y empezar`,
    back: "Volver",
    termsToast: "Su plan tiene sus nuevas condiciones",
    bookedNotice: (card: string, now: string, rest: string) =>
      `Está reservado. Cobramos ${now} a su ${card}, y el resto, ${rest}, cuando la limpieza esté terminada.`,
    seeClean: "Ver su limpieza",
    askAgain: "Pedir una nueva cotización",
    filledUp: (when: string) =>
      `El ${when} se llenó después de que le enviamos esto, así que no se puede reservar. Le enviaremos otra hora.`,
    now: "Su plan ahora",
    stays: "Sigue",
    cancelledFree: "Cancelada, sin cargo",
    newClean: "Nueva",
    visitFirst: "Primero vamos a verla",
    visits: (who: string, length: string) => `${who} la visita, ${length}`,
    free: "Gratis",
    afterVisit: "Le enviamos la cotización por correo después de la visita.",
    callToMove: "Para cambiar la hora, llámenos: (646) 320-9076",
    oneOff: "Una vez",
    minutes: (n: number) => `cerca de ${n} min`,
  },
});

type T = ReturnType<typeof useT>;
const useT = () => {
  const t = useSaid(words);
  return {
    ...t,
    qw: portalQuoteWords[t.lang],
    pw: quotePartsWords[t.lang],
  };
};

const dayOf = (at: string) => at.slice(0, 10);

// ---- what every layout reads off a case ----

function useQuote(c: QuoteCase, serviceKey: ServiceKey) {
  const t = useT();
  const chosen =
    c.options.find((o) => o.key === serviceKey) ?? c.options[0] ?? deep;
  const plan = c.plan;
  const nowCents = plan ? plan.depositCents : chosen.depositCents;
  const open = c.status === "sent" && !c.bookedUp;
  const rhythm = (p: { everyWeeks: 1 | 2; days: Day[] }) =>
    t.w.often(
      p.everyWeeks,
      p.days.length > 1
        ? t.w.and(t.w.days[p.days[0]!], t.w.days[p.days[1]!])
        : t.w.days[p.days[0]!],
      t.formatTime(c.startsAt),
    );
  return {
    t,
    chosen,
    plan,
    nowCents,
    open,
    rhythm,
    choosing: !plan && c.options.length > 1,
    extras: chosen.extras.map((e) => t.w.extra[e]).join(", "),
  };
}

// the big price: the plan quote's look, lifted to the top and said once
function Price({
  option,
  plan,
  struck = false,
  size = "lg",
}: {
  option: Option;
  plan?: Plan;
  // the one-off price struck through beside it
  struck?: boolean;
  size?: "lg" | "md";
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`font-display font-bold tracking-wide tabular-nums ${size === "lg" ? "text-5xl" : "text-4xl"}`}
        >
          {t.formatMoney(option.totalCents)}
        </span>
        {plan && <span className="text-fg-muted">{t.pw.aClean.trim()}</span>}
        {plan && struck && (
          <span className="text-fg-muted line-through tabular-nums">
            <span className="sr-only">{t.w.insteadOf("")}</span>
            {t.formatMoney(plan.oneOffCents)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-fg-muted">
          {t.w.tax(t.formatMoney(option.taxCents))}
        </span>
        {plan && (
          <StatusBadge tone="success">
            {t.pw.save(t.formatMoney(plan.savingCents))}
          </StatusBadge>
        )}
      </div>
    </div>
  );
}

// the status badge, from the Client's side
function badgeOf(
  t: T,
  c: QuoteCase,
  layout: LayoutKey,
): { tone: StatusTone; label: string } {
  switch (c.status) {
    case "asked":
      return { tone: "info", label: t.w.asked };
    case "accepted":
      return { tone: "success", label: t.jobStatusLabel.booked };
    case "expired":
      return { tone: "neutral", label: t.clientQuoteStatus.expired.label };
    case "declined":
      return { tone: "neutral", label: t.clientQuoteStatus.declined.label };
    default:
      if (c.bookedUp) return { tone: "warning", label: t.w.dayFull };
      return {
        tone: layout === "C" ? "info" : "warning",
        label: t.w.badge[layout],
      };
  }
}

// how it ended, or that it can't be booked: one Notice, one action
function alertsOf(t: T, c: QuoteCase, chosen: Option, onDecline: () => void) {
  const alerts: Alert[] = [];
  if (c.status === "accepted")
    alerts.push({
      key: "booked",
      tone: "success",
      action: (
        <Button variant="text" onPress={() => say(t.w.seeClean)}>
          {t.w.seeClean}
        </Button>
      ),
      children: t.w.bookedNotice(
        t.w.card(c.savedCard ?? ""),
        t.formatMoney(chosen.depositCents),
        t.formatMoney(chosen.totalCents - chosen.depositCents),
      ),
    });
  if (c.status === "expired" || c.status === "declined")
    alerts.push({
      key: "closed",
      action: (
        <Button variant="text" onPress={() => say(t.w.askAgain)}>
          {t.w.askAgain}
        </Button>
      ),
      children:
        c.status === "expired"
          ? t.qw.expiredOn(t.formatDateTime(c.closedAt!))
          : t.qw.declinedOn(t.formatDateTime(c.closedAt!)),
    });
  if (c.bookedUp)
    alerts.push({
      key: "full",
      tone: "warning",
      action: (
        <Button variant="danger-text" onPress={onDecline}>
          {t.p.decline}
        </Button>
      ),
      children: t.w.filledUp(t.formatDateTime(c.startsAt)),
    });
  return alerts;
}

const say = (title: string) => showToast({ title, tone: "info" });

// ---- after the press: the card, and how the money's taken ----

function PayStep({
  c,
  q,
  onDone,
  onBack,
  inline = false,
}: {
  c: QuoteCase;
  q: ReturnType<typeof useQuote>;
  onDone: () => void;
  onBack: () => void;
  // in place in the card (B), rather than in a dialog
  inline?: boolean;
}) {
  const { t, chosen, plan, nowCents } = q;
  const [card, setCard] = useState(c.savedCard ? "saved" : "new");
  const now = t.formatMoney(nowCents);
  return (
    <div className="flex flex-col gap-4">
      {inline && (
        <p className="font-display text-lg font-semibold">
          {plan ? t.w.payToStart(now) : t.w.payToBook(now)}
        </p>
      )}
      {c.savedCard ? (
        <RadioGroup label={t.w.payWith} value={card} onChange={setCard}>
          <Radio value="saved">
            <span className="flex items-center gap-2">
              <CreditCard aria-hidden size={18} />
              {t.w.card(c.savedCard)}
            </span>
          </Radio>
          <Radio value="new">{t.w.differentCard}</Radio>
        </RadioGroup>
      ) : null}
      {card === "new" && <FakeCardField />}
      <p className="text-sm text-fg-muted">
        {plan
          ? t.w.termsPlan(now)
          : t.w.termsOneOff(
              now,
              t.formatMoney(chosen.totalCents - chosen.depositCents),
            )}
        {card === "new" && ` ${t.w.consent}`}
      </p>
      <Actions>
        <Button variant="quiet" onPress={onBack}>
          {inline ? t.w.back : t.p.cancel}
        </Button>
        <Button
          onPress={() => {
            showToast({
              title: plan ? t.qw.planStartedToast : t.qw.bookedToast,
              tone: "success",
            });
            onDone();
          }}
        >
          {plan ? t.w.payStart(now) : t.w.payBook(now)}
        </Button>
      </Actions>
    </div>
  );
}

// Stripe's card field, drawn
function FakeCardField() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-md border-b-2 border-border bg-surface-sunken px-3 py-3 text-fg-muted">
      <CreditCard aria-hidden size={18} />
      <span className="flex-1">{t.w.cardNumber}</span>
      <span>MM / YY</span>
      <span>CVC</span>
    </div>
  );
}

// "Accept and pay $X", and the step it opens in a dialog (A and C)
function AcceptInDialog({
  c,
  q,
  onAccepted,
}: {
  c: QuoteCase;
  q: ReturnType<typeof useQuote>;
  onAccepted: () => void;
}) {
  const { t, plan, nowCents } = q;
  const [open, setOpen] = useState(false);
  const now = t.formatMoney(nowCents);
  if (c.change)
    return (
      <Button
        onPress={() => {
          showToast({ title: t.w.termsToast, tone: "success" });
          onAccepted();
        }}
      >
        {t.qw.acceptNew}
      </Button>
    );
  return (
    <>
      <Button onPress={() => setOpen(true)}>{t.qw.acceptPay(now)}</Button>
      <Dialog
        title={plan ? t.w.payToStart(now) : t.w.payToBook(now)}
        isOpen={open}
        onOpenChange={setOpen}
      >
        <PayStep
          c={c}
          q={q}
          onBack={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onAccepted();
          }}
        />
      </Dialog>
    </>
  );
}

function DeclineButton({ onDecline }: { onDecline: () => void }) {
  const t = useT();
  return (
    <Button variant="danger-text" onPress={onDecline}>
      {t.p.decline}
    </Button>
  );
}

// ---- the picture of a plan's new terms ----

// a clean as a small date tile, kept, cancelled (struck, with a cross and
// its word) or new
function CleanTile({
  at,
  kind,
}: {
  at: string;
  kind: "kept" | "cancelled" | "new";
}) {
  const t = useT();
  return (
    <li className="flex w-16 flex-col items-center gap-1 text-center">
      <span
        className={`relative ${kind === "cancelled" ? "opacity-50" : ""} ${kind === "new" ? "rounded-md ring-2 ring-success-strong" : ""}`}
      >
        <DateTile date={at} size="sm" />
        {kind === "cancelled" && (
          <X
            aria-hidden
            size={44}
            strokeWidth={1.5}
            className="absolute inset-0 m-auto text-danger"
          />
        )}
      </span>
      <span className="sr-only">{t.formatDateTime(at)}</span>
      <span
        className={`text-xs ${kind === "cancelled" ? "text-danger" : kind === "new" ? "font-semibold text-success-strong" : "text-fg-muted"}`}
      >
        {kind === "kept"
          ? t.w.stays
          : kind === "cancelled"
            ? t.w.cancelledFree
            : t.w.newClean}
      </span>
    </li>
  );
}

function PlanChangePicture({
  c,
  q,
}: {
  c: QuoteCase;
  q: ReturnType<typeof useQuote>;
}) {
  const { t, rhythm, chosen } = q;
  const change = c.change!;
  const tiles = [
    ...change.kept.map((at) => ({ at, kind: "kept" as const })),
    ...change.cancelled.map((at) => ({ at, kind: "cancelled" as const })),
    ...c.plan!.firstCleans.map((at) => ({ at, kind: "new" as const })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-muted">{t.w.now}</span>
          <span className="text-fg-muted line-through">
            {rhythm(change.before)}
          </span>
          <span className="text-fg-muted line-through tabular-nums">
            {t.formatMoney(change.before.totalCents)} {t.pw.aClean.trim()}
          </span>
        </div>
        <ArrowRight aria-hidden className="mt-6 text-fg-muted" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-muted">
            {t.qw.from(t.formatDay(dayOf(change.from)))}
          </span>
          <span className="font-semibold">{rhythm(c.plan!)}</span>
          <span className="font-semibold tabular-nums">
            {t.formatMoney(chosen.totalCents)} {t.pw.aClean.trim()}
          </span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {tiles.map((x) => (
          <CleanTile key={x.at} at={x.at} kind={x.kind} />
        ))}
      </ul>
    </div>
  );
}

// a plan's first cleans as small date tiles: how often, as a picture
function FirstCleans({ plan }: { plan: Plan }) {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t.w.starts}>
      {plan.firstCleans.map((at) => (
        <li key={at}>
          <DateTile date={at} size="sm" />
          <span className="sr-only">{t.formatDateTime(at)}</span>
        </li>
      ))}
      <li aria-hidden className="self-center px-1 text-fg-muted">
        …
      </li>
    </ul>
  );
}

// ---- asked for: no price yet, the visit as a picture ----

function AskedCard({
  c,
  titled = false,
}: {
  c: QuoteCase;
  // the title already names the clean asked for
  titled?: boolean;
}) {
  const t = useT();
  const visit = c.visit!;
  const asked = c.asked!;
  return (
    <>
      <Card>
        <div className="flex items-center gap-4">
          <DateTile date={visit.at} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-fg-muted">{t.w.visitFirst}</p>
            <p className="text-xl font-semibold">
              {t.formatDateTime(visit.at)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2">
                <Avatar size="md" />
                <span>{t.w.visits(visit.who, t.w.minutes(visit.minutes))}</span>
              </span>
              <StatusBadge tone="success">{t.w.free}</StatusBadge>
            </div>
          </div>
        </div>
        <p className="border-t border-border pt-4 text-sm text-fg-muted">
          {t.w.afterVisit} {t.w.callToMove}
        </p>
      </Card>
      <DetailsCard label={t.qw.askedFor}>
        <Facts>
          {!titled && (
            <Fact
              icon={Sparkles}
              label={t.qw.askedFor}
              value={t.w.service[asked.service]}
            />
          )}
          <Fact
            icon={Repeat}
            label={t.w.howOften}
            value={
              asked.everyWeeks === null
                ? t.w.oneOff
                : t.w
                    .often(asked.everyWeeks, t.w.days.mon, "9:00 AM")
                    .split(",")[0]!
            }
          />
          <Fact icon={MapPin} label={t.qw.where} value={address} />
        </Facts>
      </DetailsCard>
    </>
  );
}

// ---- A: the price leads one card, the button under it ----

function LayoutA({ c, go }: LayoutProps) {
  const [serviceKey, setServiceKey] = useState<ServiceKey>(
    c.options.find((o) => o.bookable !== false)?.key ?? "deep",
  );
  const q = useQuote(c, serviceKey);
  const { t, chosen, plan, open, rhythm, choosing, extras } = q;
  const badge = badgeOf(t, c, "A");
  const day = t.formatDay(dayOf(c.startsAt));
  const title =
    c.status === "asked"
      ? t.w.titleA.asked(t.w.service[c.asked!.service])
      : c.change
        ? t.w.titleA.change
        : plan
          ? `${t.w.service[chosen.key]}, ${plan.days.length > 1 ? t.w.titleA.twice : t.recurrence.weekly}`
          : choosing && c.status === "sent"
            ? t.w.titleA.choice(day)
            : t.w.titleA.oneOff(t.w.service[chosen.key], day);

  return (
    <RecordPage
      trail={[
        { label: t.p.home, href: linkTo({ to: "/portal" }) },
        { label: t.p.yourQuote },
      ]}
      title={title}
      status={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
      alerts={alertsOf(t, c, chosen, go.decline)}
      details={
        c.status === "asked" ? (
          <AskedCard c={c} titled />
        ) : (
          <DetailsCard label={t.p.yourQuote}>
            {c.change ? (
              <PlanChangePicture c={c} q={q} />
            ) : (
              <Price option={chosen} plan={plan} />
            )}
            {choosing && c.status === "sent" && (
              <div className="border-t border-border pt-4">
                <RadioGroup
                  label={t.w.whichClean}
                  value={chosen.key}
                  onChange={(k) => setServiceKey(k as ServiceKey)}
                >
                  {c.options.map((o) => (
                    <Radio key={o.key} value={o.key}>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{t.w.service[o.key]}</span>
                        <span className="font-normal text-fg-muted tabular-nums">
                          {t.formatMoney(o.totalCents)}
                        </span>
                        {o.recommended && (
                          <StatusBadge tone="success">
                            {t.qw.recommended}
                          </StatusBadge>
                        )}
                      </span>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            )}
            <div className="border-t border-border pt-4">
              <Facts>
                {plan && !c.change && (
                  <Fact
                    icon={Repeat}
                    label={t.w.howOften}
                    value={rhythm(plan)}
                  />
                )}
                {plan && (
                  <Fact
                    icon={CalendarClock}
                    label={t.w.starts}
                    value={t.formatDateTime(c.startsAt)}
                  />
                )}
                <Fact icon={MapPin} label={t.qw.where} value={address} />
                <Fact
                  icon={Clock}
                  label={t.w.howLong}
                  value={t.w.aboutHours(chosen.hours)}
                />
                {extras && (
                  <Fact icon={Sparkles} label={t.w.included} value={extras} />
                )}
              </Facts>
            </div>
          </DetailsCard>
        )
      }
    >
      {open && (
        <div className="flex flex-col items-end gap-2">
          <Actions>
            <DeclineButton onDecline={go.decline} />
            <AcceptInDialog c={c} q={q} onAccepted={go.accept} />
          </Actions>
          <p className="text-sm text-fg-muted">
            {c.change ? `${t.w.nothingNow} · ` : ""}
            {t.p.openUntil(t.formatDateTime(c.openUntil))}
          </p>
        </div>
      )}
    </RecordPage>
  );
}

// ---- B: one offer card, the when as a tile, the answer in it ----

function LayoutB({ c, go }: LayoutProps) {
  const [serviceKey, setServiceKey] = useState<ServiceKey>("deep");
  const [paying, setPaying] = useState(false);
  const q = useQuote(c, serviceKey);
  const { t, chosen, plan, open, rhythm, choosing, extras, nowCents } = q;
  const badge = badgeOf(t, c, "B");
  const title =
    c.status === "asked"
      ? t.p.yourQuote
      : c.change
        ? t.w.titleB.change
        : plan
          ? t.p.yourPlan
          : choosing && c.status === "sent"
            ? t.formatList(
                c.options.map((o) => t.w.service[o.key]),
                "or",
              )
            : t.w.titleB.oneOff(t.w.service[chosen.key]);

  return (
    <RecordPage
      trail={[
        { label: t.p.home, href: linkTo({ to: "/portal" }) },
        { label: t.p.yourQuote },
      ]}
      title={title}
      status={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
      alerts={alertsOf(t, c, chosen, go.decline)}
      details={
        c.status === "asked" ? (
          <AskedCard c={c} />
        ) : (
          <Card hiddenTitle={t.p.yourQuote}>
            {choosing && c.status === "sent" && (
              <SegmentedControl
                label={t.w.whichClean}
                value={chosen.key}
                onChange={(k) => setServiceKey(k as ServiceKey)}
                description={
                  chosen.recommended ? (
                    <StatusBadge tone="success">{t.qw.recommended}</StatusBadge>
                  ) : undefined
                }
              >
                {c.options.map((o) => (
                  <Segment key={o.key} value={o.key}>
                    {t.w.service[o.key]}
                  </Segment>
                ))}
              </SegmentedControl>
            )}
            {c.change ? (
              <PlanChangePicture c={c} q={q} />
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <DateTile date={c.startsAt} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm text-fg-muted">
                    {plan ? t.w.starts : t.qw.when}
                  </p>
                  <p className="text-xl font-semibold">
                    {t.formatDateTime(c.startsAt)}
                  </p>
                  {plan && <p className="text-fg-muted">{rhythm(plan)}</p>}
                </div>
                <div className="w-full sm:w-auto">
                  <Price option={chosen} plan={plan} struck size="md" />
                </div>
              </div>
            )}
            <div className="border-t border-border pt-4">
              <Facts>
                <Fact icon={MapPin} label={t.qw.where} value={address} />
                <Fact
                  icon={Clock}
                  label={t.w.howLong}
                  value={t.w.aboutHours(chosen.hours)}
                />
                {extras && (
                  <Fact icon={Sparkles} label={t.w.included} value={extras} />
                )}
              </Facts>
            </div>
            {open && (
              <div className="border-t border-border pt-4">
                {paying ? (
                  <PayStep
                    c={c}
                    q={q}
                    inline
                    onBack={() => setPaying(false)}
                    onDone={go.accept}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    <Actions>
                      <DeclineButton onDecline={go.decline} />
                      <Button
                        onPress={() =>
                          c.change
                            ? (showToast({
                                title: t.w.termsToast,
                                tone: "success",
                              }),
                              go.accept())
                            : setPaying(true)
                        }
                      >
                        {c.change
                          ? t.qw.acceptNew
                          : t.qw.acceptPay(t.formatMoney(nowCents))}
                      </Button>
                    </Actions>
                    <p className="text-right text-sm text-fg-muted">
                      {c.change ? `${t.w.nothingNow} · ` : ""}
                      {t.p.openUntil(t.formatDateTime(c.openUntil))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      }
    />
  );
}

// ---- C: when first, as a picture; the price and the button in a bar ----

function LayoutC({ c, go }: LayoutProps) {
  const [serviceKey, setServiceKey] = useState<ServiceKey>("deep");
  const q = useQuote(c, serviceKey);
  const { t, chosen, plan, open, rhythm, choosing, extras } = q;
  const badge = badgeOf(t, c, "C");
  const service = t.w.service[chosen.key];
  const title =
    c.status === "asked"
      ? t.w.titleC.asked
      : c.status === "accepted"
        ? t.w.titleC.booked(service)
        : c.status !== "sent" || c.bookedUp
          ? t.w.titleB.oneOff(service)
          : c.change
            ? t.w.titleC.change
            : plan
              ? t.w.titleC.plan
              : choosing
                ? t.w.titleC.choice
                : t.w.titleC.oneOff(service);

  return (
    <RecordPage
      trail={[
        { label: t.p.home, href: linkTo({ to: "/portal" }) },
        { label: t.p.yourQuote },
      ]}
      title={title}
      status={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
      alerts={alertsOf(t, c, chosen, go.decline)}
      details={
        c.status === "asked" ? (
          <AskedCard c={c} />
        ) : (
          <DetailsCard
            label={t.p.yourQuote}
            tile={!plan && <DateTile date={c.startsAt} />}
            kicker={c.change ? undefined : plan ? t.w.howOften : t.qw.when}
            title={
              c.change
                ? undefined
                : plan
                  ? rhythm(plan)
                  : t.formatDateTime(c.startsAt)
            }
          >
            {c.change ? (
              <PlanChangePicture c={c} q={q} />
            ) : (
              plan && <FirstCleans plan={plan} />
            )}
            {choosing && c.status === "sent" && (
              <RadioGroup
                label={t.w.whichClean}
                value={chosen.key}
                onChange={(k) => setServiceKey(k as ServiceKey)}
              >
                {c.options.map((o) => (
                  <Radio key={o.key} value={o.key}>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{t.w.service[o.key]}</span>
                      <span className="font-normal text-fg-muted tabular-nums">
                        {t.formatMoney(o.totalCents)}
                      </span>
                      {o.recommended && (
                        <StatusBadge tone="success">
                          {t.qw.recommended}
                        </StatusBadge>
                      )}
                    </span>
                  </Radio>
                ))}
              </RadioGroup>
            )}
            <Facts>
              <Fact icon={MapPin} label={t.qw.where} value={address} />
              <Fact
                icon={Clock}
                label={t.w.howLong}
                value={t.w.aboutHours(chosen.hours)}
              />
              {extras && (
                <Fact icon={Sparkles} label={t.w.included} value={extras} />
              )}
            </Facts>
            {!open && <Price option={chosen} plan={plan} size="md" />}
          </DetailsCard>
        )
      }
      footer={
        open
          ? {
              label: t.p.yourQuote,
              summary: c.change ? undefined : (
                <BarPrice option={chosen} plan={plan} />
              ),
              children: (
                <>
                  <DeclineButton onDecline={go.decline} />
                  <AcceptInDialog c={c} q={q} onAccepted={go.accept} />
                </>
              ),
            }
          : undefined
      }
    >
      {open && (
        <p className="text-sm text-fg-muted">
          {c.change ? `${t.w.nothingNow} · ` : ""}
          {t.p.openUntil(t.formatDateTime(c.openUntil))}
        </p>
      )}
    </RecordPage>
  );
}

// the price as the bar sums it up: big, "a clean", the saving
function BarPrice({ option, plan }: { option: Option; plan?: Plan }) {
  const t = useT();
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-display text-3xl font-bold tabular-nums">
        {t.formatMoney(option.totalCents)}
      </span>
      {plan && (
        <span className="text-sm text-fg-muted">{t.pw.aClean.trim()}</span>
      )}
      {plan && (
        <StatusBadge tone="success">
          {t.pw.save(t.formatMoney(plan.savingCents))}
        </StatusBadge>
      )}
    </span>
  );
}

// ---- the page ----

const layouts = [
  { key: "A", name: "the price leads, the button under the card" },
  { key: "B", name: "one offer card, the answer in it" },
  { key: "C", name: "when first, the price in a bar" },
] as const;
type LayoutKey = (typeof layouts)[number]["key"];

type LayoutProps = {
  c: QuoteCase;
  go: { accept: () => void; decline: () => void };
};

const notes: Record<LayoutKey, { idea: string; title: string; pay: string }> = {
  A: {
    idea: "The record page as it is, one card: the price big at the top (the plan quote's look), the choice as flat rows under it, then How often · Starts · Where · How long · Included. Accept and Decline under the card, Open until under them.",
    title:
      'What and when: "Deep Clean on Mon, Jan 12". Badge: "Ready for you".',
    pay: "Accept and pay opens a dialog: which card, what's taken now and when the rest is, then Pay.",
  },
  B: {
    idea: "One offer card holding everything, Home's answer card shape: the start as a date tile, the price beside it with the one-off price struck, the choice as a two-way switch, and the answer at the card's foot.",
    title: 'What: "Deep Clean", "Your cleaning plan". Badge: "Waiting on you".',
    pay: "Accept and pay opens the pay step in place, in the same card (Back to undo).",
  },
  C: {
    idea: "When leads, as a picture (a date tile, or a plan's first cleans as tiles); the price and the answer stay in reach in a bar at the foot, the price shown nowhere else while it's open.",
    title:
      'What to do: "Book your Deep Clean", "Start your cleaning plan"; once accepted, "Your Deep Clean is booked". Badge: "New".',
    pay: "The bar's Accept and pay opens a dialog, as A's.",
  },
};

function LayoutNote({ layout }: { layout: LayoutKey }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const note = notes[layout];
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border-2 border-dashed border-border p-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <strong>Layout {layout}.</strong> {note.idea}
        </p>
        <p>
          <strong>Title:</strong> {note.title}
        </p>
        <p>
          <strong>After the press:</strong> {note.pay}
        </p>
      </div>
      <Button
        variant="quiet"
        size="icon"
        aria-label="Hide the note"
        onPress={() => setOpen(false)}
      >
        <X aria-hidden size={18} />
      </Button>
    </div>
  );
}

function Layout(props: LayoutProps & { layout: LayoutKey }) {
  if (props.layout === "B") return <LayoutB {...props} />;
  if (props.layout === "C") return <LayoutC {...props} />;
  return <LayoutA {...props} />;
}

export function ClientQuotePrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
    lang?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? cases[0]!;
  const lang = search.lang === "es" ? "es" : "en";
  const goTo = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/client-quote",
      search: { case: c.key, layout, lang: search.lang, ...change },
      replace: true,
    });
  const go = {
    accept: () => goTo({ case: "7" }),
    decline: () => {
      showToast({ title: portalQuoteWords[lang].declined, tone: "info" });
      goTo({ case: "9" });
    },
  };

  const nav: NavItem[] = navFor(lang).portal.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === navFor(lang).portal[0]!.label,
    }),
  );
  return (
    <AppLayout area={areaLabels[lang].portal} nav={nav} foot={() => null}>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <LayoutNote key={layout} layout={layout} />
      <Layout key={`${c.key}-${layout}`} c={c} layout={layout} go={go} />
      <PrototypeSwitcher
        variants={layouts.map((l) => ({ key: l.key, name: l.name }))}
        current={layout}
        onChange={(k) => goTo({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="top-16 md:top-3"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => goTo({ case: k })}
        className="top-28 md:top-15"
      />
    </AppLayout>
  );
}

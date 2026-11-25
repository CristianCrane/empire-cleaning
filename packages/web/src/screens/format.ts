import type {
  AssignmentState,
  AssignmentStatus,
  ClientName,
  Condition,
  HomeRooms,
  JobStatus,
  PlanDaySummary,
  PropertyView,
  QuoteKind,
  QuoteSummary,
  QuoteStatus,
  Recurrence,
  RevisionSummary,
  ServicePlanStatus,
  Weekday,
} from "@empire-cleaning/models";
import type { Time } from "@internationalized/date";
import {
  catalog,
  clockTime,
  dayOf,
  formats,
  HOUR_MS,
  inLine,
  type Language,
  lineOf,
  messages,
  quarterHours,
  timeOf,
  upperFirst,
  weekdayOf,
} from "@empire-cleaning/models";
import { conditions, formWords } from "@empire-cleaning/quote-request";
import { labels } from "./labels.ts";
import { jobStatusIcon, NeedsCleanersIcon } from "./icons.ts";
import type { StatusTone } from "@empire-cleaning/ui";

export const addressOf = (
  p: Pick<PropertyView, "street" | "unit" | "postcode">,
) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

// things, those that read alike together, in the order they come: one
// kind when all read alike (a plan's weekdays by length, a send's by crew)
export const alike = <T>(things: T[], key: (thing: T) => string) => {
  const kinds = new Map<string, T[]>();
  for (const thing of things)
    kinds.set(key(thing), [...(kinds.get(key(thing)) ?? []), thing]);
  return [...kinds.values()];
};

// a row's line of parts as text, where a slot takes only text; a row's
// own line is the kit's Line
export { lineOf };

// a Job's crew, or that it has none yet
export const crewOf = (crew: { name: string }[]) =>
  crew.map((c) => c.name).join(", ") || "No cleaners yet";

// so many of a thing, "2 bedrooms", "1 baño": the number held to its word,
// so a narrow line never ends on "1.5" with "bathrooms" under it
const countIn =
  (lang: Language) => (n: number, forms: { one: string; other: string }) =>
    `${n}\u00a0${formats[lang].plural(n, forms)}`;

// "2 bedrooms", "1 bathroom", for the Office
const count = (n: number, one: string) =>
  countIn("en")(n, { one, other: `${one}s` });

// a home's rooms in full, as a Client gives them, for the Office: "2 bedrooms, 1.5
// bathrooms, 1 storey, pets"
export const roomsText = (r: HomeRooms) =>
  [
    r.bedrooms === 0 ? "a studio" : count(r.bedrooms, "bedroom"),
    count(r.bathrooms, "bathroom"),
    count(r.storeys, "storey"),
    r.pets ? "pets" : "no pets",
  ].join(", ");

// a Client as the Office names them: "Acme Dental (Casey Client)" for a
// business, else just the person
export const clientName = (c: Pick<ClientName, "name" | "businessName">) =>
  c.businessName ? `${c.businessName} (${c.name})` : c.name;

// where there's room for only one name, such as the Schedule's blocks: a
// business's own
export const shortClientName = (c: Pick<ClientName, "name" | "businessName">) =>
  c.businessName ?? c.name;

// a length as the Office reads it, to the minute, as the Schedule books
// it: 1.63 -> "1 h 38 min", 3 -> "3 h", 0.75 -> "45 min" (a Client or a
// Cleaner reads it to the quarter hour: howLong)
export const formatHours = (hours: number) =>
  formatMinutes(Math.round(hours * 60)) || "0 h";

// hours the Office types or prices at a rate, as she types them: the Price
// list's, a working-out's sums, cleaning hours, extra time, a cleaner's
// working day: 1.125 -> "1.125 h" (docs/ux.md, "A length of time")
export const typedHours = (hours: number) =>
  `${Math.round(hours * 10000) / 10000} h`;

// when a Job is over: its start and its hours, to the quarter hour as
// howLong says them
export const endOf = (startsAt: string, hours: number) =>
  new Date(Date.parse(startsAt) + quarterHours(hours) * HOUR_MS).toISOString();

export const roleLabel = {
  cleaner: "Cleaner",
  office_staff: "Office staff",
};

// Empire Cleaning's days and times are New York's, wherever the viewer is
// (BUSINESS_TIME_ZONE); the API sends instants as ISO strings

// today in New York: "2026-01-05"
export const today = () => dayOf(new Date());

export const quoteStatusLabel = {
  requested: "Requested",
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  turned_down: "Turned down",
};

// one meaning per colour (docs/ux.md, Notices): done is success
export const quoteStatusTone = {
  requested: "warning",
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "neutral",
  expired: "warning",
  turned_down: "neutral",
} as const;

// for NumberField's formatOptions on prices
export const dollars = { style: "currency", currency: "USD" } as const;

// an instant -> its New York wall-clock time, "09:00"
export const timeOfDay = (iso: string) => timeOf(new Date(iso));

// a time field's value -> its start time, "09:30"; none while it's empty
export function timeOfField(time: Time): string;
export function timeOfField(time: Time | null | undefined): string | undefined;
export function timeOfField(time: Time | null | undefined) {
  return time ? clockTime(time.hour * 60 + time.minute) : undefined;
}

// an instant -> the New York day it falls on, "2026-01-12"
export const dayOfInstant = (iso: string) => dayOf(new Date(iso));

// a plan's day that comes round on the weekday of `day` ("2026-01-19"),
// if any does
export const planDayOn = <Day extends { startsAt: string }>(
  days: Day[],
  day: string,
) => days.find((d) => weekdayOf(dayOfInstant(d.startsAt)) === weekdayOf(day));

// a Site Visit's length: 30 -> "30 min", 90 -> "1 h 30 min"
export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 && `${hours} h`, rest > 0 && `${rest} min`]
    .filter(Boolean)
    .join(" ");
};

export const siteVisitStatusLabel = {
  booked: "Booked",
  done: "Done",
  cancelled: "Cancelled",
} as const;

// a plan Job its Client cancelled on its own is skipped: the plan carries
// on. One cancelled as the plan ended or changed isn't
export const wasSkipped = (job: {
  servicePlanId: string | null;
  cancellation: { by: string; withPlan: string | null } | null;
}) =>
  job.servicePlanId !== null &&
  job.cancellation?.by === "client" &&
  !job.cancellation.withPlan;

// A Job's status in the tones every status takes: booked is just so, done
// went well, cancelled is over, No Access went wrong (JobStatusBadge)
export const jobStatusTone = {
  booked: "info",
  completed: "success",
  cancelled: "neutral",
  no_access: "danger",
} as const satisfies Record<JobStatus, string>;

// whether a booked Job's crew is whole, as the Office sees it (JobBadge)
export const crewLabel: Record<AssignmentStatus, string> = {
  assigned: "Staffed",
  unassigned: "Needs cleaners",
};

export const crewTone = {
  assigned: "info",
  unassigned: "warning",
} as const satisfies Record<AssignmentStatus, string>;

// how a Job reads for Office Staff: how it went, or while it's booked,
// whether its crew is whole (JobBadge, the Schedule's blocks), and its icon
// where it isn't the usual case
export const jobLabelOf = (job: {
  status: JobStatus;
  assignment: AssignmentStatus;
}) =>
  job.status === "booked"
    ? {
        label: crewLabel[job.assignment],
        tone: crewTone[job.assignment],
        icon: job.assignment === "unassigned" ? NeedsCleanersIcon : undefined,
      }
    : {
        label: screenWords.en.jobStatusLabel[job.status],
        tone: jobStatusTone[job.status],
        icon: jobStatusIcon[job.status],
      };

// The screens' words for things, in each language (ADR-0025):
// `screenWords[lang]`, as models' `formats[lang]`; the Office's screens take
// `screenWords.en`. A literal here is in `words` or `labels` (labels.ts), in both
// languages.
const words = catalog({
  en: {
    cleaner: { one: "cleaner", other: "cleaners" },
    moreCleaner: { one: "more cleaner", other: "more cleaners" },
    freeCleaner: { one: "free cleaner", other: "free cleaners" },
    sqFt: (area: string) => `${area}\u00a0sq\u00a0ft`,
    floorAreaNotKnown: "floor area not known yet",
    roomsNotKnown: "rooms not known yet",
    studio: "Studio",
    bedroom: { one: "bedroom", other: "bedrooms" },
    bathroom: { one: "bathroom", other: "bathrooms" },
    oneOff: "A one-off clean",
    quoteKind: { service_plan: "Cleaning plan quote", one_off: "Quote" },
    clientQuoteStatus: {
      requested: "Asked for",
      draft: "Asked for",
      sent: "Ready",
      accepted: "Accepted",
      declined: "Declined",
      expired: "Expired",
      turned_down: "Turned down",
    } satisfies Record<QuoteStatus, string>,
    planStatus: {
      active: "Active",
      on_hold: "Paused",
      ended: "Ended",
    } satisfies Record<ServicePlanStatus, string>,
    everyWeekOn: (what: string, days: string) =>
      `${what}, every week${days ? ` on ${days}` : ""}`,
    notPriced: "Not priced yet",
    planPrice: (price: string, perWeek: boolean) =>
      `${price} ${perWeek ? "a week" : "a clean"}`,
    planOf: (service: string) => `${service} plan`,
    planHeadline: (plan: string, price: string) =>
      `Cleaning plan, ${plan}: ${price}`,
    rhythm: (often: string, when: string) => `${often}, on ${when}`,
    skipped: "Skipped",
    // where someone stands on a Job's crew: the Office's, and a Cleaner's
    // own Offered or Confirmed
    assignmentState: {
      offered: "Offered",
      confirmed: "Confirmed",
      released: "Dropped out",
      taken_off: "Taken off",
    } satisfies Record<AssignmentState, string>,
  },
  es: {
    cleaner: { one: "limpiador", other: "limpiadores" },
    moreCleaner: { one: "limpiador más", other: "limpiadores más" },
    freeCleaner: { one: "limpiador libre", other: "limpiadores libres" },
    sqFt: (area: string) => `${area}\u00a0pies²`,
    floorAreaNotKnown: "superficie aún sin saber",
    roomsNotKnown: "habitaciones aún sin saber",
    studio: "Estudio",
    bedroom: { one: "dormitorio", other: "dormitorios" },
    bathroom: { one: "baño", other: "baños" },
    oneOff: "Una sola limpieza",
    quoteKind: {
      service_plan: "Cotización de plan de limpieza",
      one_off: "Cotización",
    },
    clientQuoteStatus: {
      requested: "Solicitada",
      draft: "Solicitada",
      sent: "Lista",
      accepted: "Aceptada",
      declined: "Rechazada",
      expired: "Vencida",
      turned_down: "Descartada",
    },
    planStatus: { active: "Activo", on_hold: "En pausa", ended: "Finalizado" },
    everyWeekOn: (what: string, days: string) =>
      `${what}, cada semana${days ? ` los ${days}` : ""}`,
    notPriced: "Aún sin precio",
    planPrice: (price: string, perWeek: boolean) =>
      `${price} ${perWeek ? "por semana" : "por limpieza"}`,
    planOf: (service: string) => `Plan de ${service}`,
    planHeadline: (plan: string, price: string) =>
      `Plan de limpieza, ${plan}: ${price}`,
    rhythm: (often: string, when: string) => `${often}, ${when}`,
    skipped: "Saltada",
    // a trabajo, as a Cleaner reads it
    assignmentState: {
      offered: "Ofrecido",
      confirmed: "Confirmado",
      released: "Lo dejó",
      taken_off: "Quitado",
    },
  },
});

// a Service Plan, or a Service Plan Quote, with its weekdays
type PlanDays = { recurrence: Recurrence; days: PlanDaySummary[] };

const screenWordsIn = (lang: Language) => {
  const w = words[lang];
  const l = labels[lang];
  const { formatClock, formatList, formatMoney, formatNumber } = formats[lang];
  const { weekdayName, weekdays } = formats[lang];
  const { planDaysWhen, recurrence } = messages[lang];
  const form = formWords[lang];
  const count = countIn(lang);

  const conditionLabel = Object.fromEntries(
    conditions[lang].map((c) => [c.value, c.label]),
  ) as Record<Condition, string>;

  // 4500 -> "4,500 sq ft"
  const formatFloorArea = (area: number) => w.sqFt(formatNumber(area));

  // how often a plan's cleans come round, as a label: "Every 2 weeks"
  const recurrenceLabel = Object.fromEntries(
    (Object.entries(recurrence) as [Recurrence, string][]).map(([r, often]) => [
      r,
      upperFirst(often),
    ]),
  ) as Record<Recurrence, string>;

  // "Monday", or a Draft's weekday that has no time yet
  const weekdayOfStart = (startsAt: string | null) =>
    startsAt ? weekdayName(dayOfInstant(startsAt)) : null;

  // what a Service Plan is, in a line: "Standard Clean, every 2 weeks", or
  // "Standard Clean and Deep Clean, every week on Mon, Wed and Fri"
  const planName = ({ recurrence: plan, days }: PlanDays) => {
    const what = formatList([...new Set(days.map((d) => d.serviceName))]);
    const on = days.flatMap(
      (d) => weekdayOfStart(d.startsAt)?.slice(0, 3) ?? [],
    );
    return days.length === 1
      ? `${what}, ${recurrence[plan]}`
      : w.everyWeekOn(what, on.length > 0 ? formatList(on) : "");
  };

  // a headline price with its unit: "$194.89", or a Service Plan's round,
  // given its weekdays, "$201.85 a clean", or for several "$650.10 a week"
  // (several weekdays are only ever weekly)
  const priceOf = (cents: number, planDays: number | null) =>
    planDays === null
      ? formatMoney(cents)
      : w.planPrice(formatMoney(cents), planDays > 1);

  // what a Quote is of: its Service, or a Service Plan of it, "Standard
  // Clean plan"
  const serviceNamed = (service: string, plan: boolean) =>
    plan ? w.planOf(service) : service;

  // a Service with its price, as every Office screen names an option or a
  // Quote's headline: "Standard Clean $194.89", or given a Service Plan's
  // weekdays, "Standard Clean plan $650.10 a week"
  const servicePrice = (
    service: string,
    cents: number,
    planDays: number | null = null,
  ) =>
    `${serviceNamed(service, planDays !== null)} ${priceOf(cents, planDays)}`;

  // a Quote's headline price, as priceOf says; null with no Revision
  const quoteTotal = (
    quote: Pick<QuoteSummary, "headlineTotalCents" | "plan">,
  ) =>
    quote.headlineTotalCents === null
      ? null
      : priceOf(quote.headlineTotalCents, quote.plan?.days.length ?? null);

  return {
    // "Tue, Oct 20" and "Oct 20" for an instant: New York's day
    dayOf: (iso: string) => formats[lang].formatDay(dayOfInstant(iso)),
    shortDayOf: (iso: string) =>
      formats[lang].formatShortDay(dayOfInstant(iso)),
    ...l,
    conditionLabel,
    // business premises have none until a Site Visit records it
    conditionText: (condition: Condition | null) =>
      condition ? conditionLabel[condition] : l.notKnownYet,
    // so many cleaners, e.g. "1 cleaner", "2 more cleaners", "3 free
    // cleaners"
    cleaners: (n: number, which?: "more" | "free") =>
      count(
        n,
        which === "more"
          ? w.moreCleaner
          : which === "free"
            ? w.freeCleaner
            : w.cleaner,
      ),
    formatFloorArea,
    // what a Property is: "Apartment · 2 bedrooms · 1.5 bathrooms"
    // ("Apartment · rooms not known yet" before they're given), or "Office ·
    // 4,500 sq ft" for business premises. `after` a part of a row's line,
    // a home's kind reads on from the dot ("Quote sent · apartment · …"); a
    // Premises Type's name, typed on the Price List as a Service's is, keeps
    // its capitals
    propertySummary: (p: PropertyView, after = false) =>
      p.kind === "commercial"
        ? lineOf([
            p.premisesType.name,
            p.floorArea === null
              ? w.floorAreaNotKnown
              : formatFloorArea(p.floorArea),
          ])
        : lineOf([
            after ? inLine(form[p.type]) : form[p.type],
            ...(p.bedrooms === null
              ? [w.roomsNotKnown]
              : [
                  p.bedrooms === 0 ? w.studio : count(p.bedrooms, w.bedroom),
                  count(p.bathrooms!, w.bathroom),
                ]),
          ]),
    // when a business wants cleaning: "Monday, Wednesday and Friday at 6:00
    // PM", or a one-off
    wantedCleaning: (request: {
      weekdays: Weekday[];
      preferredTime: string | null;
    }) => {
      if (request.weekdays.length === 0) return w.oneOff;
      // [0, 2, 4] -> "Monday, Wednesday and Friday"
      const days = formatList(request.weekdays.map((d) => weekdays[d]!));
      return request.preferredTime
        ? l.dayAt(days, formatClock(request.preferredTime))
        : days;
    },
    // what kind of Quote it is, as a title says it
    quoteKindName: (kind: QuoteKind | null) =>
      w.quoteKind[kind === "service_plan" ? "service_plan" : "one_off"],
    // a Quote's state as its Client sees it: one being drafted is still asked
    // for
    clientQuoteStatus: Object.fromEntries(
      (Object.keys(clientQuoteTone) as QuoteStatus[]).map((s) => [
        s,
        { tone: clientQuoteTone[s], label: w.clientQuoteStatus[s] },
      ]),
    ) as Record<QuoteStatus, { tone: StatusTone; label: string }>,
    // a Service Plan's state, as both sides see it; Ended is red, stopped
    // for good
    planStatus: Object.fromEntries(
      (Object.keys(planTone) as ServicePlanStatus[]).map((s) => [
        s,
        { tone: planTone[s], label: w.planStatus[s] },
      ]),
    ) as Record<ServicePlanStatus, { tone: StatusTone; label: string }>,
    recurrenceLabel,
    planName,
    quoteTotal,
    servicePrice,
    serviceNamed,
    // what a Sent Revision led with, as servicePrice says
    revisionHeadline: (
      revision: Pick<
        RevisionSummary,
        "headlineTotalCents" | "headlineServiceName" | "planDays"
      >,
    ) =>
      servicePrice(
        revision.headlineServiceName,
        revision.headlineTotalCents,
        revision.planDays,
      ),
    // how a Quote reads in a list: "Standard Clean $194.89", the Service it
    // leads with, or "Cleaning plan, Standard Clean, every 2 weeks: $201.85
    // a clean", or for several weekdays "...: $650.10 a week"
    quoteHeadline: (
      quote: Pick<
        QuoteSummary,
        "headlineTotalCents" | "headlineServiceName" | "plan"
      >,
    ) =>
      quote.headlineTotalCents === null
        ? w.notPriced
        : quote.plan
          ? w.planHeadline(planName(quote.plan), quoteTotal(quote)!)
          : servicePrice(quote.headlineServiceName!, quote.headlineTotalCents),
    // when a Service Plan's cleans come round, each weekday from its first:
    // "Every week, on Mondays at 9:00 AM", or "Every week, on Mondays at
    // 9:00 AM and Wednesdays at 1:00 PM"
    planRhythm: ({ recurrence: plan, days }: PlanDays) =>
      w.rhythm(
        recurrenceLabel[plan],
        planDaysWhen(days.flatMap((d) => d.startsAt ?? [])),
      ),
    jobStatusLabel: l.jobStatus,
    assignmentStateLabel: w.assignmentState,
    cancelledLabel: (skipped: boolean) =>
      skipped ? w.skipped : l.jobStatus.cancelled,
  };
};

const clientQuoteTone: Record<QuoteStatus, StatusTone> = {
  requested: "info",
  draft: "info",
  sent: "warning",
  accepted: "success",
  declined: "neutral",
  expired: "neutral",
  turned_down: "neutral",
};

// the paused ones of a Client's cleaning plans, or of a Bill's (each with
// Jobs on it, paused while it's Unpaid), as the server says
export const pausedPlans = <P extends { status: ServicePlanStatus }>(
  plans: P[],
) => plans.filter((p) => p.status === "on_hold");

const planTone: Record<ServicePlanStatus, StatusTone> = {
  active: "success",
  on_hold: "warning",
  ended: "danger",
};

export const screenWords = {
  en: screenWordsIn("en"),
  es: screenWordsIn("es"),
};

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
  ServicePlanStatus,
  Weekday,
} from "@empire-cleaning/models";
import type { Time } from "@internationalized/date";
import {
  catalog,
  clockTime,
  dayOf,
  formats,
  type Language,
  messages,
  timeOf,
} from "@empire-cleaning/models";
import { conditions, formWords } from "@empire-cleaning/quote-request";
import type { StatusTone } from "@empire-cleaning/ui";

export const addressOf = (
  p: Pick<PropertyView, "street" | "unit" | "postcode">,
) => [p.street, p.unit, p.postcode].filter(Boolean).join(", ");

// a Job's crew, or that it has none yet
export const crewOf = (crew: { name: string }[]) =>
  crew.map((c) => c.name).join(", ") || "No cleaners yet";

// "2 bedrooms", "1 bathroom", for the Office
const count = (n: number, one: string) =>
  `${n} ${formats.en.plural(n, { one, other: `${one}s` })}`;

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

// 3.75 -> "3.75 h", 4 -> "4 h"
export const formatHours = (hours: number) => `${hours} h`;

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

export const quoteStatusTone = {
  requested: "warning",
  draft: "neutral",
  sent: "info",
  accepted: "info",
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

// words that start a sentence or a label: "the Deep Clean" -> "The Deep
// Clean"
export const upperFirst = (words: string) =>
  words.charAt(0).toUpperCase() + words.slice(1);

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
  cancellation: { by: string; withPlan: boolean } | null;
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
// whether its crew is whole (JobBadge, the Schedule's blocks)
export const jobLabelOf = (job: {
  status: JobStatus;
  assignment: AssignmentStatus;
}) =>
  job.status === "booked"
    ? { label: crewLabel[job.assignment], tone: crewTone[job.assignment] }
    : {
        label: screenWords.en.jobStatusLabel[job.status],
        tone: jobStatusTone[job.status],
      };

// where someone stands on a Job's crew
export const assignmentStateLabel: Record<AssignmentState, string> = {
  offered: "Offered",
  confirmed: "Confirmed",
  released: "Dropped out",
  taken_off: "Taken off",
};

export const assignmentStateTone = {
  offered: "warning",
  confirmed: "success",
  released: "neutral",
  taken_off: "neutral",
} as const satisfies Record<AssignmentState, string>;

// Words several screens show as they are, each once (docs/ux.md, Words):
// part of `screenWords` below. A word only portal screens share is
// portal/words.ts's.
const labels = catalog({
  en: {
    notKnownYet: "Not known yet",
    unpaid: "Unpaid",
    pickNewTime: "Pick a new time",
    signIn: "Sign in",
    signOut: "Sign out",
    welcome: "Welcome",
    email: "Email",
    day: "Day",
    dayAt: (when: string, time: string) => `${when} at ${time}`,
    condition: "Condition",
    notAdded: "Not added yet",
    onSite: "On site",
    about: (hours: string) => `About ${hours}`,
    onSiteWith: (cleaners: string) => `On site, ${cleaners}`,
    extras: "Extras",
    none: "None",
    deposit: "Deposit",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, tax included`,
    payBill: (n: string) => `Pay bill ${n}`,
    // a bank payment, or a Bill paid by one, on its way
    clearing: "Clearing",
  },
  es: {
    notKnownYet: "Aún no se sabe",
    unpaid: "Sin pagar",
    pickNewTime: "Elegir otra hora",
    signIn: "Iniciar sesión",
    signOut: "Cerrar sesión",
    welcome: "Bienvenido",
    email: "Correo electrónico",
    day: "Día",
    dayAt: (when: string, time: string) =>
      `${when} ${time.startsWith("1:") ? "a la" : "a las"} ${time}`,
    condition: "Estado",
    notAdded: "Aún no se agregó",
    onSite: "En el lugar",
    about: (hours: string) => `Unas ${hours}`,
    onSiteWith: (cleaners: string) => `En el lugar, ${cleaners}`,
    extras: "Adicionales",
    none: "Ninguno",
    deposit: "Depósito",
    total: "Total",
    taxIncludedOf: (what: string) => `${what}, impuestos incluidos`,
    payBill: (n: string) => `Pagar la factura ${n}`,
    clearing: "En proceso",
  },
});

// The screens' words for things, in each language (ADR-0025):
// `screenWords[lang]`, as models' `formats[lang]`; the Office's screens take
// `screenWords.en`. A literal here is in `words` or `labels`, in both
// languages.
const words = catalog({
  en: {
    cleaner: { one: "cleaner", other: "cleaners" },
    moreCleaner: { one: "more cleaner", other: "more cleaners" },
    freeCleaner: { one: "free cleaner", other: "free cleaners" },
    sqFt: (area: string) => `${area} sq ft`,
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
      sent: "To answer",
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
    planHeadline: (plan: string, price: string, perWeek: boolean) =>
      `Cleaning plan, ${plan}: ${price} ${perWeek ? "a week" : "a clean"}`,
    rhythm: (often: string, when: string) => `${often}, on ${when}`,
    jobStatus: {
      booked: "Booked",
      completed: "Done",
      cancelled: "Cancelled",
      no_access: "Couldn't get in",
    } satisfies Record<JobStatus, string>,
    skipped: "Skipped",
  },
  es: {
    cleaner: { one: "limpiador", other: "limpiadores" },
    moreCleaner: { one: "limpiador más", other: "limpiadores más" },
    freeCleaner: { one: "limpiador libre", other: "limpiadores libres" },
    sqFt: (area: string) => `${area} pies²`,
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
      sent: "Por responder",
      accepted: "Aceptada",
      declined: "Rechazada",
      expired: "Vencida",
      turned_down: "Descartada",
    },
    planStatus: { active: "Activo", on_hold: "En pausa", ended: "Finalizado" },
    everyWeekOn: (what: string, days: string) =>
      `${what}, cada semana${days ? ` los ${days}` : ""}`,
    notPriced: "Aún sin precio",
    planHeadline: (plan: string, price: string, perWeek: boolean) =>
      `Plan de limpieza, ${plan}: ${price} ${perWeek ? "por semana" : "por limpieza"}`,
    rhythm: (often: string, when: string) => `${often}, ${when}`,
    jobStatus: {
      booked: "Reservada",
      completed: "Terminada",
      cancelled: "Cancelada",
      no_access: "No se pudo entrar",
    },
    skipped: "Saltada",
  },
});

// a Service Plan, or a Service Plan Quote, with its weekdays
type PlanDays = { recurrence: Recurrence; days: PlanDaySummary[] };

const screenWordsIn = (lang: Language) => {
  const w = words[lang];
  const l = labels[lang];
  const { formatClock, formatList, formatMoney, formatNumber, plural } =
    formats[lang];
  const { weekdayName, weekdays } = formats[lang];
  const { planDaysWhen, recurrence } = messages[lang];
  const form = formWords[lang];
  // "2 bedrooms", "1 baño"
  const count = (n: number, forms: { one: string; other: string }) =>
    `${n} ${plural(n, forms)}`;

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
    // 4,500 sq ft" for business premises
    propertySummary: (p: PropertyView) =>
      p.kind === "commercial"
        ? [
            p.premisesType.name,
            p.floorArea === null
              ? w.floorAreaNotKnown
              : formatFloorArea(p.floorArea),
          ].join(" · ")
        : [
            form[p.type],
            ...(p.bedrooms === null
              ? [w.roomsNotKnown]
              : [
                  p.bedrooms === 0 ? w.studio : count(p.bedrooms, w.bedroom),
                  count(p.bathrooms!, w.bathroom),
                ]),
          ].join(" · "),
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
    // how a Quote reads in a list: "Deep Clean $391.04", the Service it
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
          ? w.planHeadline(
              planName(quote.plan),
              formatMoney(quote.headlineTotalCents),
              quote.plan.days.length > 1,
            )
          : `${quote.headlineServiceName} ${formatMoney(quote.headlineTotalCents)}`,
    // when a Service Plan's cleans come round, each weekday from its first:
    // "Every week, on Mondays at 9:00 AM", or "Every week, on Mondays at
    // 9:00 AM and Wednesdays at 1:00 PM"
    planRhythm: ({ recurrence: plan, days }: PlanDays) =>
      w.rhythm(
        recurrenceLabel[plan],
        planDaysWhen(days.flatMap((d) => d.startsAt ?? [])),
      ),
    jobStatusLabel: w.jobStatus,
    cancelledLabel: (skipped: boolean) =>
      skipped ? w.skipped : w.jobStatus.cancelled,
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

const planTone: Record<ServicePlanStatus, StatusTone> = {
  active: "success",
  on_hold: "warning",
  ended: "danger",
};

export const screenWords = {
  en: screenWordsIn("en"),
  es: screenWordsIn("es"),
};

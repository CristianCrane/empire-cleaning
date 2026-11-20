// PROTOTYPE: throwaway (#493, H1-H5). Where things live in the Client portal:
// the menu, the phone's top bar and the breadcrumbs, over the screens a
// Client reaches, in three layouts for where a cleaning plan (and a Quote)
// lives. Signed out, made-up data; every screen's insides are placeholders.
// ←/→ steps the cases, ↑/↓ the layouts. Lives only on prototype-* branches.
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  DoorOpen,
  House,
  KeyRound,
  Languages,
  MapPin,
  Phone,
  Repeat,
  Ruler,
  Sparkles,
  User,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { formats, type Language, LANGUAGES } from "@empire-cleaning/models";
import {
  AnswerCard,
  AppLayout,
  Button,
  ButtonLink,
  Card,
  DatedItem,
  DateTile,
  DetailsCard,
  EmptyState,
  Fact,
  Facts,
  Heading,
  HomePage,
  IconTile,
  LanguageName,
  Link,
  List,
  ListItem,
  MenuButton,
  MenuItem,
  MenuSeparator,
  Notice,
  Section,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type HomeTile,
  type NavItem,
} from "@empire-cleaning/ui";
import type { AppHref } from "../../links.ts";
import { setAppLanguage } from "../../language.ts";
import { QuoteIcon } from "../icons.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { portalWords } from "./words.ts";
import { areaLabels } from "../../session.ts";

// ---------------------------------------------------------------- search

const CASES = [
  { key: "plan", name: "one home, a plan" },
  { key: "quote", name: "one home, a quote waiting" },
  { key: "two-homes", name: "two homes, one with a plan" },
  { key: "new", name: "nothing booked yet" },
] as const;
const LAYOUTS = [
  { key: "a", name: "the plan heads Cleans" },
  { key: "b", name: "a Your plan menu item" },
  { key: "c", name: "under the home, given a place" },
] as const;
const PAGES = [
  "home",
  "request",
  "quote",
  "cleans",
  "clean",
  "plan",
  "payments",
  "bill",
  "card",
  "details",
  "property",
] as const;

type CaseId = (typeof CASES)[number]["key"];
type LayoutId = (typeof LAYOUTS)[number]["key"];
type PageId = (typeof PAGES)[number];

export type PortalHomesSearch = {
  case: CaseId;
  layout: LayoutId;
  page: PageId;
  id?: string;
  lang: Language;
};

const oneOf = <T extends string>(all: readonly T[], v: unknown, d: T): T =>
  all.includes(v as T) ? (v as T) : d;

export const portalHomesSearch = (
  s: Record<string, unknown>,
): PortalHomesSearch => ({
  case: oneOf(
    CASES.map((c) => c.key),
    s.case,
    "plan",
  ),
  layout: oneOf(
    LAYOUTS.map((l) => l.key),
    s.layout,
    "a",
  ),
  page: oneOf(PAGES, s.page, "home"),
  id: typeof s.id === "string" ? s.id : undefined,
  lang: oneOf(LANGUAGES, s.lang, "en"),
});

export const portalHomesBeforeLoad = ({
  search,
  preload,
}: {
  search: PortalHomesSearch;
  preload: boolean;
}) => {
  if (!preload) setAppLanguage(search.lang);
};

// ---------------------------------------------------------------- data

type Home = {
  id: string;
  street: string;
  line: string;
  kind: "apartment" | "house";
  rooms: string;
  access: string;
};
type Plan = { id: string; homeId: string; firstClean: string };
type Clean = {
  id: string;
  at: string;
  service: string;
  homeId: string;
  plan: boolean;
  done?: boolean;
  price: number;
  quoteId?: string;
};
type Quote = {
  id: string;
  homeId: string;
  kind: "clean" | "plan";
  waiting: boolean;
  for: string;
  cleanId?: string;
};
type Case = {
  homes: Home[];
  plan?: Plan;
  cleans: Clean[];
  quotes: Quote[];
  card: boolean;
  bill: boolean;
};

const austin: Home = {
  id: "p1",
  street: "41-12 Austin St, 4B",
  line: "Forest Hills, 11375",
  kind: "apartment",
  rooms: "2",
  access: "Ring 4B; the doorman has a key.",
};
const elm: Home = {
  id: "p2",
  street: "88-10 Elm Ave",
  line: "Kew Gardens, 11415",
  kind: "house",
  rooms: "3",
  access: "Key under the blue pot by the back door.",
};

const at = (day: string) => `2026-${day}T14:00:00.000Z`; // 9:00 AM New York
const planCleans = (homeId: string): Clean[] =>
  ["01-19", "01-26", "02-02", "02-09", "02-16"].map((d, i) => ({
    id: `c${i + 1}`,
    at: at(d),
    service: "Standard Clean",
    homeId,
    plan: true,
    price: 20185,
  }));
const firstClean: Clean = {
  id: "c0",
  at: at("01-12"),
  service: "Deep Clean",
  homeId: "p1",
  plan: false,
  done: true,
  price: 35929,
  quoteId: "q1",
};

const cases: Record<CaseId, Case> = {
  plan: {
    homes: [austin],
    plan: { id: "plan1", homeId: "p1", firstClean: at("01-19") },
    cleans: [firstClean, ...planCleans("p1")],
    quotes: [
      {
        id: "q2",
        homeId: "p1",
        kind: "plan",
        waiting: false,
        for: at("01-19"),
      },
      {
        id: "q1",
        homeId: "p1",
        kind: "clean",
        waiting: false,
        for: at("01-12"),
        cleanId: "c0",
      },
    ],
    card: true,
    bill: true,
  },
  quote: {
    homes: [austin],
    cleans: [],
    quotes: [
      {
        id: "q3",
        homeId: "p1",
        kind: "clean",
        waiting: true,
        for: at("01-19"),
      },
    ],
    card: false,
    bill: false,
  },
  "two-homes": {
    homes: [austin, elm],
    plan: { id: "plan1", homeId: "p1", firstClean: at("01-19") },
    cleans: [
      firstClean,
      ...planCleans("p1").slice(0, 1),
      {
        id: "c9",
        at: at("01-22"),
        service: "Deep Clean",
        homeId: "p2",
        plan: false,
        price: 41250,
        quoteId: "q4",
      },
      ...planCleans("p1").slice(1),
    ],
    quotes: [
      {
        id: "q2",
        homeId: "p1",
        kind: "plan",
        waiting: false,
        for: at("01-19"),
      },
      {
        id: "q4",
        homeId: "p2",
        kind: "clean",
        waiting: false,
        for: at("01-22"),
        cleanId: "c9",
      },
      {
        id: "q1",
        homeId: "p1",
        kind: "clean",
        waiting: false,
        for: at("01-12"),
        cleanId: "c0",
      },
    ],
    card: true,
    bill: true,
  },
  new: { homes: [austin], cleans: [], quotes: [], card: false, bill: false },
};

// ---------------------------------------------------------------- words

const words = {
  en: {
    yourPlan: "Your plan",
    yourHome: "Your home",
    yourHomes: "Your homes",
    nextClean: "Next clean",
    partOfPlan: "Part of your",
    cleaningPlanLower: "cleaning plan",
    seeTheClean: "See the clean",
    requestAQuote: "Request a quote",
    waitingForYou: "Waiting for you",
    quoteReady: "Your quote is ready",
    quoteFor: (when: string) => `Deep Clean or Standard Clean, ${when}`,
    nothingYet: "Nothing booked yet",
    askLine: "Ask for a quote. We send one within a day.",
    howWeGetIn: "How we get in",
    callUs: "Call us",
    moveOrSkip: "Move or skip",
    yourDayClean: (d: string) => `Your ${d} clean`,
    noCard: "No card yet",
    visa: "Visa ending 4242",
    upcoming: "Upcoming",
    past: "Past",
    noneUpcoming: "Nothing coming up.",
    nonePast: "Nothing yet.",
    everyWeek: "Every week",
    mondays: "Mondays at 9:00 AM",
    aClean: "a clean",
    save: "Save $22.43 a clean",
    seePlan: "See plan",
    firstClean: "First clean",
    howLong: "How long",
    about4: "About 4 hours",
    price: "Price",
    where: "Where",
    planCleans: "Next cleans",
    allInCleans: "Every clean is in Cleans",
    startedFrom: "Agreed in",
    yourQuoteOf: (d: string) => `your quote of ${d}`,
    actions: "Actions",
    askChange: "Ask for a change",
    endPlan: "End plan",
    quoteTitleClean: (d: string) => `A clean on ${d}`,
    quoteTitlePlan: "A cleaning plan, every week",
    accepted: "Accepted",
    youreBooked: "You're booked.",
    youreOnPlan: "Your plan is running.",
    pickOne: "Pick one",
    recommended: "Recommended",
    acceptAndPay: "Accept and pay $74.85",
    openUntil: "Open until Sun, Jan 18",
    decline: "Decline",
    placeholder: "The screen's own content, as today.",
    step1: "What can we help with?",
    services: ["Standard Clean", "Deep Clean", "Move-in/out Clean"],
    nothingOwed: "Nothing owed",
    payments: "Payments",
    lastPayments: "Last payments",
    paidOn: (d: string) => `Paid ${d}`,
    weekOf: (d: string) => `Week of ${d}`,
    billNo: "Bill EC-000001",
    paid: "Paid",
    total: "Total",
    addACard: "Add a card",
    cardForm: "The card form, as today.",
    contact: "Contact details",
    contactLine: "Casey Client · casey@example.com · (646) 555-0100",
    edit: "Edit",
    kind: { apartment: "Apartment", house: "House" },
    bedrooms: (n: string) => `${n} bedrooms`,
    cleaningPlan: "Cleaning plan",
    noPlan: "Money off every clean, on a plan.",
    quotes: "Quotes",
    moveOrCancel: "Move or cancel",
    oneOff: "One clean",
    crumbs: "Breadcrumbs",
    homeOf: (street: string) => `at ${street}`,
    yourQuote: "Your quote",
    planHere: "Cleaning plan here",
  },
  es: {
    yourPlan: "Su plan",
    yourHome: "Su casa",
    yourHomes: "Sus casas",
    nextClean: "Próxima limpieza",
    partOfPlan: "Parte de su",
    cleaningPlanLower: "plan de limpieza",
    seeTheClean: "Ver la limpieza",
    requestAQuote: "Pedir una cotización",
    waitingForYou: "Le espera",
    quoteReady: "Su cotización está lista",
    quoteFor: (when: string) => `Limpieza profunda o estándar, ${when}`,
    nothingYet: "Nada reservado todavía",
    askLine: "Pida una cotización. Le enviamos una en un día.",
    howWeGetIn: "Cómo entramos",
    callUs: "Llámenos",
    moveOrSkip: "Reprogramar o saltar",
    yourDayClean: (d: string) => `Su limpieza del ${d}`,
    noCard: "Sin tarjeta todavía",
    visa: "Visa que termina en 4242",
    upcoming: "Próximas",
    past: "Pasadas",
    noneUpcoming: "Nada próximo.",
    nonePast: "Nada todavía.",
    everyWeek: "Cada semana",
    mondays: "Los lunes a las 9:00 a.m.",
    aClean: "por limpieza",
    save: "Ahorre $22.43 por limpieza",
    seePlan: "Ver plan",
    firstClean: "Primera limpieza",
    howLong: "Cuánto dura",
    about4: "Cerca de 4 horas",
    price: "Precio",
    where: "Dónde",
    planCleans: "Próximas limpiezas",
    allInCleans: "Todas las limpiezas están en Limpiezas",
    startedFrom: "Acordado en",
    yourQuoteOf: (d: string) => `su cotización del ${d}`,
    actions: "Acciones",
    askChange: "Pedir un cambio",
    endPlan: "Terminar el plan",
    quoteTitleClean: (d: string) => `Una limpieza el ${d}`,
    quoteTitlePlan: "Un plan de limpieza, cada semana",
    accepted: "Aceptada",
    youreBooked: "Está reservada.",
    youreOnPlan: "Su plan está en marcha.",
    pickOne: "Elija una",
    recommended: "Recomendada",
    acceptAndPay: "Aceptar y pagar $74.85",
    openUntil: "Abierta hasta el dom, 18 de ene",
    decline: "Rechazar",
    placeholder: "El contenido de la pantalla, como hoy.",
    step1: "¿En qué le podemos ayudar?",
    services: ["Limpieza estándar", "Limpieza profunda", "Limpieza de mudanza"],
    nothingOwed: "No debe nada",
    payments: "Pagos",
    lastPayments: "Últimos pagos",
    paidOn: (d: string) => `Pagado el ${d}`,
    weekOf: (d: string) => `Semana del ${d}`,
    billNo: "Factura EC-000001",
    paid: "Pagada",
    total: "Total",
    addACard: "Agregar una tarjeta",
    cardForm: "El formulario de la tarjeta, como hoy.",
    contact: "Datos de contacto",
    contactLine: "Casey Client · casey@example.com · (646) 555-0100",
    edit: "Editar",
    kind: { apartment: "Apartamento", house: "Casa" },
    bedrooms: (n: string) => `${n} dormitorios`,
    cleaningPlan: "Plan de limpieza",
    noPlan: "Un descuento en cada limpieza, con un plan.",
    quotes: "Cotizaciones",
    moveOrCancel: "Reprogramar o cancelar",
    oneOff: "Una limpieza",
    crumbs: "Ruta",
    homeOf: (street: string) => `en ${street}`,
    yourQuote: "Su cotización",
    planHere: "Plan de limpieza aquí",
  },
};

// ---------------------------------------------------------------- frame

type Section = "home" | "cleans" | "plan" | "payments" | "details";

// what each layout answers: where the plan, a Quote and a home live
const homeOf: Record<LayoutId, Record<PageId, Section>> = {
  a: {
    home: "home",
    request: "cleans",
    quote: "cleans",
    cleans: "cleans",
    clean: "cleans",
    plan: "cleans",
    payments: "payments",
    bill: "payments",
    card: "payments",
    details: "details",
    property: "details",
  },
  b: {
    home: "home",
    request: "home",
    quote: "home",
    cleans: "cleans",
    clean: "cleans",
    plan: "plan",
    payments: "payments",
    bill: "payments",
    card: "payments",
    details: "details",
    property: "details",
  },
  c: {
    home: "home",
    request: "details",
    quote: "details",
    cleans: "cleans",
    clean: "cleans",
    plan: "details",
    payments: "payments",
    bill: "payments",
    card: "payments",
    details: "details",
    property: "details",
  },
};

type Ctx = {
  s: PortalHomesSearch;
  c: Case;
  lang: Language;
  w: (typeof words)["en"];
  p: (typeof portalWords)["en"];
  f: (typeof formats)["en"];
  go: (to: Partial<PortalHomesSearch>) => AppHref;
  nav: (to: Partial<PortalHomesSearch>) => void;
};

type Crumb = { label: string; href: AppHref };

export function PortalHomesPrototype({
  search: s,
}: {
  search: PortalHomesSearch;
}) {
  const navigate = useNavigate();
  const lang = s.lang;
  const c = cases[s.case];
  const go = (to: Partial<PortalHomesSearch>): AppHref =>
    ({
      to: "/prototype/portal-homes",
      search: { ...s, id: undefined, ...to },
    }) as unknown as AppHref;
  const t: Ctx = {
    s,
    c,
    lang,
    w: words[lang],
    p: portalWords[lang],
    f: formats[lang],
    go,
    nav: (to) => void navigate(go(to) as never),
  };
  // a page this case doesn't have (the plan, with none) is Home
  const page: PageId =
    (s.page === "plan" && !c.plan) ||
    (s.page === "bill" && !c.bill) ||
    (s.page === "quote" && !c.quotes.some((q) => q.id === s.id)) ||
    (s.page === "clean" && !c.cleans.some((x) => x.id === s.id))
      ? "home"
      : s.page;
  const current = homeOf[s.layout][page];
  const homesLabel = c.homes.length > 1 ? t.w.yourHomes : t.w.yourHome;

  const items: (NavItem & { section: Section })[] = [
    {
      section: "home",
      href: go({ page: "home" }),
      label: t.p.home,
      icon: House,
    },
    {
      section: "cleans",
      href: go({ page: "cleans" }),
      label: t.p.cleans,
      icon: Sparkles,
    },
    ...(s.layout === "b" && c.plan
      ? [
          {
            section: "plan" as const,
            href: go({ page: "plan" }),
            label: t.w.yourPlan,
            icon: Repeat,
          },
        ]
      : []),
    {
      section: "payments",
      href: go({ page: "payments" }),
      label: t.p.payments,
      icon: Wallet,
    },
    {
      section: "details",
      href: go({ page: "details" }),
      label: s.layout === "c" ? homesLabel : t.p.yourDetails,
      icon: s.layout === "c" ? DoorOpen : UserRound,
    },
  ];
  const nav: NavItem[] = items.map(({ section, ...item }) => ({
    ...item,
    isCurrent: section === current,
  }));
  const other = LANGUAGES.find((l) => l !== lang)!;

  return (
    <>
      <AppLayout
        area={areaLabels[lang].portal}
        nav={nav}
        foot={() => (
          <>
            <div className="flex items-center gap-3 px-3">
              <User aria-hidden size={20} className="shrink-0 text-fg-muted" />
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold">Casey Client</span>
                <span className="truncate text-sm text-fg-muted">
                  casey@example.com
                </span>
              </div>
            </div>
            <ButtonLink
              variant="quiet"
              className="justify-start"
              href={go({ page, id: s.id, lang: other })}
            >
              <Languages aria-hidden size={20} />
              <LanguageName language={other} />
            </ButtonLink>
          </>
        )}
      >
        <Page t={t} page={page} />
      </AppLayout>
      <PrototypeSwitcher
        variants={CASES.map((x) => ({ ...x }))}
        current={s.case}
        onChange={(key) => t.nav({ case: key as CaseId, page, id: s.id })}
      />
      <PrototypeSwitcher
        variants={LAYOUTS.map((x) => ({ ...x }))}
        current={s.layout}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
        onChange={(key) => t.nav({ layout: key as LayoutId, page, id: s.id })}
      />
    </>
  );
}

// the steps above this page, each a link; the page itself is the title, so
// no title says its last crumb again
function Header({
  crumbs = [],
  title,
  inBar = false,
  status,
  subtitle,
  actions,
  label,
}: {
  crumbs?: Crumb[];
  title: string;
  inBar?: boolean;
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  label: string;
}) {
  return (
    <header
      className={`flex flex-col gap-2 ${inBar && !crumbs.length && !actions ? "max-md:sr-only" : ""}`}
    >
      {crumbs.length > 0 && (
        <nav aria-label={label}>
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-1">
                <Link
                  href={c.href}
                  className="text-fg-muted no-underline hover:text-fg hover:underline"
                >
                  {c.label}
                </Link>
                <ChevronRight aria-hidden size={14} className="text-fg-muted" />
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* PROTOTYPE: the header is what's tried here (crumbs that stop
                above the page), so it isn't PageHeader's */}
            {/* eslint-disable-next-line empire/screen-layout */}
            <Heading level={1} inBar={inBar}>
              {title}
            </Heading>
            {status}
          </div>
          {subtitle && <p className="text-lg text-fg-muted">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

// the crumbs of a page that lives under a home, in layout c: the section,
// then the home when there's more than one (with one, the section is it)
function homeCrumbs(t: Ctx, homeId: string): Crumb[] {
  const home = t.c.homes.find((h) => h.id === homeId)!;
  const section = {
    label: t.c.homes.length > 1 ? t.w.yourHomes : t.w.yourHome,
    href: t.go({ page: "details" }),
  };
  return t.c.homes.length > 1
    ? [
        section,
        { label: home.street, href: t.go({ page: "property", id: homeId }) },
      ]
    : [section];
}

// where a Quote (and asking for one) lives, by layout
function quoteCrumbs(t: Ctx, homeId: string): Crumb[] {
  if (t.s.layout === "a")
    return [{ label: t.p.cleans, href: t.go({ page: "cleans" }) }];
  if (t.s.layout === "b")
    return [{ label: t.p.home, href: t.go({ page: "home" }) }];
  return homeCrumbs(t, homeId);
}

function Page({ t, page }: { t: Ctx; page: PageId }) {
  switch (page) {
    case "home":
      return <HomeScreen t={t} />;
    case "request":
      return <RequestScreen t={t} />;
    case "quote":
      return <QuoteScreen t={t} />;
    case "cleans":
      return <CleansScreen t={t} />;
    case "clean":
      return <CleanScreen t={t} />;
    case "plan":
      return <PlanScreen t={t} />;
    case "payments":
      return <PaymentsScreen t={t} />;
    case "bill":
      return <BillScreen t={t} />;
    case "card":
      return <CardScreen t={t} />;
    case "details":
      return t.s.layout === "c" && t.c.homes.length === 1 ? (
        <HomePlace t={t} homeId={t.c.homes[0]!.id} />
      ) : (
        <DetailsScreen t={t} />
      );
    case "property":
      return t.s.layout === "c" ? (
        <HomePlace t={t} homeId={t.s.id ?? "p1"} />
      ) : (
        <PropertyScreen t={t} />
      );
  }
}

const serviceName = (t: Ctx, name: string) =>
  name === "Deep Clean" ? t.w.services[1]! : t.w.services[0]!;
const upcomingOf = (c: Case) => c.cleans.filter((x) => !x.done);
const homeName = (t: Ctx, homeId: string) =>
  t.c.homes.find((h) => h.id === homeId)!.street;

// ---------------------------------------------------------------- screens

function HomeScreen({ t }: { t: Ctx }) {
  const [open, setOpen] = useState<string | null>(null);
  const next = upcomingOf(t.c)[0];
  const quote = t.c.quotes.find((q) => q.waiting);
  const many = t.c.homes.length > 1;
  const tiles: HomeTile[] = [];
  if (next)
    tiles.push({
      id: "move",
      icon: CalendarCheck,
      label: next.plan ? t.w.moveOrSkip : t.w.moveOrCancel,
      hint: t.w.yourDayClean(t.f.formatShortDay(next.at.slice(0, 10))),
      href: t.go({ page: "clean", id: next.id }),
    });
  tiles.push({
    id: "access",
    icon: KeyRound,
    label: t.w.howWeGetIn,
    hint: austin.access,
    href: t.go({ page: "property", id: "p1" }),
  });
  if (t.c.card)
    tiles.push({
      id: "card",
      icon: CreditCard,
      label: t.p.yourCard,
      hint: t.w.visa,
      href: t.go({ page: "card" }),
    });
  tiles.push({
    id: "call",
    icon: Phone,
    label: t.w.callUs,
    hint: "(646) 320-9076",
    externalHref: "tel:+16463209076",
  });

  const answer = next ? (
    <AnswerCard
      tile={<DateTile date={next.at} />}
      label={t.w.nextClean}
      headline={t.f.formatTime(next.at)}
      lines={[
        <>
          {serviceName(t, next.service)}
          {many && ` ${t.w.homeOf(homeName(t, next.homeId))}`}
          {next.plan && (
            <>
              {" · "}
              {t.w.partOfPlan}{" "}
              <Link href={t.go({ page: "plan" })}>{t.w.cleaningPlanLower}</Link>
            </>
          )}
        </>,
      ]}
      actions={
        <ButtonLink
          variant="primary"
          href={t.go({ page: "clean", id: next.id })}
        >
          {t.w.seeTheClean}
        </ButtonLink>
      }
    />
  ) : quote ? (
    <AnswerCard
      tile={<IconTile icon={QuoteIcon} tone="warning" size="lg" />}
      label={t.w.waitingForYou}
      headline={t.w.quoteReady}
      lines={[t.w.quoteFor(t.f.formatShortDay(quote.for.slice(0, 10)))]}
      actions={
        <ButtonLink
          variant="primary"
          href={t.go({ page: "quote", id: quote.id })}
        >
          {t.p.seeYourQuote}
        </ButtonLink>
      }
    />
  ) : (
    <AnswerCard
      tile={<IconTile icon={CalendarCheck} size="lg" />}
      headline={t.w.nothingYet}
      lines={[t.w.askLine]}
      actions={
        <ButtonLink variant="primary" href={t.go({ page: "request" })}>
          {t.w.requestAQuote}
        </ButtonLink>
      }
    />
  );

  return (
    <HomePage
      greet="Casey Client"
      actions={
        next || quote
          ? [
              {
                label: t.w.requestAQuote,
                icon: QuoteIcon,
                href: t.go({ page: "request" }),
              },
            ]
          : []
      }
      answer={answer}
      tilesLabel="Shortcuts"
      tiles={tiles}
      open={open}
      onOpen={setOpen}
    />
  );
}

function RequestScreen({ t }: { t: Ctx }) {
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={quoteCrumbs(t, "p1")}
        title={t.w.requestAQuote}
      />
      <Card>
        <Heading level={2} size={4}>
          {t.w.step1}
        </Heading>
        <div className="flex flex-wrap gap-2">
          {t.w.services.map((name) => (
            <Button key={name} variant="secondary">
              <Sparkles aria-hidden size={18} />
              {name}
            </Button>
          ))}
        </div>
        <p className="text-sm text-fg-muted">{t.w.placeholder}</p>
      </Card>
    </div>
  );
}

function QuoteScreen({ t }: { t: Ctx }) {
  const q = t.c.quotes.find((x) => x.id === t.s.id)!;
  const day = t.f.formatDay(q.for.slice(0, 10));
  const title =
    q.kind === "plan" ? t.w.quoteTitlePlan : t.w.quoteTitleClean(day);
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={quoteCrumbs(t, q.homeId)}
        title={title}
        status={
          q.waiting ? (
            <StatusBadge tone="warning">{t.w.waitingForYou}</StatusBadge>
          ) : (
            <StatusBadge tone="success">{t.w.accepted}</StatusBadge>
          )
        }
        subtitle={t.c.homes.length > 1 ? homeName(t, q.homeId) : undefined}
      />
      {!q.waiting && (
        <Notice
          tone="success"
          action={
            q.kind === "plan" ? (
              <ButtonLink variant="text" href={t.go({ page: "plan" })}>
                {t.p.seeYourPlan}
              </ButtonLink>
            ) : (
              <ButtonLink
                variant="text"
                href={t.go({ page: "clean", id: q.cleanId })}
              >
                {t.w.seeTheClean}
              </ButtonLink>
            )
          }
        >
          {q.kind === "plan" ? t.w.youreOnPlan : t.w.youreBooked}
        </Notice>
      )}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xl font-semibold">{t.w.services[1]}</span>
            <span className="text-3xl font-bold">$299.41</span>
          </div>
          <span className="self-start">
            <StatusBadge tone="success">{t.w.recommended}</StatusBadge>
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-fg-muted">
            <span>{t.w.services[0]}</span>
            <span className="font-semibold">$224.28</span>
          </div>
        </div>
        <p className="text-sm text-fg-muted">{t.w.placeholder}</p>
        {q.waiting && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">{t.w.acceptAndPay}</Button>
            <Button variant="quiet">{t.w.decline}</Button>
            <span className="text-sm text-fg-muted">{t.w.openUntil}</span>
          </div>
        )}
      </Card>
    </div>
  );
}

// the plan in a few lines, where it heads Cleans (a) or sits on its home (c)
function PlanSummary({ t, withHome }: { t: Ctx; withHome?: boolean }) {
  const plan = t.c.plan!;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap sm:gap-6">
        <IconTile icon={Repeat} tone="success" />
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <p className="text-sm text-fg-muted">
            {t.w.everyWeek}
            {withHome && ` · ${homeName(t, plan.homeId)}`}
          </p>
          <p className="text-2xl font-semibold">{t.w.mondays}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
            <span>
              {t.w.services[0]} · <strong className="text-fg">$201.85</strong>{" "}
              {t.w.aClean}
            </span>
            <StatusBadge tone="success">{t.w.save}</StatusBadge>
          </p>
        </div>
        <ButtonLink
          variant="secondary"
          className="ml-14 sm:ml-0"
          href={t.go({ page: "plan" })}
        >
          {t.w.seePlan}
        </ButtonLink>
      </div>
    </Card>
  );
}

function CleansScreen({ t }: { t: Ctx }) {
  const up = upcomingOf(t.c);
  const past = t.c.cleans.filter((x) => x.done);
  const quote = t.c.quotes.find((q) => q.waiting);
  const many = t.c.homes.length > 1;
  const nothing = up.length === 0 && past.length === 0;
  const row = (x: Clean) => (
    <DatedItem
      key={x.id}
      id={x.id}
      at={x.at}
      title={serviceName(t, x.service)}
      description={
        [many && homeName(t, x.homeId), x.done && t.f.formatMoney(x.price)]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      onAction={() => t.nav({ page: "clean", id: x.id })}
    />
  );
  const a = t.s.layout === "a";
  return (
    <div className="flex flex-col gap-6">
      <Header label={t.w.crumbs} title={t.p.cleans} inBar />
      {a && quote && (
        <Section title={t.w.waitingForYou}>
          <List aria-label={t.w.waitingForYou}>
            <ListItem
              id={quote.id}
              title={t.w.quoteReady}
              description={t.w.quoteFor(
                t.f.formatShortDay(quote.for.slice(0, 10)),
              )}
              start={<IconTile icon={QuoteIcon} tone="warning" />}
              onAction={() => t.nav({ page: "quote", id: quote.id })}
            />
          </List>
        </Section>
      )}
      {a && t.c.plan && <PlanSummary t={t} withHome={many} />}
      {nothing && a && quote ? null : nothing ? (
        a ? (
          <EmptyState icon={Sparkles} title={t.w.nothingYet}>
            <ButtonLink variant="primary" href={t.go({ page: "request" })}>
              {t.w.requestAQuote}
            </ButtonLink>
          </EmptyState>
        ) : (
          <p className="text-fg-muted">{t.w.nothingYet}.</p>
        )
      ) : (
        <Tabs defaultSelectedKey="up">
          <TabList aria-label={t.p.cleans}>
            <Tab id="up" count={up.length}>
              {t.w.upcoming}
            </Tab>
            <Tab id="past" count={past.length}>
              {t.w.past}
            </Tab>
          </TabList>
          <TabPanel id="up">
            {up.length ? (
              <List aria-label={t.w.upcoming}>{up.map(row)}</List>
            ) : (
              <p className="text-fg-muted">{t.w.noneUpcoming}</p>
            )}
          </TabPanel>
          <TabPanel id="past">
            {past.length ? (
              <List aria-label={t.w.past}>{past.map(row)}</List>
            ) : (
              <p className="text-fg-muted">{t.w.nonePast}</p>
            )}
          </TabPanel>
        </Tabs>
      )}
    </div>
  );
}

function CleanScreen({ t }: { t: Ctx }) {
  const x = t.c.cleans.find((y) => y.id === t.s.id)!;
  const home = t.c.homes.find((h) => h.id === x.homeId)!;
  const quote = t.c.quotes.find((q) => q.cleanId === x.id);
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={[{ label: t.p.cleans, href: t.go({ page: "cleans" }) }]}
        title={serviceName(t, x.service)}
        status={x.done && <StatusBadge tone="success">{t.w.paid}</StatusBadge>}
        actions={
          !x.done && (
            <Button variant="secondary">
              {x.plan ? t.w.moveOrSkip : t.w.moveOrCancel}
            </Button>
          )
        }
      />
      <DetailsCard
        label={serviceName(t, x.service)}
        tile={<DateTile date={x.at} />}
        title={t.f.formatTime(x.at)}
        line={home.street}
      >
        <Facts>
          <Fact
            icon={Wallet}
            label={t.w.price}
            value={t.f.formatMoney(x.price)}
          />
          <Fact icon={Clock} label={t.w.howLong} value={t.w.about4} />
          {x.plan && (
            <Fact
              icon={Repeat}
              label={t.w.cleaningPlan}
              value={
                <Link href={t.go({ page: "plan" })}>
                  {t.w.everyWeek} · {t.w.mondays}
                </Link>
              }
            />
          )}
          {quote && (
            <Fact
              icon={QuoteIcon}
              label={t.w.startedFrom}
              value={
                <Link href={t.go({ page: "quote", id: quote.id })}>
                  {t.w.yourQuoteOf(
                    t.f.formatShortDay("2026-01-05T14:00:00.000Z".slice(0, 10)),
                  )}
                </Link>
              }
            />
          )}
        </Facts>
      </DetailsCard>
      <p className="text-sm text-fg-muted">{t.w.placeholder}</p>
    </div>
  );
}

function PlanScreen({ t }: { t: Ctx }) {
  const plan = t.c.plan!;
  const home = t.c.homes.find((h) => h.id === plan.homeId)!;
  const layout = t.s.layout;
  const quote = t.c.quotes.find((q) => q.kind === "plan");
  const crumbs: Crumb[] =
    layout === "a"
      ? [{ label: t.p.cleans, href: t.go({ page: "cleans" }) }]
      : layout === "b"
        ? []
        : homeCrumbs(t, plan.homeId);
  const next = upcomingOf(t.c)
    .filter((x) => x.plan)
    .slice(0, 3);
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={crumbs}
        title={layout === "b" ? t.w.yourPlan : t.w.cleaningPlan}
        inBar={layout === "b"}
        actions={
          <MenuButton label={t.w.actions}>
            <MenuItem icon={Repeat}>{t.w.askChange}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={X} danger>
              {t.w.endPlan}
            </MenuItem>
          </MenuButton>
        }
      />
      <DetailsCard
        label={t.w.cleaningPlan}
        tile={<IconTile icon={Repeat} tone="success" />}
        kicker={t.w.everyWeek}
        title={t.w.mondays}
        line={t.w.services[0]}
      >
        <Facts>
          <Fact
            icon={Wallet}
            label={t.w.price}
            value={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  <strong>$201.85</strong> {t.w.aClean}
                </span>
                <StatusBadge tone="success">{t.w.save}</StatusBadge>
              </span>
            }
          />
          <Fact
            icon={CalendarCheck}
            label={t.w.firstClean}
            value={t.f.formatShortDay(plan.firstClean.slice(0, 10))}
          />
          <Fact icon={Clock} label={t.w.howLong} value={t.w.about4} />
          {layout !== "c" && (
            <Fact icon={MapPin} label={t.w.where} value={home.street} />
          )}
          {quote && (
            <Fact
              icon={QuoteIcon}
              label={t.w.startedFrom}
              value={
                <Link href={t.go({ page: "quote", id: quote.id })}>
                  {t.w.yourQuoteOf(
                    t.f.formatShortDay("2026-01-12T14:00:00.000Z".slice(0, 10)),
                  )}
                </Link>
              }
            />
          )}
        </Facts>
      </DetailsCard>
      {layout !== "a" && (
        <Section title={t.w.planCleans}>
          <List aria-label={t.w.planCleans}>
            {next.map((x) => (
              <DatedItem
                key={x.id}
                id={x.id}
                at={x.at}
                title={serviceName(t, x.service)}
                onAction={() => t.nav({ page: "clean", id: x.id })}
              />
            ))}
          </List>
          <Link href={t.go({ page: "cleans" })}>{t.w.allInCleans}</Link>
        </Section>
      )}
    </div>
  );
}

function PaymentsScreen({ t }: { t: Ctx }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = t.c.bill
    ? [
        {
          id: "b1",
          title: `${t.w.weekOf("Jan 12")} · $359.29`,
          description: t.w.paidOn("Jan 19"),
          onOpen: () => t.nav({ page: "bill" }),
        },
      ]
    : [];
  return (
    <HomePage
      title={t.p.payments}
      actions={[
        {
          label: t.p.yourCard,
          icon: CreditCard,
          href: t.go({ page: "card" }),
        },
      ]}
      answer={
        <AnswerCard
          tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
          headline={t.w.nothingOwed}
        />
      }
      tilesLabel={t.p.payments}
      tiles={[
        {
          id: "last",
          icon: Wallet,
          label: t.w.lastPayments,
          hint: rows.length ? "$359.29, Jan 19" : undefined,
          count: rows.length,
          rows,
        },
      ]}
      open={open}
      onOpen={setOpen}
    />
  );
}

function BillScreen({ t }: { t: Ctx }) {
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={[{ label: t.p.payments, href: t.go({ page: "payments" }) }]}
        title={t.w.weekOf("Jan 12")}
        status={<StatusBadge tone="success">{t.w.paid}</StatusBadge>}
        subtitle={t.w.billNo}
      />
      <DetailsCard
        label={t.w.billNo}
        tile={<IconTile icon={Wallet} />}
        kicker={t.w.total}
        title="$359.29"
        line={t.w.paidOn("Jan 19")}
      />
      <p className="text-sm text-fg-muted">{t.w.placeholder}</p>
    </div>
  );
}

function CardScreen({ t }: { t: Ctx }) {
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={[{ label: t.p.payments, href: t.go({ page: "payments" }) }]}
        title={t.c.card ? t.w.visa : t.w.addACard}
      />
      <Card>
        <p className="text-fg-muted">{t.w.cardForm}</p>
      </Card>
    </div>
  );
}

const homeRow = (t: Ctx, h: Home) => {
  const plan = t.c.plan?.homeId === h.id;
  return (
    <ListItem
      key={h.id}
      id={h.id}
      title={h.street}
      description={`${t.w.kind[h.kind]} · ${t.w.bedrooms(h.rooms)}${plan ? ` · ${t.w.mondays}` : ""}`}
      start={<IconTile icon={House} />}
      end={plan && <StatusBadge tone="success">{t.w.cleaningPlan}</StatusBadge>}
      onAction={() => t.nav({ page: "property", id: h.id })}
    />
  );
};

// layouts a and b: Your details as today, contact then homes
function DetailsScreen({ t }: { t: Ctx }) {
  const c = t.s.layout === "c";
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        title={c ? t.w.yourHomes : t.p.yourDetails}
        inBar
      />
      <List aria-label={t.w.yourHomes}>
        {t.c.homes.map((h) => homeRow(t, h))}
      </List>
      <Contact t={t} />
    </div>
  );
}

function Contact({ t }: { t: Ctx }) {
  return (
    <Section
      title={t.w.contact}
      actions={<Button variant="text">{t.w.edit}</Button>}
    >
      <Card>
        <p className="[overflow-wrap:anywhere]">{t.w.contactLine}</p>
      </Card>
    </Section>
  );
}

// layouts a and b: a home, lit under Your details (H1)
function PropertyScreen({ t }: { t: Ctx }) {
  const h = t.c.homes.find((x) => x.id === t.s.id) ?? t.c.homes[0]!;
  const plan = t.c.plan?.homeId === h.id;
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={[{ label: t.p.yourDetails, href: t.go({ page: "details" }) }]}
        title={h.street}
      />
      <HomeFacts t={t} h={h} />
      {plan && (
        <Section title={t.w.cleaningPlan}>
          <List aria-label={t.w.cleaningPlan}>
            <ListItem
              id="plan"
              title={`${t.w.everyWeek} · ${t.w.mondays}`}
              description={`${t.w.services[0]} · $201.85 ${t.w.aClean}`}
              start={<IconTile icon={Repeat} tone="success" />}
              onAction={() => t.nav({ page: "plan" })}
            />
          </List>
        </Section>
      )}
    </div>
  );
}

function HomeFacts({ t, h }: { t: Ctx; h: Home }) {
  return (
    <DetailsCard label={h.street}>
      <Facts>
        <Fact icon={MapPin} label={t.w.where} value={h.line} />
        <Fact
          icon={Ruler}
          label={t.w.kind[h.kind]}
          value={t.w.bedrooms(h.rooms)}
        />
        <Fact icon={KeyRound} label={t.w.howWeGetIn} value={h.access} />
      </Facts>
    </DetailsCard>
  );
}

// layout c: a home is where its plan and its Quotes live. With one home,
// it's the section's own page, so there are no crumbs and the contact
// details close it; with two, each is under Your homes
function HomePlace({ t, homeId }: { t: Ctx; homeId: string }) {
  const h = t.c.homes.find((x) => x.id === homeId)!;
  const one = t.c.homes.length === 1;
  const plan = t.c.plan?.homeId === h.id;
  const quotes = t.c.quotes.filter((q) => q.homeId === h.id);
  return (
    <div className="flex flex-col gap-6">
      <Header
        label={t.w.crumbs}
        crumbs={
          one ? [] : [{ label: t.w.yourHomes, href: t.go({ page: "details" }) }]
        }
        title={h.street}
        actions={<Button variant="secondary">{t.w.edit}</Button>}
      />
      <HomeFacts t={t} h={h} />
      <Section title={t.w.cleaningPlan}>
        {plan ? (
          <PlanSummary t={t} />
        ) : (
          <p className="text-fg-muted">{t.w.noPlan}</p>
        )}
      </Section>
      <Section
        title={t.w.quotes}
        actions={
          <ButtonLink variant="text" href={t.go({ page: "request" })}>
            {t.w.requestAQuote}
          </ButtonLink>
        }
      >
        {quotes.length ? (
          <List aria-label={t.w.quotes}>
            {quotes.map((q) => (
              <ListItem
                key={q.id}
                id={q.id}
                title={
                  q.kind === "plan"
                    ? t.w.quoteTitlePlan
                    : t.w.quoteTitleClean(
                        t.f.formatShortDay(q.for.slice(0, 10)),
                      )
                }
                start={
                  <IconTile
                    icon={QuoteIcon}
                    tone={q.waiting ? "warning" : undefined}
                  />
                }
                end={
                  q.waiting && (
                    <StatusBadge tone="warning">
                      {t.w.waitingForYou}
                    </StatusBadge>
                  )
                }
                onAction={() => t.nav({ page: "quote", id: q.id })}
              />
            ))}
          </List>
        ) : (
          <p className="text-fg-muted">—</p>
        )}
      </Section>
      {one && <Contact t={t} />}
    </div>
  );
}

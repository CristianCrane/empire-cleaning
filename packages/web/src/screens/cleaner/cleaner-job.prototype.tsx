// PROTOTYPE: throwaway. The Cleaner's Job (and Cleaner needed, and an
// offered Job, which share its parts) for #493, on made-up data, at
// /prototype/cleaner-job?layout=A..D&case=1..10&lang=en|es (no sign-in),
// inside the real AppLayout and the Cleaner area's nav. ↑/↓ switch layouts,
// ←/→ switch cases. Lives only on prototype-cleaner-job.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
// D's split button's menu and sheet, placed as the ui kit's MenuButton and
// Dialog can't be told to (web lists react-aria-components on this branch
// only, for them)
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Menu as AriaMenu,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover as AriaPopover,
} from "react-aria-components";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CirclePlus,
  ClipboardList,
  Clock,
  DoorClosed,
  Hourglass,
  KeyRound,
  Lock,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  Plus,
  Sparkles,
  UserMinus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { formats, oneStop, type Language } from "@empire-cleaning/models";
import {
  ActionRow,
  AppLayout,
  Avatar,
  Button,
  ButtonLink,
  Card,
  DateTile,
  DetailsCard,
  Fact,
  Facts,
  Fold,
  LanguageProvider,
  MenuItem,
  MenuSeparator,
  type NavItem,
  RecordPage,
  Section,
  StatusBadge,
  linkStyles,
  type StatusTone,
  showToast,
} from "@empire-cleaning/ui";
import { setAppLanguage } from "../../language.ts";
import { type AppHref, linkTo } from "../../links.ts";
import { areaLabels } from "../../session.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const OFFICE = "+16463209076";
// a tel: link for the design system's links, which take only app links
const tel = (n: string) => `tel:${n}` as unknown as AppHref;

const say = (title: string) => () => showToast({ title, tone: "info" });

// ---- words, in both languages (a prototype's own, not a catalog) ----

const W = {
  en: {
    offers: "Offers",
    yourJobs: "Your jobs",
    jobDetails: "Job details",
    directions: "Directions",
    you: "You",
    open: "Open",
    youQ: "You?",
    confirmed: "Confirmed",
    notYet: "Not yet",
    personConfirmed: (n: string) => `${n}, confirmed`,
    personNotYet: (n: string) => `${n}, not confirmed yet`,
    seatOpen: "A place still open",
    seatYou: "The place you'd take",
    crew: "Crew",
    client: "Client",
    gettingIn: "Getting in",
    door: "Door",
    when: "When",
    where: "Where",
    howLong: "How long",
    extras: "Extras",
    address: "Address",
    number: "Number",
    hiddenUntil: (day: string) => `Shows ${day}`,
    hiddenUntilYours: "Shows once it's yours",
    onceYours: "Once it's yours",
    hours: (h: string, about: boolean) => (about ? `about ${h} h` : `${h} h`),
    call: (n: string) => `Call ${n}`,
    callOffice: "Call the office",
    nothingWritten:
      "Nothing's written down. Call the client when you get there.",
    canYouMakeIt: "Can you make it?",
    canYouTakeIt: "Can you take it?",
    firstToConfirm: "First to confirm gets it.",
    confirm: "Confirm",
    notForMe: "Not for me",
    markDone: "Mark done",
    couldntGetIn: "Couldn't get in",
    dropOut: "Drop out",
    cantMakeIt: "Can't make it?",
    tooLateToDrop: "Under 48 hours: call the office to drop out",
    atTheDoor: "At the door",
    offered: "Offered",
    today: "Today",
    inProgress: "In progress",
    done: "Done",
    youMarkedDone: (at: string) => `You marked it done at ${at}. Thanks!`,
    youSent: (at: string) =>
      `You sent this at ${at}. The client and the office know.`,
    hasntConfirmed: (n: string) =>
      `${n} hasn't confirmed. Call the office before you finish.`,
    theHome: "The home",
    condition: {
      light: "Cleaner than usual",
      moderate: "About right",
      heavy: "Dirtier than usual",
    },
    reported: "You said",
    nothingToReport: "Nothing to report",
    theJob: "The job",
    whatToDo: "What to do",
    service: { standard: "Standard Clean", deep: "Deep Clean" },
    extraNames: {
      oven: "Inside the oven",
      fridge: "Inside the fridge",
      fridgeShelves: "Inside the fridge, shelves and drawers",
      curtains: "Wash and hang the curtains",
      cabinets: "Inside the kitchen cabinets",
      windows: "Inside the windows and their tracks",
      laundry: "One load of laundry, washed and folded",
      baseboards: "Baseboards",
      walls: "Wipe down the walls",
    },
    didMore: (what: string) => `Also did: ${what}`,
    reason: "Nobody answered, and the key wasn't where the instructions say.",
    door4b: "Ring 4B; the doorman has a key.",
    seatsOf: (filled: number, of: number) => `${filled} of ${of}`,
    toast: (what: string) => `Prototype: "${what}" does nothing here`,
    available: "Available",
    onSite: "On site",
    moreActions: "More actions",
    zip: (z: string) => `Zip code ${z}`,
    callClient: (n: string) => `Call ${n}`,
    clientsNumber: "Client's number",
    // the crew's line: how many confirmed of the crew, then how many places
    // are open; a zero isn't said (an offer: "2 places open")
    crewLine: (n: number, of: number, open: number) =>
      open === 0
        ? `${n} of ${of} confirmed`
        : n === 0
          ? `${open} ${open === 1 ? "place" : "places"} open`
          : `${n} of ${of} confirmed, ${open} open`,
    cancel: "Cancel",
    // D: the details' count of extras, the line under it pointing down to
    // their list, and that list's line
    extrasCount: (n: number) => `${n} ${n === 1 ? "extra" : "extras"}`,
    listedBelow: "Listed below",
    extrasLine: (n: number) => `${n} on top of the clean`,
  },
  es: {
    offers: "Ofertas",
    yourJobs: "Tus trabajos",
    jobDetails: "Detalles del trabajo",
    directions: "Cómo llegar",
    you: "Tú",
    open: "Libre",
    youQ: "¿Tú?",
    confirmed: "Confirmado",
    notYet: "Aún no",
    personConfirmed: (n: string) => `${n}, confirmado`,
    personNotYet: (n: string) => `${n}, aún sin confirmar`,
    seatOpen: "Un lugar aún libre",
    seatYou: "El lugar que tomarías",
    crew: "Equipo",
    client: "Cliente",
    gettingIn: "Para entrar",
    door: "Entrada",
    when: "Cuándo",
    where: "Dónde",
    howLong: "Cuánto dura",
    extras: "Extras",
    address: "Dirección",
    number: "Número",
    hiddenUntil: (day: string) => `Aparece el ${day}`,
    hiddenUntilYours: "Aparece cuando sea tuyo",
    onceYours: "Cuando sea tuyo",
    hours: (h: string, about: boolean) =>
      about ? `cerca de ${h} h` : `${h} h`,
    call: (n: string) => `Llamar a ${n}`,
    callOffice: "Llamar a la oficina",
    nothingWritten: "No hay nada escrito. Llama al cliente cuando llegues.",
    canYouMakeIt: "¿Puedes ir?",
    canYouTakeIt: "¿Puedes tomarlo?",
    firstToConfirm: "El primero que confirme se lo queda.",
    confirm: "Confirmar",
    notForMe: "No es para mí",
    markDone: "Marcar como terminado",
    couldntGetIn: "No pude entrar",
    dropOut: "Dejarlo",
    cantMakeIt: "¿No puedes ir?",
    tooLateToDrop: "Faltan menos de 48 horas: llama a la oficina para dejarlo",
    atTheDoor: "En la puerta",
    offered: "Ofrecido",
    today: "Hoy",
    inProgress: "En curso",
    done: "Terminado",
    youMarkedDone: (at: string) =>
      `Lo marcaste como terminado a las ${at}. ¡Gracias!`,
    youSent: (at: string) =>
      `Lo enviaste a las ${at}. El cliente y la oficina ya lo saben.`,
    hasntConfirmed: (n: string) =>
      `${n} no ha confirmado. Llama a la oficina antes de terminar.`,
    theHome: "La casa",
    condition: {
      light: "Más limpia de lo normal",
      moderate: "Normal",
      heavy: "Más sucia de lo normal",
    },
    reported: "Dijiste",
    nothingToReport: "Nada que informar",
    theJob: "El trabajo",
    whatToDo: "Qué hacer",
    service: { standard: "Limpieza estándar", deep: "Limpieza profunda" },
    extraNames: {
      oven: "Dentro del horno",
      fridge: "Dentro del refrigerador",
      fridgeShelves: "Dentro del refrigerador, repisas y cajones",
      curtains: "Lavar y colgar las cortinas",
      cabinets: "Dentro de los gabinetes de la cocina",
      windows: "Las ventanas por dentro y sus rieles",
      laundry: "Una carga de ropa, lavada y doblada",
      baseboards: "Zócalos",
      walls: "Limpiar las paredes",
    },
    didMore: (what: string) => `También hice: ${what}`,
    reason:
      "Nadie contestó, y la llave no estaba donde dicen las instrucciones.",
    door4b: "Toca el 4B; el portero tiene una llave.",
    seatsOf: (filled: number, of: number) => `${filled} de ${of}`,
    toast: (what: string) => `Prototipo: "${what}" no hace nada aquí`,
    available: "Disponible",
    onSite: "En el lugar",
    moreActions: "Más acciones",
    zip: (z: string) => `Código postal ${z}`,
    callClient: (n: string) => `Llamar a ${n}`,
    clientsNumber: "Teléfono del cliente",
    crewLine: (n: number, of: number, open: number) => {
      const libre = open === 1 ? "libre" : "libres";
      const confirmed = `${n} de ${of} ${of === 1 ? "confirmado" : "confirmados"}`;
      return open === 0
        ? confirmed
        : n === 0
          ? `${open} ${open === 1 ? "lugar" : "lugares"} ${libre}`
          : `${confirmed}, ${open} ${libre}`;
    },
    cancel: "Cancelar",
    extrasCount: (n: number) => `${n} ${n === 1 ? "extra" : "extras"}`,
    listedBelow: "En la lista de abajo",
    extrasLine: (n: number) => `${n} además de la limpieza`,
  },
};
type Words = (typeof W)["en"];

// ---- the cases ----

type Member = { name: string; you?: boolean; confirmed: boolean } | null;

type Kind =
  | "offered"
  | "open"
  | "confirmed"
  | "today"
  | "started"
  | "startedWaiting"
  | "done"
  | "noAccess";

type JobCase = {
  key: string;
  name: string;
  kind: Kind;
  startsAt: string;
  hours: number;
  service: "standard" | "deep";
  street: string;
  postcode: string;
  extras: (keyof Words["extraNames"])[];
  crew: Member[];
  // more than 48 hours to go: they can still drop out themselves
  canDropOut: boolean;
  outcomeAt?: string;
  // how to get in, when the Client wrote more than the usual line (D's
  // case 9, long enough that the page scrolls)
  door?: Record<Language, string>;
};

// Thu, Jan 8, 2026, 9:00 AM in New York
const THU = "2026-01-08T14:00:00Z";
const base = {
  startsAt: THU,
  street: "41-12 Austin St, 4B",
  postcode: "11375",
  canDropOut: false,
};

const cases: JobCase[] = [
  {
    ...base,
    key: "1",
    name: "offered, crew partly open",
    kind: "offered",
    hours: 3.75,
    service: "deep",
    extras: [],
    crew: [{ name: "Cory", you: true, confirmed: false }, null],
    canDropOut: true,
  },
  {
    ...base,
    key: "2",
    name: "open (Cleaner needed)",
    kind: "open",
    hours: 3.75,
    service: "deep",
    extras: [],
    crew: [{ name: "Dee", confirmed: true }, null],
  },
  {
    ...base,
    key: "3",
    name: "confirmed, before the day",
    kind: "confirmed",
    hours: 3.25,
    service: "standard",
    extras: ["oven"],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: false },
    ],
    canDropOut: true,
  },
  {
    ...base,
    key: "4",
    name: "on the day",
    kind: "today",
    hours: 3.25,
    service: "standard",
    extras: [],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: true },
    ],
  },
  {
    ...base,
    key: "5",
    name: "started",
    kind: "started",
    hours: 3.25,
    service: "standard",
    extras: [],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: true },
    ],
  },
  {
    ...base,
    key: "6",
    name: "started, Dee not confirmed",
    kind: "startedWaiting",
    hours: 3.25,
    service: "standard",
    extras: [],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: false },
    ],
  },
  {
    ...base,
    key: "7",
    name: "done",
    kind: "done",
    hours: 3.25,
    service: "standard",
    extras: [],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: true },
    ],
    outcomeAt: "2026-01-08T17:10:00Z",
  },
  {
    ...base,
    key: "8",
    name: "couldn't get in",
    kind: "noAccess",
    hours: 3.25,
    service: "standard",
    extras: [],
    crew: [{ name: "Cory", you: true, confirmed: true }],
    outcomeAt: "2026-01-08T14:20:00Z",
  },
  {
    ...base,
    key: "9",
    name: "on the day, long notes (D: a page that scrolls)",
    kind: "today",
    hours: 5.5,
    service: "deep",
    extras: ["oven", "fridge"],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: true },
      { name: "Ana", confirmed: false },
    ],
    door: {
      en: "Ring 4B. If nobody answers, the doorman has a key: tell him you're with Empire. Leave your shoes on the mat inside. The cat stays in the bedroom, so keep that door shut. Fresh towels and the vacuum are in the hall closet; please don't move the plants on the windowsill. The alarm code is 4417, then OFF. Lock both locks when you leave and give the key back to the doorman.",
      es: "Toca el 4B. Si nadie contesta, el portero tiene una llave: dile que vienes de Empire. Deja los zapatos en el tapete, adentro. El gato se queda en el cuarto, así que mantén esa puerta cerrada. Las toallas limpias y la aspiradora están en el clóset del pasillo; por favor no muevas las plantas de la ventana. El código de la alarma es 4417, luego OFF. Cierra las dos cerraduras al salir y devuélvele la llave al portero.",
    },
  },
  {
    ...base,
    key: "10",
    name: "confirmed, many extras (D: how extras scale)",
    kind: "confirmed",
    hours: 6.5,
    service: "deep",
    extras: [
      "oven",
      "fridgeShelves",
      "curtains",
      "cabinets",
      "windows",
      "laundry",
      "baseboards",
      "walls",
    ],
    crew: [
      { name: "Cory", you: true, confirmed: true },
      { name: "Dee", confirmed: false },
    ],
    canDropOut: true,
  },
];

const layouts = [
  { key: "A", name: "the details card, its values drawn" },
  { key: "B", name: "big answers to how long, where, who" },
  { key: "C", name: "a strip of locks that open" },
  { key: "D", name: "the picks: one header, one split button" },
] as const;
type LayoutKey = (typeof layouts)[number]["key"];

// ---- what every layout reads off a case ----

const onTheDay = (k: Kind) =>
  k === "today" ||
  k === "started" ||
  k === "startedWaiting" ||
  k === "done" ||
  k === "noAccess";
const started = (k: Kind) => k === "started" || k === "startedWaiting";
const finished = (k: Kind) => k === "done" || k === "noAccess";
const isOffer = (k: Kind) => k === "offered" || k === "open";
// the address is theirs once offered by name, or taken
const addressShown = (k: Kind) => k !== "open";

function useJob(c: JobCase, lang: Language) {
  const f = formats[lang];
  const w: Words = W[lang];
  const end = new Date(new Date(c.startsAt).getTime() + c.hours * 3_600_000);
  // plain rounded hours: to the half hour, "about" only when it rounded
  const half = Math.round(c.hours * 2) / 2;
  const whole = Math.floor(half);
  const h = `${whole === 0 ? "" : whole}${half % 1 ? "½" : ""}`;
  return {
    f,
    w,
    lang,
    range: `${f.formatTime(c.startsAt)} – ${f.formatTime(end)}`,
    start: f.formatTime(c.startsAt),
    howLong: w.hours(h, half !== c.hours),
    weekday: f.weekdayName(c.startsAt.slice(0, 10)),
    address: `${c.street}, ${c.postcode}`,
    service: w.service[c.service],
    extras: c.extras.map((x) => w.extraNames[x]),
    phone: "(646) 555-0100",
    clientName: "Casey",
  };
}
type J = ReturnType<typeof useJob>;

function status(
  c: JobCase,
  w: Words,
): { tone: StatusTone; text: string } | null {
  switch (c.kind) {
    case "offered":
      return { tone: "info", text: w.offered };
    case "open":
      return null; // the page's question says it
    case "confirmed":
      return null; // the usual case for a job on Your jobs
    case "today":
      return { tone: "info", text: w.today };
    case "started":
    case "startedWaiting":
      // running as it should (docs/ux.md, Status colours)
      return { tone: "success", text: w.inProgress };
    case "done":
      return { tone: "success", text: w.done };
    case "noAccess":
      return { tone: "danger", text: w.couldntGetIn };
  }
}

// ---- shared pieces: a person, an empty place, a hidden value ----

// a person's status as a shape, not a colour alone: a tick for confirmed,
// an hourglass for not yet
function StatusMark({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-surface ${
        confirmed
          ? "bg-success-strong text-surface"
          : "bg-warning-subtle text-warning-strong"
      }`}
    >
      {confirmed ? (
        <Check size={13} strokeWidth={3} />
      ) : (
        <Hourglass size={12} strokeWidth={2.5} />
      )}
    </span>
  );
}

function Face({ you, small }: { you?: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${
        small ? "size-8" : "size-10"
      } ${you ? "bg-primary text-primary-fg" : "bg-neutral-subtle text-neutral-strong"}`}
    >
      <UserRound size={small ? 18 : 22} />
    </span>
  );
}

function EmptyFace({ small, you }: { small?: boolean; you?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-dashed ${
        you
          ? "border-primary text-primary"
          : "border-border-strong text-fg-muted"
      } ${small ? "size-8" : "size-10"}`}
    >
      <Plus size={small ? 16 : 20} />
    </span>
  );
}

// a chip: face, first name, and (with `words`) the status in words too
function PersonChip({
  m,
  w,
  words = false,
  openIsYou = false,
}: {
  m: Member;
  w: Words;
  words?: boolean;
  openIsYou?: boolean;
}) {
  if (!m) {
    return (
      <span className="inline-flex items-center gap-2">
        <EmptyFace small={!words} you={openIsYou} />
        <span className="flex flex-col leading-tight">
          <span
            className={
              openIsYou ? "font-semibold text-primary" : "text-fg-muted"
            }
          >
            {openIsYou ? w.youQ : w.open}
          </span>
          <span className="sr-only">{openIsYou ? w.seatYou : w.seatOpen}</span>
        </span>
      </span>
    );
  }
  const name = m.you ? w.you : m.name;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <Face you={m.you} small={!words} />
        <StatusMark confirmed={m.confirmed} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-semibold text-fg">{name}</span>
        {words ? (
          <span
            className={`text-sm ${m.confirmed ? "text-fg-muted" : "text-warning-strong"}`}
          >
            {m.confirmed ? w.confirmed : w.notYet}
          </span>
        ) : (
          <span className="sr-only">
            {m.confirmed ? `, ${w.confirmed}` : `, ${w.notYet}`}
          </span>
        )}
      </span>
    </span>
  );
}

function CrewChips({ c, w, words }: { c: JobCase; w: Words; words?: boolean }) {
  return (
    <span className="flex flex-wrap gap-x-5 gap-y-3">
      {c.crew.map((m, i) => (
        <PersonChip
          key={i}
          m={m}
          w={w}
          words={words}
          openIsYou={c.kind === "open" && !m}
        />
      ))}
    </span>
  );
}

// A: a redaction bar with a lock, and when it shows
function Redacted({ note, width = "w-28" }: { note: string; width?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
      <Lock aria-hidden size={16} className="text-fg-muted" />
      <span
        aria-hidden
        className={`inline-block h-3.5 ${width} rounded-full`}
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--color-neutral-subtle) 0 6px, var(--color-border) 6px 12px)",
        }}
      />
      <span className="text-sm text-fg-muted">{note}</span>
    </span>
  );
}

// B: made-up words, blurred, under a lock pill (never the real text)
function Blurred({ shape, note }: { shape: string; note: string }) {
  return (
    <span className="inline-grid items-center justify-items-center">
      <span
        aria-hidden
        className="col-start-1 row-start-1 px-1 text-lg font-semibold text-fg blur-[3.5px] select-none"
      >
        {shape}
      </span>
      <span className="col-start-1 row-start-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold text-fg-muted shadow-sm ring-1 ring-border">
          <Lock aria-hidden size={14} />
          {note}
        </span>
      </span>
    </span>
  );
}

const directionsTo = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

function Directions({ j }: { j: J }) {
  return (
    <a
      className="font-semibold text-primary underline-offset-2 hover:underline"
      href={directionsTo(j.address)}
      target="_blank"
      rel="noreferrer"
    >
      {j.w.directions}
    </a>
  );
}

function CallLink({ j, label }: { j: J; label?: string }) {
  return (
    <a className="font-semibold text-primary" href={`tel:${j.phone}`}>
      {label ?? `${j.clientName}, ${j.phone}`}
    </a>
  );
}

// the offer's answer, with no paragraph
function Answer({ j }: { c: JobCase; j: J }) {
  const { w } = j;
  return (
    <>
      <Button variant="secondary" onPress={say(w.toast(w.notForMe))}>
        {w.notForMe}
      </Button>
      <Button onPress={say(w.toast(w.confirm))}>{w.confirm}</Button>
    </>
  );
}

// how it went, said once, first, in their words
function Outcome({
  c,
  j,
  framed = true,
}: {
  c: JobCase;
  j: J;
  framed?: boolean;
}) {
  const { w, f } = j;
  const at = f.formatTime(c.outcomeAt!);
  const body =
    c.kind === "done" ? (
      <div className="flex flex-col gap-4">
        <p className="text-lg text-fg">{oneStop(w.youMarkedDone(at))}</p>
        <Facts>
          <Fact
            icon={Sparkles}
            label={w.theHome}
            value={w.condition.moderate}
          />
          <Fact
            icon={ClipboardList}
            label={w.reported}
            value={w.didMore(w.extraNames.fridge)}
          />
        </Facts>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <p className="text-lg text-fg">{oneStop(w.youSent(at))}</p>
        <blockquote className="border-l-4 border-border-strong pl-4 text-fg-muted italic">
          {w.reason}
        </blockquote>
      </div>
    );
  return framed ? <Card>{body}</Card> : body;
}

function footerFor(c: JobCase, j: J) {
  const { w } = j;
  if (!started(c.kind)) return undefined;
  return {
    label: w.whatToDo,
    children: (
      <>
        <Button variant="quiet" onPress={say(w.toast(w.couldntGetIn))}>
          <DoorClosed aria-hidden size={18} />
          {w.couldntGetIn}
        </Button>
        <Button
          isDisabled={c.kind === "startedWaiting"}
          onPress={say(w.toast(w.markDone))}
        >
          {w.markDone}
        </Button>
      </>
    ),
  };
}

function alertsFor(c: JobCase, j: J) {
  return [
    c.kind === "startedWaiting" && {
      key: "waiting",
      tone: "warning" as const,
      children: j.w.hasntConfirmed("Dee"),
      action: (
        <ButtonLink variant="text" href={tel(OFFICE)}>
          {j.w.callOffice}
        </ButtonLink>
      ),
    },
  ];
}

function trailFor(c: JobCase, j: J) {
  return [
    isOffer(c.kind)
      ? { label: j.w.offers, href: linkTo({ to: "/cleaner/offers" }) }
      : { label: j.w.yourJobs, href: linkTo({ to: "/cleaner" }) },
    { label: `${j.f.formatDay(c.startsAt.slice(0, 10))}, ${j.start}` },
  ];
}

function Badge({ c, w }: { c: JobCase; w: Words }) {
  const s = status(c, w);
  return s ? <StatusBadge tone={s.tone}>{s.text}</StatusBadge> : null;
}

// ---- Layout A: the details card as it is, its values drawn ----
// The RecordPage and DetailsCard stay: a date tile, the time range as the
// headline, the address with Directions. Each fact's value becomes a
// picture: hidden ones a striped bar with a lock and the day it shows, the
// crew small faces with a tick or an hourglass, the client a face. On the
// day, Getting in and the client's Call lead the facts, larger. Dropping
// out is a quiet line at the page's foot.

function LayoutA({ c, j }: { c: JobCase; j: J }) {
  const { w } = j;
  const day = onTheDay(c.kind);
  const gettingIn = (
    <Fact
      key="in"
      icon={KeyRound}
      label={w.gettingIn}
      className="col-span-full"
      value={
        day ? (
          <span className="text-xl font-semibold whitespace-pre-line">
            {w.door4b}
          </span>
        ) : (
          <Redacted note={j.weekday} width="w-40" />
        )
      }
    />
  );
  const client = (
    <Fact
      key="client"
      icon={Phone}
      label={w.client}
      value={
        c.kind === "open" ? (
          <Redacted note={w.onceYours} width="w-24" />
        ) : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <Face small />
              <span className="font-semibold">{j.clientName}</span>
            </span>
            {day ? (
              finished(c.kind) ? (
                <CallLink j={j} label={j.phone} />
              ) : (
                <ButtonLink variant="secondary" href={tel(j.phone)}>
                  <PhoneCall aria-hidden size={18} />
                  {w.call(j.clientName)}
                </ButtonLink>
              )
            ) : (
              <Redacted note={j.weekday} width="w-24" />
            )}
          </span>
        )
      }
    />
  );
  const crew = (
    <Fact
      key="crew"
      icon={Users}
      label={w.crew}
      value={<CrewChips c={c} w={w} />}
    />
  );
  const extras = c.extras.length > 0 && (
    <Fact
      key="extras"
      icon={CirclePlus}
      label={w.extras}
      value={j.f.formatList(j.extras)}
    />
  );
  const facts =
    day && !finished(c.kind)
      ? [gettingIn, client, crew, extras]
      : [crew, client, gettingIn, extras];

  const details = (
    <DetailsCard
      label={w.jobDetails}
      tile={<DateTile date={c.startsAt} />}
      kicker={j.howLong}
      title={<span className="tabular-nums">{j.range}</span>}
      line={
        addressShown(c.kind) ? (
          <>
            <span className="block text-fg">{j.address}</span>
            <Directions j={j} />
          </>
        ) : (
          <span className="flex flex-col gap-1">
            <Redacted note={w.onceYours} width="w-32" />
            <span className="text-fg">{c.postcode}</span>
          </span>
        )
      }
    >
      <Facts>{facts}</Facts>
    </DetailsCard>
  );

  return (
    <RecordPage
      trail={trailFor(c, j)}
      title={j.service}
      status={<Badge c={c} w={w} />}
      alerts={alertsFor(c, j)}
      details={finished(c.kind) ? <Outcome c={c} j={j} /> : details}
      footer={footerFor(c, j)}
    >
      {isOffer(c.kind) && (
        <Card>
          <ActionRow actions={<Answer c={c} j={j} />}>
            <p className="text-lg">
              <strong>
                {c.kind === "open" ? w.canYouTakeIt : w.canYouMakeIt}
              </strong>
            </p>
            {c.kind === "open" && <p>{w.firstToConfirm}</p>}
          </ActionRow>
        </Card>
      )}
      {finished(c.kind) && <Fold label={w.theJob}>{details}</Fold>}
      {(c.kind === "confirmed" || c.kind === "today") && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
          {c.canDropOut ? (
            <>
              {w.cantMakeIt}
              <Button
                variant="danger-text"
                size="sm"
                onPress={say(w.toast(w.dropOut))}
              >
                <UserMinus aria-hidden size={16} />
                {w.dropOut}
              </Button>
            </>
          ) : (
            <>
              {w.cantMakeIt}
              <a className="font-semibold text-primary" href={`tel:${OFFICE}`}>
                {w.callOffice}
              </a>
            </>
          )}
        </p>
      )}
    </RecordPage>
  );
}

// ---- Layout B: big answers to how long, where, who ----
// One card of the reader's questions, each a small label over a large
// answer: When (the tile and range), How long, Where, Crew (faces with the
// status in words too), Client. Hidden values are blurred stand-in words
// under a lock pill. On the day an "At the door" card leads the page, the
// door text large and Call the page's one primary. Offers answer in the
// foot bar, in reach; dropping out is in the Actions menu, which on the
// day says to call the office instead.

function Ask({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <span className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
        {label}
      </span>
      <div className="text-lg text-fg">{children}</div>
    </div>
  );
}

function LayoutB({ c, j }: { c: JobCase; j: J }) {
  const { w } = j;
  const day = onTheDay(c.kind);
  const atTheDoor = day && !finished(c.kind) && (
    <Card hiddenTitle={w.atTheDoor}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <KeyRound
            aria-hidden
            size={28}
            className="mt-1 shrink-0 text-primary"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
              {w.gettingIn}
            </span>
            <p className="text-2xl font-semibold text-fg">{w.door4b}</p>
          </div>
        </div>
        <ButtonLink
          variant={started(c.kind) ? "secondary" : "primary"}
          href={tel(j.phone)}
          className="self-start"
        >
          <PhoneCall aria-hidden size={18} />
          {w.call(j.clientName)}
        </ButtonLink>
      </div>
    </Card>
  );

  const card = (
    <Card hiddenTitle={w.jobDetails}>
      <div className="flex flex-col gap-4">
        <Ask label={w.when}>
          <span className="flex items-center gap-4">
            <DateTile date={c.startsAt} />
            <span className="flex flex-col">
              <span className="text-2xl font-semibold tabular-nums">
                {j.range}
              </span>
              <span className="text-fg-muted">{j.howLong}</span>
            </span>
          </span>
        </Ask>
        <Ask label={w.where}>
          {addressShown(c.kind) ? (
            <span className="flex flex-col">
              <span>{j.address}</span>
              <Directions j={j} />
            </span>
          ) : (
            <span className="flex flex-col gap-1">
              <Blurred shape="00-00 Xxxxxx Xx, 0X" note={w.onceYours} />
              <span>{c.postcode}</span>
            </span>
          )}
        </Ask>
        <Ask label={w.crew}>
          <CrewChips c={c} w={w} words />
        </Ask>
        {(!day || finished(c.kind)) && (
          <Ask label={w.client}>
            {c.kind === "open" ? (
              <Blurred shape="Xxxxx, (000) 000-0000" note={w.onceYours} />
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="inline-flex items-center gap-2">
                  <Face />
                  <span className="font-semibold">{j.clientName}</span>
                </span>
                {day ? (
                  // on the day the call is in the door card above
                  finished(c.kind) ? (
                    <CallLink j={j} label={j.phone} />
                  ) : null
                ) : (
                  <Blurred shape="(000) 000-0000" note={j.weekday} />
                )}
              </span>
            )}
          </Ask>
        )}
        {!day && (
          <Ask label={w.gettingIn}>
            <Blurred shape="Xxxx 0X; xxx xxxxxxx xxx" note={j.weekday} />
          </Ask>
        )}
        {c.extras.length > 0 && (
          <Ask label={w.extras}>{j.f.formatList(j.extras)}</Ask>
        )}
      </div>
    </Card>
  );

  const footer = isOffer(c.kind)
    ? {
        label: w.whatToDo,
        summary: (
          <span className="flex flex-col">
            <span className="font-semibold text-fg">
              {c.kind === "open" ? w.canYouTakeIt : w.canYouMakeIt}
            </span>
            {c.kind === "open" && (
              <span className="text-sm text-fg-muted">{w.firstToConfirm}</span>
            )}
          </span>
        ),
        children: <Answer c={c} j={j} />,
      }
    : footerFor(c, j);

  const actions =
    c.kind === "confirmed" || c.kind === "today"
      ? c.canDropOut
        ? [
            { label: w.callOffice, icon: Phone, href: tel(OFFICE) },
            {
              label: w.dropOut,
              icon: UserMinus,
              danger: true,
              onAction: say(w.toast(w.dropOut)),
            },
          ]
        : [{ label: w.callOffice, icon: Phone, href: tel(OFFICE) }]
      : [];

  return (
    <RecordPage
      trail={trailFor(c, j)}
      title={j.service}
      status={<Badge c={c} w={w} />}
      actions={actions}
      alerts={alertsFor(c, j)}
      details={
        <>
          {finished(c.kind) && <Outcome c={c} j={j} />}
          {atTheDoor}
          {finished(c.kind) ? <div className="opacity-75">{card}</div> : card}
        </>
      }
      footer={footer}
    />
  );
}

// ---- Layout C: a strip of locks that open ----
// A short card says when (tile, range, how long) and where. Under it, a
// strip of tiles for what comes later: the address, the door, the client's
// number, each a lock with the day it opens until then, so the reader sees
// what they'll get and when at a glance. On the day the door and Call open
// up and lead, large. The crew is a row of places, filled or empty, with
// "1 of 2" beside, and dropping out sits on the crew's title line, where
// your place is.

function LockTile({
  icon: Icon,
  label,
  open,
  note,
  wide,
  children,
}: {
  icon: typeof Lock;
  label: string;
  open: boolean;
  note?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-lg border p-3 ${
        open
          ? "border-border bg-surface"
          : "border-dashed border-border-strong bg-surface-sunken"
      } ${wide ? "col-span-full" : ""}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        {open ? <Icon aria-hidden size={16} /> : <Lock aria-hidden size={16} />}
        {label}
      </span>
      {open ? (
        <div className="text-fg [overflow-wrap:anywhere]">{children}</div>
      ) : (
        <span className="text-sm text-fg-muted">{note}</span>
      )}
    </div>
  );
}

function LayoutC({ c, j }: { c: JobCase; j: J }) {
  const { w } = j;
  const day = onTheDay(c.kind);
  const filled = c.crew.filter((m) => m?.confirmed).length;
  const summary = (
    <Card hiddenTitle={w.jobDetails}>
      <div className="flex items-center gap-4">
        <DateTile date={c.startsAt} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-2xl font-semibold tabular-nums text-fg">
            {j.range}
          </p>
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Clock aria-hidden size={16} />
            {j.howLong}
          </p>
          <p className="flex items-start gap-1.5 text-fg">
            <MapPin
              aria-hidden
              size={16}
              className="mt-1 shrink-0 text-fg-muted"
            />
            {addressShown(c.kind) ? (
              <span>
                {j.address} · <Directions j={j} />
              </span>
            ) : (
              <span>{c.postcode}</span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );

  const locks = !finished(c.kind) && (
    <div className="grid grid-cols-2 gap-3">
      {!addressShown(c.kind) && (
        <LockTile
          icon={MapPin}
          label={w.address}
          open={false}
          note={w.onceYours}
          wide
        />
      )}
      <LockTile
        icon={KeyRound}
        label={w.door}
        open={day}
        note={j.weekday}
        wide={day}
      >
        <span className="text-xl font-semibold">{w.door4b}</span>
      </LockTile>
      {day ? (
        <ButtonLink
          variant={started(c.kind) ? "secondary" : "primary"}
          href={tel(j.phone)}
          className="col-span-full"
        >
          <PhoneCall aria-hidden size={18} />
          {w.call(j.clientName)}
        </ButtonLink>
      ) : (
        <LockTile
          icon={Phone}
          label={c.kind === "open" ? w.client : `${j.clientName} · ${w.number}`}
          open={false}
          note={c.kind === "open" ? w.onceYours : j.weekday}
        />
      )}
    </div>
  );

  const crewAction =
    c.kind === "confirmed" || c.kind === "today" ? (
      c.canDropOut ? (
        <Button variant="danger-text" onPress={say(w.toast(w.dropOut))}>
          <UserMinus aria-hidden size={18} />
          {w.dropOut}
        </Button>
      ) : (
        <ButtonLink variant="text" href={tel(OFFICE)}>
          <Phone aria-hidden size={18} />
          {w.callOffice}
        </ButtonLink>
      )
    ) : undefined;

  const crew = (
    <Section
      title={`${w.crew} · ${w.seatsOf(filled, c.crew.length)}`}
      actions={crewAction}
    >
      <div className="flex flex-wrap items-start gap-4">
        {c.crew.map((m, i) => (
          <div
            key={i}
            className="flex w-16 flex-col items-center gap-1 text-center"
          >
            {m ? (
              <span className="relative">
                <span
                  aria-hidden
                  className={`flex size-14 items-center justify-center rounded-full ${
                    m.you
                      ? "bg-primary text-primary-fg"
                      : "bg-neutral-subtle text-neutral-strong"
                  }`}
                >
                  <UserRound size={28} />
                </span>
                <StatusMark confirmed={m.confirmed} />
              </span>
            ) : (
              <span
                aria-hidden
                className={`flex size-14 items-center justify-center rounded-full border-2 border-dashed ${
                  c.kind === "open"
                    ? "border-primary text-primary"
                    : "border-border-strong text-fg-muted"
                }`}
              >
                <Plus size={24} />
              </span>
            )}
            <span
              className={`text-sm ${m ? "font-semibold text-fg" : c.kind === "open" ? "font-semibold text-primary" : "text-fg-muted"}`}
            >
              {m
                ? m.you
                  ? w.you
                  : m.name
                : c.kind === "open"
                  ? w.youQ
                  : w.open}
            </span>
            <span className="sr-only">
              {m
                ? m.confirmed
                  ? w.confirmed
                  : w.notYet
                : c.kind === "open"
                  ? w.seatYou
                  : w.seatOpen}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );

  const offer = isOffer(c.kind) && (
    <Section
      title={c.kind === "open" ? w.canYouTakeIt : w.canYouMakeIt}
      description={c.kind === "open" ? w.firstToConfirm : undefined}
    >
      <div className="flex flex-wrap gap-2">
        <Answer c={c} j={j} />
      </div>
    </Section>
  );

  return (
    <RecordPage
      trail={trailFor(c, j)}
      title={j.service}
      status={<Badge c={c} w={w} />}
      alerts={alertsFor(c, j)}
      details={
        <>
          {finished(c.kind) && <Outcome c={c} j={j} />}
          {summary}
        </>
      }
      footer={footerFor(c, j)}
    >
      {locks}
      {offer}
      {crew}
      {c.extras.length > 0 && (
        <p className="flex items-center gap-2 text-fg">
          <CirclePlus aria-hidden size={18} className="text-fg-muted" />
          <span className="font-semibold">{w.extras}:</span>{" "}
          {j.f.formatList(j.extras)}
        </p>
      )}
    </RecordPage>
  );
}

// ---- Layout D: the picks from A, B and C ----
// One header card: the date tile, the time range large (B's), the address;
// one rule; then the details, one icon each: how long, the Client (their
// name in every case), their number once the Job is theirs (a link that
// dials it), getting in on the day, how many extras; then the extras' list
// and the crew, each a part of its own below. What this reader
// can't use yet isn't drawn at all: an offer has no Directions, door or
// number. Every action is one split button, the same at every stage: the
// main one pressed straight away, the rest behind its arrow (on site, Mark
// done is the main one). From md it ends the title row, and a slim header
// holding the title and the same button slides in at the top once that row
// scrolls away; there's no foot bar from md. On a phone it's in a foot bar,
// after the details (read, then decide), and its arrow opens a sheet from
// the bottom (&sheet=0: a menu opening upward, to compare).
// The extras and the crew: each a Section, its title and line on the page
// above an untitled card, as every part's title sits. The extras come
// first: they're the work itself, what to bring and how long it runs, and
// an offer's yes leans on them; the crew is who's beside you. The crew: one
// look for every face, a tick for confirmed and nothing for not yet; an
// open place is no face (OpenMark). "You" only once the reader has
// confirmed: on an offer the place they'd take is open, like any other.

// what each stage shows (a Cleaner's side of the Job's lifecycle)
const dStage = (k: Kind) =>
  isOffer(k)
    ? "offer"
    : k === "confirmed"
      ? "before"
      : finished(k)
        ? "after"
        : "day";

function statusD(
  c: JobCase,
  w: Words,
): { tone: StatusTone; text: string } | null {
  switch (c.kind) {
    case "offered":
    case "open":
      return { tone: "info", text: w.available };
    case "confirmed":
      return null; // the usual case on Your jobs
    case "today":
      return { tone: "info", text: w.today };
    case "started":
    case "startedWaiting":
      return { tone: "success", text: w.onSite };
    case "done":
      return { tone: "success", text: w.done };
    case "noAccess":
      return { tone: "danger", text: w.couldntGetIn };
  }
}

type DAction = {
  label: string;
  icon: typeof Lock;
  danger?: boolean;
  external?: boolean;
  isDisabled?: boolean;
} & ({ href: string } | { onPress: () => void });

// a DAction as an item of the arrow's menu
function menuItem(a: DAction) {
  return (
    <MenuItem
      key={a.label}
      icon={a.icon}
      danger={a.danger}
      {...("href" in a
        ? {
            href: a.href as unknown as AppHref,
            target: a.external ? "_blank" : undefined,
          }
        : { onAction: a.onPress })}
    >
      {a.label}
    </MenuItem>
  );
}

// those that undo something last, after a rule
const inOrder = (actions: DAction[]) => ({
  plain: actions.filter((a) => !a.danger),
  danger: actions.filter((a) => a.danger),
});

function menuItems(actions: DAction[]) {
  const { plain, danger } = inOrder(actions);
  return (
    <>
      {plain.map(menuItem)}
      {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
      {danger.map(menuItem)}
    </>
  );
}

// A phone's action sheet: rising from the bottom edge, the screen's width,
// a large row for each action, and Cancel last, apart (the ui kit's Dialog
// is a sheet on a phone too, but titled, with a ✕: this is just the choices)
function ActionSheet({
  label,
  cancel,
  actions,
}: {
  label: string;
  cancel: string;
  actions: DAction[];
}) {
  const { plain, danger } = inOrder(actions);
  const row =
    "flex min-h-14 w-full items-center gap-4 px-5 text-left text-lg font-semibold outline-none focus-visible:bg-surface-sunken active:bg-surface-sunken";
  const item = (close: () => void) => (a: DAction) => {
    const look = `${row} ${a.danger ? "text-danger" : "text-fg"}`;
    const body = (
      <>
        <a.icon aria-hidden size={22} className="shrink-0" />
        {a.label}
      </>
    );
    return "href" in a ? (
      <a
        key={a.label}
        href={a.href}
        target={a.external ? "_blank" : undefined}
        rel={a.external ? "noreferrer" : undefined}
        className={look}
        onClick={close}
      >
        {body}
      </a>
    ) : (
      <button
        key={a.label}
        type="button"
        className={look}
        onClick={() => {
          close();
          a.onPress();
        }}
      >
        {body}
      </button>
    );
  };
  return (
    <ModalOverlay
      isDismissable
      className="fixed inset-0 z-50 flex items-end bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out"
    >
      <Modal className="w-full rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom exiting:animate-out exiting:slide-out-to-bottom">
        <AriaDialog
          aria-label={label}
          className="flex flex-col pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] outline-none"
        >
          {({ close }) => (
            <>
              {plain.map(item(close))}
              {plain.length > 0 && danger.length > 0 && (
                <hr className="my-1 border-border" />
              )}
              {danger.map(item(close))}
              <div className="mt-2 border-t border-border px-4 pt-3">
                <Button
                  variant="secondary"
                  onPress={close}
                  className="min-h-14 w-full text-lg"
                >
                  {cancel}
                </Button>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// how the arrow opens the rest: a menu below it (from md, at the top of the
// page), above it (a phone's foot bar, to compare), or a sheet (a phone)
type Opens = "down" | "up" | "sheet";

// A split button, the page's one action control: the main action pressed
// straight away, and an arrow, named for what it holds, opening the rest
function SplitButton({
  main,
  more,
  w,
  opens,
}: {
  main: DAction;
  more: DAction[];
  w: Words;
  opens: Opens;
}) {
  const joined = more.length > 0 ? "rounded-r-none" : "";
  const content = (
    <>
      <main.icon aria-hidden size={18} />
      {main.label}
    </>
  );
  const first =
    "href" in main ? (
      <ButtonLink
        href={main.href as unknown as AppHref}
        target={main.external ? "_blank" : undefined}
        rel={main.external ? "noreferrer" : undefined}
        className={`flex-1 ${joined}`}
      >
        {content}
      </ButtonLink>
    ) : (
      <Button
        onPress={main.onPress}
        isDisabled={main.isDisabled}
        className={`flex-1 ${joined}`}
      >
        {content}
      </Button>
    );
  const Chevron = opens === "down" ? ChevronDown : ChevronUp;
  const arrow = (
    <Button
      aria-label={w.moreActions}
      className="shrink-0 rounded-l-none border-l border-primary-fg/40 px-3"
    >
      <Chevron aria-hidden size={20} />
    </Button>
  );
  return (
    <div className="flex w-full md:w-auto">
      {first}
      {more.length > 0 &&
        (opens === "sheet" ? (
          <DialogTrigger>
            {arrow}
            <ActionSheet
              label={w.moreActions}
              cancel={w.cancel}
              actions={more}
            />
          </DialogTrigger>
        ) : (
          <MenuTrigger>
            {arrow}
            <AriaPopover
              placement={opens === "down" ? "bottom end" : "top end"}
              offset={4}
              className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95"
            >
              <AriaMenu className="outline-none">{menuItems(more)}</AriaMenu>
            </AriaPopover>
          </MenuTrigger>
        ))}
    </div>
  );
}

// the page's actions, for this stage: the main one, then the rest. Calling
// the Client isn't here: their number is a link on the card
function actionsD(c: JobCase, j: J): { main: DAction; more: DAction[] } | null {
  const { w } = j;
  const callOffice: DAction = {
    label: w.callOffice,
    icon: Phone,
    href: `tel:${OFFICE}`,
  };
  const directions: DAction = {
    label: w.directions,
    icon: Navigation,
    href: directionsTo(j.address),
    external: true,
  };
  switch (c.kind) {
    case "offered":
    case "open":
      return {
        main: {
          label: w.confirm,
          icon: Check,
          onPress: say(w.toast(w.confirm)),
        },
        more: [
          { label: w.notForMe, icon: X, onPress: say(w.toast(w.notForMe)) },
        ],
      };
    case "confirmed":
      return {
        main: directions,
        more: [
          callOffice,
          ...(c.canDropOut
            ? [
                {
                  label: w.dropOut,
                  icon: UserMinus,
                  danger: true,
                  onPress: say(w.toast(w.dropOut)),
                },
              ]
            : []),
        ],
      };
    case "today":
      return { main: directions, more: [callOffice] };
    case "started":
    case "startedWaiting":
      return {
        // waiting on Dee, it waits too: the notice says to call the office
        main: {
          label: w.markDone,
          icon: CircleCheck,
          isDisabled: c.kind === "startedWaiting",
          onPress: say(w.toast(w.markDone)),
        },
        more: [
          {
            label: w.couldntGetIn,
            icon: DoorClosed,
            onPress: say(w.toast(w.couldntGetIn)),
          },
          // waiting on Dee, the office is in the notice that says so
          ...(c.kind === "started" ? [callOffice] : []),
        ],
      };
    case "done":
    case "noAccess":
      return null; // nothing left to do
  }
}

// An open place: a ghost of a face, the faces' own person drawn faint and
// thin in a dashed ring, no fill (dashing the person too broke its head
// into crumbs at this size): unfilled where a face is a filled disc, its
// line thin, its word quiet where a name is bold
function OpenMark() {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-fg-muted"
    >
      <UserRound size={22} strokeWidth={1.5} className="opacity-60" />
    </span>
  );
}

// a face: every one the same, a tick when they've confirmed, nothing yet.
// An open place isn't a face: its mark the face's size, its word quiet
function CrewFace({ m, w }: { m: Member; w: Words }) {
  if (!m)
    return (
      <span className="inline-flex items-center gap-2">
        <OpenMark />
        <span className="text-fg-muted">
          {w.open}
          <span className="sr-only">, {w.seatOpen}</span>
        </span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <Avatar />
        {m.confirmed && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-success-strong text-surface ring-2 ring-surface"
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="font-semibold text-fg">
        {m.you ? w.you : m.name}
        <span className="sr-only">
          , {m.confirmed ? w.confirmed : w.notYet}
        </span>
      </span>
    </span>
  );
}

function JobCardD({ c, j }: { c: JobCase; j: J }) {
  const { w } = j;
  const stage = dStage(c.kind);
  const theirs = stage !== "offer"; // the number, once the Job is theirs
  return (
    <Card hiddenTitle={w.jobDetails}>
      <div className="flex items-center gap-4">
        <DateTile date={c.startsAt} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-2xl font-semibold text-fg tabular-nums">
            {j.range}
          </p>
          <p className="text-fg [overflow-wrap:anywhere]">
            {addressShown(c.kind) ? j.address : w.zip(c.postcode)}
          </p>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <Facts>
          <Fact icon={Clock} label={w.howLong} value={j.howLong} />
          <Fact icon={UserRound} label={w.client} value={j.clientName} />
          {theirs && (
            <Fact
              icon={Phone}
              label={w.clientsNumber}
              value={
                <a
                  href={`tel:+1${j.phone.replace(/\D/g, "")}`}
                  className={`${linkStyles()} tabular-nums`}
                >
                  {j.phone}
                </a>
              }
            />
          )}
          {stage === "day" && (
            <Fact
              icon={KeyRound}
              label={w.gettingIn}
              // a long note takes the card's width
              className={c.door ? "col-span-full" : undefined}
              value={
                <span className="text-lg font-semibold">
                  {c.door?.[j.lang] ?? w.door4b}
                </span>
              }
            />
          )}
          {/* the count alone: the signpost to their list below */}
          {c.extras.length > 0 && (
            <Fact
              icon={CirclePlus}
              label={w.extras}
              value={w.extrasCount(c.extras.length)}
              line={w.listedBelow}
            />
          )}
        </Facts>
      </div>
    </Card>
  );
}

// the extras, a part of their own below the details, built as the crew
// is: the title and a line counting them on the page, an untitled card
// under them listing one a line, so they're read down and counted at a
// glance. None, no part
function ExtrasD({ c, j }: { c: JobCase; j: J }) {
  const { w } = j;
  if (c.extras.length === 0) return null;
  return (
    <Section title={w.extras} description={w.extrasLine(c.extras.length)}>
      <Card>
        <ul className="-my-3 divide-y divide-border">
          {j.extras.map((x) => (
            <li key={x} className="py-3 text-fg">
              {x}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

// the crew, a part of its own below the details: its title and a line
// saying where it stands on the page, the faces in a card under them. The
// reader is "You" once they've confirmed; till then (an offer) the place
// they'd take is open
function CrewD({ c, w }: { c: JobCase; w: Words }) {
  const places = c.crew.map((m) => (m?.you && !m.confirmed ? null : m));
  const confirmed = places.filter((m) => m?.confirmed).length;
  const open = places.filter((m) => !m).length;
  return (
    <Section
      title={w.crew}
      description={w.crewLine(confirmed, places.length, open)}
    >
      <Card>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {places.map((m, i) => (
            <CrewFace key={i} m={m} w={w} />
          ))}
        </div>
      </Card>
    </Section>
  );
}

// the main column and the right one a Record keeps from xl (its History),
// as RecordPage's Beside lays them out
const columns =
  "grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]";

// a phone's bar at the foot, above the tab bar; none from md
function FootBarD({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20 md:hidden print:hidden" />
      <div
        role="group"
        aria-label={label}
        className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] z-30 flex border-t border-border bg-surface px-4 py-3 shadow-raised md:hidden print:hidden"
      >
        {children}
      </div>
    </>
  );
}

// From md, the slim header that slides in at the top once the title row's
// button has scrolled away: the title and the same split button, its box
// lined up with the main column as the card is
function StickyHeadD({
  shown,
  title,
  status,
  children,
}: {
  shown: boolean;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 hidden transition duration-200 md:left-64 md:block print:hidden ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto w-full max-w-5xl px-8">
        <div className={columns}>
          <div className="pointer-events-auto flex items-center gap-3 rounded-b-lg border-x border-b border-border bg-surface px-4 py-2 shadow-raised">
            <p className="truncate font-display text-xl font-bold tracking-wide uppercase">
              {title}
            </p>
            {status}
            <span className="ml-auto flex">{children}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// whether the element has scrolled up out of view (and not merely hidden,
// as the title row's button is on a phone)
function useScrolledAway() {
  const ref = useRef<HTMLSpanElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const watch = new IntersectionObserver(([e]) =>
      setAway(!!e && !e.isIntersecting && e.boundingClientRect.bottom < 1),
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, away] as const;
}

function LayoutD({ c, j, sheet }: { c: JobCase; j: J; sheet: boolean }) {
  const { w } = j;
  const s = statusD(c, w);
  const actions = actionsD(c, j);
  const [headRef, away] = useScrolledAway();
  const split = (opens: Opens) =>
    actions && (
      <SplitButton
        main={actions.main}
        more={actions.more}
        w={w}
        opens={opens}
      />
    );
  const badge = s && <StatusBadge tone={s.tone}>{s.text}</StatusBadge>;
  const job = (
    <>
      <JobCardD c={c} j={j} />
      <ExtrasD c={c} j={j} />
      <CrewD c={c} w={w} />
    </>
  );
  // the whole page in the main column, the header's actions too, so they
  // end where the card does. RecordPage places the header and the alerts
  // (from md the split button rides its status slot, pushed to the end of
  // the title row); the card and the crew follow it here, in the main
  // column, as RecordPage has no slot for a header that narrow. Its empty
  // Beside is hidden, so it leaves no gap
  return (
    <div className={columns}>
      <div className="flex min-w-0 flex-col gap-6 [&_.grid:has(>div:empty)]:hidden">
        <RecordPage
          trail={trailFor(c, j)}
          title={j.service}
          status={
            <>
              {badge}
              {actions && (
                <span ref={headRef} className="ml-auto flex max-md:hidden">
                  {split("down")}
                </span>
              )}
            </>
          }
          subtitle={c.kind === "open" ? w.firstToConfirm : undefined}
          alerts={alertsFor(c, j)}
        />
        <div className="flex min-w-0 flex-col gap-6">
          {finished(c.kind) ? (
            <>
              <Outcome c={c} j={j} />
              <Fold label={w.theJob}>
                <div className="flex flex-col gap-6">{job}</div>
              </Fold>
            </>
          ) : (
            job
          )}
        </div>
        {actions && (
          <>
            <StickyHeadD shown={away} title={j.service} status={badge}>
              {split("down")}
            </StickyHeadD>
            {/* on a phone, the page's primary after the details: read,
                then decide */}
            <FootBarD label={w.whatToDo}>
              {split(sheet ? "sheet" : "up")}
            </FootBarD>
          </>
        )}
      </div>
    </div>
  );
}

// ---- the page ----

function Layout({
  c,
  layout,
  lang,
  sheet,
}: {
  c: JobCase;
  layout: LayoutKey;
  lang: Language;
  sheet: boolean;
}) {
  const j = useJob(c, lang);
  if (layout === "B") return <LayoutB c={c} j={j} />;
  if (layout === "C") return <LayoutC c={c} j={j} />;
  if (layout === "D") return <LayoutD c={c} j={j} sheet={sheet} />;
  return <LayoutA c={c} j={j} />;
}

export function CleanerJobPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
    lang?: string;
    sheet?: string | number;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? cases[0]!;
  const lang: Language = search.lang === "es" ? "es" : "en";
  // D on a phone: its arrow opens a sheet; &sheet=0, a menu upward
  const sheet = String(search.sheet) !== "0";
  // the root sets the signed-out language on every navigation: say ours again
  useEffect(() => setAppLanguage(lang));
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/cleaner-job",
      search: {
        case: c.key,
        layout,
        lang,
        ...(sheet ? {} : { sheet: "0" }),
        ...change,
      },
      replace: true,
    });

  // D's sticky header takes the top from md, and it has no foot bar there:
  // the switchers go to the foot
  const atFoot = layout === "D";
  const navLabel = isOffer(c.kind) ? W[lang].offers : W[lang].yourJobs;
  const nav: NavItem[] = navFor(lang).cleaner.map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === navLabel,
    }),
  );
  return (
    <LanguageProvider lang={lang}>
      <AppLayout area={areaLabels[lang].cleaner} nav={nav} foot={() => null}>
        {/* room for the switchers, so they cover nothing of the page at rest */}
        <div aria-hidden className={`h-24 ${atFoot ? "md:h-0" : ""}`} />
        <p className="mb-4 text-sm text-fg-muted">
          {layout}: {layouts.find((l) => l.key === layout)!.name}
        </p>
        <Layout
          key={`${c.key}-${layout}-${lang}`}
          c={c}
          layout={layout}
          lang={lang}
          sheet={sheet}
        />
        {atFoot && <div aria-hidden className="hidden h-28 md:block" />}
        <PrototypeSwitcher
          variants={layouts.map((l) => ({ key: l.key, name: l.name }))}
          current={layout}
          onChange={(k) => go({ layout: k })}
          keys={["ArrowUp", "ArrowDown"]}
          className={`top-16 ${atFoot ? "md:top-auto md:bottom-16" : "md:top-3"}`}
        />
        <PrototypeSwitcher
          variants={cases.map((x) => ({ key: x.key, name: x.name }))}
          current={c.key}
          onChange={(k) => go({ case: k })}
          className={`top-28 ${atFoot ? "md:top-auto md:bottom-4" : "md:top-15"}`}
        />
      </AppLayout>
    </LanguageProvider>
  );
}

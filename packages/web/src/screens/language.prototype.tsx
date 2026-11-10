// PROTOTYPE: throwaway. Where does a person change their Preferred Language
// (#305, ADR-0025: one person, one language, written on every Client and
// Staff record their Account is connected to)? On made-up data at
// /prototype/language?case=&layout= (no sign-in). ↑/↓ switch layouts, ←/→
// cases. Picking a language really switches the screen (nothing is sent).
// Lives only on prototype-language-control.
//
// A: the Cleaner area's Account menu; the portal keeps its field on Your
//    details (today, #303).
// B: the Account menu in both areas, beside Show tips again; the field on
//    Your details goes.
// C: a small Your details page in the Cleaner area, as the portal's (a third
//    nav item); no menu control.
// D and E: the other language named in its own words (Español / English), one tap,
//    beside the Account button in both areas, as the landing site's header
//    switch: found by someone who can't read the language the screen is in.
//    The field on Your details goes.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  CalendarDays,
  Lightbulb,
  LogOut,
  House,
  Inbox,
  Languages,
  Mail,
  Phone,
  Sparkles,
  SquarePen,
  User,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  catalog,
  type Language,
  LANGUAGES,
  languageNames,
} from "@empire-cleaning/models";
import {
  Actions,
  AppLayout,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  IconTile,
  LanguageProvider,
  List,
  ListItem,
  type NavItem,
  Section,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  showToast,
  StatusBadge,
  TextField,
  ThemeToggle,
} from "@empire-cleaning/ui";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { said } from "./words.ts";
import { areaLabels } from "../session.ts";
import { words as accountWords } from "./AreaLayout.tsx";
import { portalWords } from "./portal/words.ts";
import { words as detailsWords } from "./portal/PortalDetails.tsx";
import { words as homeWords } from "./portal/whats-next.ts";
import { words as propertyWords } from "./portal/PortalProperty.tsx";

type Area = "portal" | "cleaner";
type View = "home" | "menu" | "details";
type Case = {
  key: string;
  name: string;
  area: Area;
  lang: Language;
  view: View;
  // a Cleaner who is a Client too: the menu offers the other area
  both?: boolean;
  // shown in a phone-sized frame
  phone?: boolean;
};

const caseList: Omit<Case, "key">[] = [
  { area: "portal", lang: "en", view: "home", name: "Portal · English · Home" },
  {
    area: "portal",
    lang: "en",
    view: "menu",
    name: "Portal · English · menu open",
  },
  {
    area: "portal",
    lang: "en",
    view: "details",
    name: "Portal · English · Your details",
  },
  {
    area: "portal",
    lang: "es",
    view: "menu",
    name: "Portal · Spanish · menu open",
  },
  {
    area: "portal",
    lang: "es",
    view: "details",
    name: "Portal · Spanish · Your details",
  },
  {
    area: "cleaner",
    lang: "en",
    view: "home",
    name: "Cleaner · English · Your jobs",
  },
  {
    area: "cleaner",
    lang: "en",
    view: "menu",
    name: "Cleaner · English · menu open",
  },
  {
    area: "cleaner",
    lang: "en",
    view: "details",
    name: "Cleaner · English · Your details",
  },
  {
    area: "cleaner",
    lang: "es",
    view: "menu",
    name: "Cleaner · Spanish · menu open",
  },
  {
    area: "cleaner",
    lang: "es",
    view: "details",
    name: "Cleaner · Spanish · Your details",
  },
  {
    area: "cleaner",
    lang: "en",
    view: "menu",
    both: true,
    name: "Cleaner who's a Client too · menu open",
  },
  {
    area: "cleaner",
    lang: "es",
    view: "home",
    phone: true,
    name: "Phone · Cleaner · Spanish · Your jobs",
  },
  {
    area: "cleaner",
    lang: "es",
    view: "menu",
    phone: true,
    name: "Phone · Cleaner · Spanish · menu open",
  },
  {
    area: "portal",
    lang: "en",
    view: "details",
    phone: true,
    name: "Phone · Portal · English · Your details",
  },
  {
    area: "portal",
    lang: "es",
    view: "menu",
    phone: true,
    name: "Phone · Portal · Spanish · menu open",
  },
  {
    area: "cleaner",
    lang: "en",
    view: "menu",
    both: true,
    phone: true,
    name: "Phone · Cleaner who's a Client too · menu open",
  },
];
const cases: Case[] = caseList.map((c, i) => ({ ...c, key: String(i + 1) }));

const layouts = [
  { key: "A", name: "Menu in the Cleaner area only" },
  { key: "B", name: "Menu in both, field gone" },
  { key: "C", name: "Your details in the Cleaner area" },
  { key: "D", name: "Español / English beside Account" },
  { key: "E", name: "D, and on a phone everything in ☰" },
];

// where the control is, in each layout
const where = (layout: string, area: Area) => ({
  menu: layout === "B" || (layout === "A" && area === "cleaner"),
  details:
    area === "portal" ? layout === "A" || layout === "C" : layout === "C",
  button: layout === "D" || layout === "E",
  // E: on a phone, no tab bar or account button: nav, language and account
  // all in the ☰ menu, as the Office's phone menu
  phoneMenu: layout === "E",
  cleanerDetailsPage: layout === "C",
});

// the prototype's own words; the rest come from the screens' catalogs
const own = catalog({
  en: {
    yourJobs: "Your jobs",
    offers: "Offers (2)",
    languageBoth: "Your screens and emails, in the Client portal too",
    changed: "Language changed",
    hi: "Hi, Casey",
    weekly: "Weekly plan, Tuesdays",
    cleanerLine: "From the Office. Ask them to change your name or phone.",
    yourLanguage: "Your language",
    comingUp: "Coming up",
    confirmed: "Confirmed",
    offered: "Offered",
    nextWhen: "Tue, Nov 17, 9:00 AM",
    job1: "Today, 9:00 AM",
    job2: "Thu, Nov 19, 1:00 PM",
    job3: "Fri, Nov 20, 9:00 AM",
  },
  es: {
    yourJobs: "Tus trabajos",
    offers: "Ofertas (2)",
    languageBoth: "Tus pantallas y correos, también en el portal del cliente",
    changed: "Idioma cambiado",
    hi: "Hola, Casey",
    weekly: "Plan semanal, los martes",
    cleanerLine: "De la oficina. Pídeles que cambien tu nombre o teléfono.",
    yourLanguage: "Tu idioma",
    comingUp: "Próximos",
    confirmed: "Confirmado",
    offered: "Ofrecido",
    nextWhen: "mar., 17 de nov., 9:00 a. m.",
    job1: "Hoy, 9:00 a. m.",
    job2: "jue., 19 de nov., 1:00 p. m.",
    job3: "vie., 20 de nov., 9:00 a. m.",
  },
});

const wordsIn = (lang: Language) => {
  const d = detailsWords[lang];
  const p = portalWords[lang];
  return {
    ...own[lang],
    portal: areaLabels[lang].portal,
    cleanerArea: areaLabels[lang].cleaner,
    home: p.home,
    cleans: p.cleans,
    payments: p.payments,
    yourDetails: p.yourDetails,
    yourHome: p.yourHome,
    cancel: p.cancel,
    account: accountWords[lang].account,
    switchTo: accountWords[lang].switchToArea,
    showTips: accountWords[lang].showTips,
    signOut: said[lang].signOut,
    email: said[lang].email,
    active: said[lang].planStatus.active.label,
    booked: said[lang].jobStatusLabel.booked,
    today: homeWords[lang].today,
    nextClean: homeWords[lang].nextClean,
    saveLanguage: propertyWords[lang].save,
    language: d.language,
    languageLine: d.languageLine,
    contact: d.contact,
    edit: d.edit,
    name: d.name,
    phone: d.phone,
    whereQuotes: d.whereQuotes,
    oneHome: d.oneHome,
    yourContact: d.yourContact,
    fullName: d.fullName,
    languageNote: d.languageNote,
    save: d.saveDetails,
  };
};
const words = { en: wordsIn("en"), es: wordsIn("es") };

// the Cleaner area speaks tú where the portal's Spanish says usted
const cleanerSpanish: Partial<ReturnType<typeof wordsIn>> = {
  yourDetails: "Tus datos",
  languageLine: "Tus pantallas y correos",
  contact: "Tus datos de contacto",
  languageNote:
    "Te mostramos la aplicación y te enviamos los correos en este idioma.",
};

const wordsFor = (area: Area, lang: Language) =>
  area === "cleaner" && lang === "es"
    ? { ...words.es, ...cleanerSpanish }
    : words[lang];

// nav links go nowhere in the prototype
const here = "#" as unknown as NavItem["href"];

const people = {
  portal: {
    name: "Casey Morgan",
    email: "casey.morgan@example.com",
    phone: "(555) 201-4417",
  },
  cleaner: {
    name: "Maria Gonzalez",
    email: "maria.g@example.com",
    phone: "(555) 318-0922",
  },
};

export function LanguagePrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
    frame?: string;
  };
  const navigate = useNavigate();
  const key = search.case ?? "1";
  const layout = search.layout ?? "A";
  const go = (next: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/language",
      search: { case: key, layout, ...next } as never,
      replace: true,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;

  // inside the phone frame (390px): just the screen
  if (search.frame)
    return <Screen key={`${key}${layout}`} c={c} layout={layout} />;

  return (
    <>
      {c.phone ? (
        <div className="flex min-h-dvh items-start justify-center bg-surface-sunken p-6 pb-40">
          <iframe
            key={`${key}${layout}`}
            title="Phone"
            src={`/prototype/language?case=${c.key}&layout=${layout}&frame=1`}
            className="h-[780px] w-[390px] rounded-[2.5rem] border-8 border-fg bg-bg shadow-xl"
          />
        </div>
      ) : (
        <Screen key={`${key}${layout}`} c={c} layout={layout} />
      )}
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </>
  );
}

// one area's screen, in a language the person can change right there
function Screen({ c, layout }: { c: Case; layout: string }) {
  const [lang, setLang] = useState<Language>(c.lang);
  const w = wordsFor(c.area, lang);
  const at = where(layout, c.area);
  const change = (next: Language) => {
    if (next === lang) return;
    setLang(next);
    document.documentElement.lang = next;
    showToast({ tone: "success", title: words[next].changed });
  };

  const showsDetails =
    c.view === "details" && (c.area === "portal" || at.cleanerDetailsPage);
  const nav: NavItem[] =
    c.area === "portal"
      ? [
          { href: here, label: w.home, icon: House, isCurrent: !showsDetails },
          { href: here, label: w.cleans, icon: Sparkles },
          { href: here, label: w.payments, icon: Wallet },
          {
            href: here,
            label: w.yourDetails,
            icon: UserRound,
            isCurrent: showsDetails,
          },
        ]
      : [
          {
            href: here,
            label: w.yourJobs,
            icon: CalendarDays,
            isCurrent: !showsDetails,
          },
          { href: here, label: w.offers, icon: Inbox },
          ...(at.cleanerDetailsPage
            ? [
                {
                  href: here,
                  label: w.yourDetails,
                  icon: UserRound,
                  isCurrent: showsDetails,
                },
              ]
            : []),
        ];
  // E opens its ☰ menu in a "menu open" case, on a phone only
  const [menuOpen] = useState(
    () =>
      at.phoneMenu &&
      c.view === "menu" &&
      window.matchMedia("(max-width: 767px)").matches,
  );

  return (
    <LanguageProvider lang={lang}>
      <AppLayout
        area={c.area === "portal" ? w.portal : w.cleanerArea}
        nav={
          at.phoneMenu ? nav.map((item) => ({ ...item, inMenu: true })) : nav
        }
        atHome={!showsDetails}
        accountInMenu={at.phoneMenu}
        menuDefaultOpen={menuOpen}
        menuEnd={
          at.phoneMenu &&
          (({ close }) => (
            <MenuAccount c={c} lang={lang} close={close} onChange={change} />
          ))
        }
        account={
          <>
            {at.button && <OtherLanguage lang={lang} onChange={change} />}
            <AccountMenu
              c={c}
              lang={lang}
              hasControl={at.menu}
              onChange={change}
            />
          </>
        }
      >
        {c.view === "details" &&
          c.area === "cleaner" &&
          !at.cleanerDetailsPage && (
            <p className="mb-4 rounded-md border border-dashed border-border px-3 py-2 text-xs text-fg-muted">
              Layout {layout} has no Your details page in the Cleaner area: this
              is Your jobs.
            </p>
          )}
        {showsDetails ? (
          c.area === "portal" ? (
            <PortalDetails
              lang={lang}
              withField={at.details}
              onChange={change}
            />
          ) : (
            <CleanerDetails lang={lang} onChange={change} />
          )
        ) : c.area === "portal" ? (
          <PortalHome lang={lang} />
        ) : (
          <CleanerJobs lang={lang} />
        )}
      </AppLayout>
    </LanguageProvider>
  );
}

// D: the other language, named in its own words, one tap away
function OtherLanguage({
  lang,
  onChange,
}: {
  lang: Language;
  onChange: (lang: Language) => void;
}) {
  const other = LANGUAGES.find((l) => l !== lang)!;
  return (
    <Button
      variant="quiet"
      className="justify-start"
      onPress={() => onChange(other)}
    >
      <Languages aria-hidden size={20} />
      <span lang={other}>{languageNames[other]}</span>
    </Button>
  );
}

// E: the Account menu's parts at the foot of the phone's ☰ menu, the
// other language first among them
function MenuAccount({
  c,
  lang,
  close,
  onChange,
}: {
  c: Case;
  lang: Language;
  close: () => void;
  onChange: (lang: Language) => void;
}) {
  const w = wordsFor(c.area, lang);
  const other = LANGUAGES.find((l) => l !== lang)!;
  const person = people[c.area];
  return (
    <>
      <div className="flex items-center gap-3 px-3">
        <User aria-hidden size={20} className="shrink-0 text-fg-muted" />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{person.name}</span>
          <span className="truncate text-sm text-fg-muted">{person.email}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {c.both && (
          <Button variant="quiet" className="justify-start" onPress={close}>
            <ArrowRightLeft aria-hidden size={20} />
            {w.switchTo(words[lang].portal)}
          </Button>
        )}
        <Button
          variant="quiet"
          className="justify-start"
          onPress={() => onChange(other)}
        >
          <Languages aria-hidden size={20} />
          <span lang={other}>{languageNames[other]}</span>
        </Button>
        <Button variant="quiet" className="justify-start" onPress={close}>
          <Lightbulb aria-hidden size={20} />
          {w.showTips}
        </Button>
        <Button variant="quiet" className="justify-start" onPress={close}>
          <LogOut aria-hidden size={20} />
          {w.signOut}
        </Button>
      </div>
      <ThemeToggle />
    </>
  );
}

// the real Account menu's look (AreaLayout.tsx), with the language control
// above Show tips again where the layout puts it
function AccountMenu({
  c,
  lang,
  hasControl,
  onChange,
}: {
  c: Case;
  lang: Language;
  hasControl: boolean;
  onChange: (lang: Language) => void;
}) {
  const w = wordsFor(c.area, lang);
  const person = people[c.area];
  // AppLayout draws the account slot twice (sidebar, phone's top bar): only
  // the one on screen opens itself in a "menu open" case
  const marker = useRef<HTMLSpanElement>(null);
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    if (c.view === "menu" && marker.current?.offsetParent) setOpen(true);
  }, [c.view]);
  return (
    <>
      <span ref={marker} aria-hidden />
      <DialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
        <Button variant="quiet" className="justify-start">
          <User aria-hidden size={20} />
          <span className="max-md:sr-only">{person.name}</span>
        </Button>
        <Dialog title={w.account}>
          {({ close }) => (
            <>
              <div className="flex flex-col">
                <span className="font-semibold">{person.name}</span>
                <span className="text-fg-muted">{person.email}</span>
              </div>
              {c.both && (
                <List aria-label={w.account} onAction={() => {}}>
                  <ListItem
                    id="portal"
                    title={w.switchTo(words[lang].portal)}
                  />
                </List>
              )}
              {hasControl && (
                <SegmentedControl
                  label={w.language}
                  description={c.both ? w.languageBoth : w.languageLine}
                  value={lang}
                  onChange={(v) => onChange(v as Language)}
                >
                  {LANGUAGES.map((l) => (
                    <Segment key={l} value={l}>
                      <span lang={l}>{languageNames[l]}</span>
                    </Segment>
                  ))}
                </SegmentedControl>
              )}
              <Actions>
                <Button variant="quiet" onPress={close}>
                  {w.showTips}
                </Button>
                <Button variant="quiet" onPress={close}>
                  {w.signOut}
                </Button>
              </Actions>
            </>
          )}
        </Dialog>
      </DialogTrigger>
    </>
  );
}

function PortalHome({ lang }: { lang: Language }) {
  const w = words[lang];
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>{w.hi}</Heading>
      <Section title={w.nextClean}>
        <List aria-label={w.nextClean}>
          <ListItem
            id="next"
            start={<IconTile icon={Sparkles} />}
            title={w.nextWhen}
            description="12 Maple St"
            end={<StatusBadge tone="success">{w.booked}</StatusBadge>}
          />
        </List>
      </Section>
    </div>
  );
}

function CleanerJobs({ lang }: { lang: Language }) {
  const w = wordsFor("cleaner", lang);
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {w.yourJobs}
      </Heading>
      <Section title={w.today}>
        <List aria-label={w.today}>
          <ListItem
            id="1"
            start={<IconTile icon={CalendarDays} />}
            title={w.job1}
            description="Helen Kowalski · 41 Oak Ave"
            end={<StatusBadge tone="success">{w.confirmed}</StatusBadge>}
          />
        </List>
      </Section>
      <Section title={w.comingUp}>
        <List aria-label={w.comingUp}>
          <ListItem
            id="2"
            start={<IconTile icon={CalendarDays} />}
            title={w.job2}
            description="Grace Lee · 7 Birch Rd"
            end={<StatusBadge tone="success">{w.confirmed}</StatusBadge>}
          />
          <ListItem
            id="3"
            start={<IconTile icon={CalendarDays} />}
            title={w.job3}
            description="Bell Blvd Pediatrics · 300 Bell Blvd"
            end={<StatusBadge tone="info">{w.offered}</StatusBadge>}
          />
        </List>
      </Section>
    </div>
  );
}

// the portal's Your details (PortalDetails.tsx), with or without Language
function PortalDetails({
  lang,
  withField,
  onChange,
}: {
  lang: Language;
  withField: boolean;
  onChange: (lang: Language) => void;
}) {
  const w = words[lang];
  const p = people.portal;
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {w.yourDetails}
      </Heading>
      <Section
        title={w.contact}
        actions={
          <EditPortalContact
            lang={lang}
            withField={withField}
            onChange={onChange}
          />
        }
      >
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <FactRow icon={UserRound} value={p.name} line={w.name} />
            <FactRow icon={Mail} value={p.email} line={w.whereQuotes} />
            <FactRow icon={Phone} value={p.phone} line={w.phone} />
            {withField && (
              <FactRow
                icon={Languages}
                value={languageNames[lang]}
                line={w.languageLine}
              />
            )}
          </dl>
        </Card>
      </Section>
      <Section title={w.yourHome} description={w.oneHome}>
        <List aria-label={w.yourHome}>
          <ListItem
            id="home"
            start={<IconTile icon={House} />}
            title="12 Maple St, Austin, TX"
            description={w.weekly}
            end={<StatusBadge tone="success">{w.active}</StatusBadge>}
          />
        </List>
      </Section>
    </div>
  );
}

function EditPortalContact({
  lang,
  withField,
  onChange,
}: {
  lang: Language;
  withField: boolean;
  onChange: (lang: Language) => void;
}) {
  const w = words[lang];
  const p = people.portal;
  const [picked, setPicked] = useState<Language>(lang);
  return (
    <DialogTrigger>
      <Button variant="text">
        <SquarePen aria-hidden size={18} />
        {w.edit}
      </Button>
      <Dialog title={w.yourContact}>
        {({ close }) => (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              close();
              onChange(picked);
            }}
          >
            <TextField label={w.fullName} defaultValue={p.name} />
            <TextField label={w.email} type="email" defaultValue={p.email} />
            <TextField label={w.phone} type="tel" defaultValue={p.phone} />
            {withField && (
              <LanguageSelect
                label={w.language}
                note={w.languageNote}
                value={picked}
                onChange={setPicked}
              />
            )}
            <Actions>
              <Button variant="quiet" onPress={close}>
                {w.cancel}
              </Button>
              <Button type="submit">{w.save}</Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// C: the Cleaner's own details, read first; only the language is theirs to
// change (the Office keeps the rest)
function CleanerDetails({
  lang,
  onChange,
}: {
  lang: Language;
  onChange: (lang: Language) => void;
}) {
  const w = wordsFor("cleaner", lang);
  const p = people.cleaner;
  const [picked, setPicked] = useState<Language>(lang);
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {w.yourDetails}
      </Heading>
      <Section
        title={w.contact}
        description={w.cleanerLine}
        actions={
          <DialogTrigger>
            <Button variant="text">
              <SquarePen aria-hidden size={18} />
              {w.edit}
            </Button>
            <Dialog title={w.yourLanguage}>
              {({ close }) => (
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    close();
                    onChange(picked);
                  }}
                >
                  <LanguageSelect
                    label={w.language}
                    note={w.languageNote}
                    value={picked}
                    onChange={setPicked}
                  />
                  <Actions>
                    <Button variant="quiet" onPress={close}>
                      {w.cancel}
                    </Button>
                    <Button type="submit">{w.saveLanguage}</Button>
                  </Actions>
                </Form>
              )}
            </Dialog>
          </DialogTrigger>
        }
      >
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <FactRow icon={UserRound} value={p.name} line={w.name} />
            <FactRow icon={Mail} value={p.email} line={w.email} />
            <FactRow icon={Phone} value={p.phone} line={w.phone} />
            <FactRow
              icon={Languages}
              value={languageNames[lang]}
              line={w.languageLine}
            />
          </dl>
        </Card>
      </Section>
    </div>
  );
}

function LanguageSelect({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <Select
      label={label}
      description={note}
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as Language)}
    >
      {LANGUAGES.map((l) => (
        <SelectItem key={l} id={l} textValue={languageNames[l]}>
          <span lang={l}>{languageNames[l]}</span>
        </SelectItem>
      ))}
    </Select>
  );
}

// Fact.tsx's shape (an icon, a value, a muted line)
function FactRow({
  icon: Icon,
  value,
  line,
}: {
  icon: LucideIcon;
  value: ReactNode;
  line: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] content-start gap-x-3">
      <Icon aria-hidden size={20} className="row-span-2 mt-0.5 text-fg-muted" />
      <dt className="sr-only">{line}</dt>
      <dd className="font-semibold [overflow-wrap:anywhere]">{value}</dd>
      <dd className="text-sm text-fg-muted">{line}</dd>
    </div>
  );
}

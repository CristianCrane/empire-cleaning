import {
  Outlet,
  useMatchRoute,
  useNavigate,
  useRouteContext,
  useRouter,
  useRouterState,
  trimPathRight,
} from "@tanstack/react-router";
import {
  ArrowRightLeft,
  CalendarDays,
  ContactRound,
  House,
  Inbox,
  Languages,
  Lightbulb,
  LogOut,
  Sparkles,
  Tag,
  LayoutDashboard,
  User,
  UserRound,
  Wallet,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type {
  CleanerJobs,
  CleanerNeeded,
  SignedInAccount,
} from "@empire-cleaning/models";
import {
  AppLayout,
  Button,
  type FootPlace,
  Notice,
  type NavItem,
  RailButton,
  useLanguage,
  LanguageName,
} from "@empire-cleaning/ui";
import {
  catalog,
  type CleanerJob,
  type Language,
  LANGUAGES,
} from "@empire-cleaning/models";
import { deleteJson, getJson, putJson } from "../api.ts";
import { useLoaded } from "./load.ts";
import { linkTo, sameHref, type AppHref } from "../links.ts";
import { JobIcon, QuoteIcon } from "./icons.ts";
import {
  areaLabels,
  areas,
  areasFor,
  forgetAccount,
  signOut,
  type AreaId,
} from "../session.ts";
import { useAction } from "./action.ts";
import { useTours } from "./run-tours.ts";
import { cleanerWords } from "./cleaner/words.ts";
import { portalWords } from "./portal/words.ts";
import { offersCount } from "./cleaner/CleanerOffers.tsx";
import { jobSection, type JobSection } from "./cleaner/CleanerJobScreen.tsx";
import { said } from "./words.ts";

// the account's words, among the account's parts (AccountFoot), in every
// area's language (ADR-0025): said to Clients and Cleaners alike, so their
// Spanish addresses no one, neither usted nor tú (docs/ux-words.md, Language)
const words = catalog({
  en: {
    switchToArea: (area: string) => `Switch to ${area}`,
    showTips: "Show tips again",
    tipsBack: "Tips will show again",
    tipsFailed: "Couldn't bring the tips back. Try again.",
    languageFailed: "Couldn't change the language. Try again.",
  },
  es: {
    switchToArea: (area: string) => `Cambiar a ${area}`,
    showTips: "Volver a mostrar consejos",
    tipsBack: "Los consejos se volverán a mostrar",
    tipsFailed:
      "No se pudieron volver a mostrar los consejos. Se puede intentar de nuevo.",
    languageFailed: "No se pudo cambiar el idioma. Se puede intentar de nuevo.",
  },
});

// an item is current on its own page, and on the pages that belong to its
// section (alsoCurrentFor: URL prefixes), e.g. a Quote reached from Quotes;
// a Cleaner's Job is under the section its crumbs start at (jobSection);
// the Cleaner's Offers carries how many wait on their answer (countsOffers)
type AreaNavItem = NavItem & {
  alsoCurrentFor?: string[];
  jobSection?: JobSection;
  countsOffers?: boolean;
};

// each area's navigation; feature tickets add their screens here. A phone's
// tab bar holds five at most: the Office keeps the two it checks all day
// there, the rest in its ☰ menu (#200). The Office's sections come in
// groups of related ones, the busiest first. The portal's and the Cleaner
// area's are in their person's language; the Office's English
const navFor = (lang: Language): Record<AreaId, AreaNavItem[]> => ({
  office: [
    { href: linkTo({ to: "/office" }), label: "Today", icon: LayoutDashboard },
    {
      href: linkTo({ to: "/office/schedule" }),
      label: "Schedule",
      icon: CalendarDays,
    },
    {
      href: linkTo({ to: "/office/jobs" }),
      label: "Jobs",
      icon: JobIcon,
      inMenu: true,
      group: "Work",
      alsoCurrentFor: ["/office/jobs/"],
    },
    {
      href: linkTo({ to: "/office/quotes" }),
      label: "Quotes",
      icon: QuoteIcon,
      inMenu: true,
      group: "Work",
      alsoCurrentFor: ["/office/quotes/"],
    },
    {
      href: linkTo({ to: "/office/clients" }),
      label: "Clients",
      icon: ContactRound,
      inMenu: true,
      group: "People",
      // and what's under a Client's home, as its crumbs say
      alsoCurrentFor: [
        "/office/clients/",
        "/office/properties",
        "/office/bills/",
        "/office/site-visits/",
        "/office/service-plans/",
      ],
    },
    {
      href: linkTo({ to: "/office/staff" }),
      label: "Staff",
      icon: Users,
      inMenu: true,
      group: "People",
      alsoCurrentFor: ["/office/staff/"],
    },
    {
      href: linkTo({ to: "/office/services" }),
      label: "Services",
      icon: Sparkles,
      inMenu: true,
      group: "Pricing",
      alsoCurrentFor: ["/office/services/"],
    },
    {
      href: linkTo({ to: "/office/price-list" }),
      label: "Prices",
      icon: Tag,
      inMenu: true,
      group: "Pricing",
    },
  ],
  cleaner: [
    {
      href: linkTo({ to: "/cleaner" }),
      label: cleanerWords[lang].yourJobs,
      icon: CalendarDays,
      jobSection: "yourJobs",
    },
    {
      href: linkTo({ to: "/cleaner/offers" }),
      label: cleanerWords[lang].offers,
      icon: Inbox,
      alsoCurrentFor: ["/cleaner/open/"],
      jobSection: "offers",
      countsOffers: true,
    },
  ],
  portal: [
    {
      href: linkTo({ to: "/portal" }),
      label: portalWords[lang].home,
      icon: House,
      alsoCurrentFor: ["/portal/request", "/portal/quotes"],
    },
    {
      href: linkTo({ to: "/portal/cleans" }),
      label: portalWords[lang].cleans,
      icon: Sparkles,
      alsoCurrentFor: ["/portal/jobs/"],
    },
    {
      href: linkTo({ to: "/portal/payments" }),
      label: portalWords[lang].payments,
      icon: Wallet,
      alsoCurrentFor: ["/portal/payment-method", "/portal/bills/"],
    },
    {
      href: linkTo({ to: "/portal/details" }),
      label: portalWords[lang].yourDetails,
      icon: UserRound,
      // and a home and its plan, as their crumbs say
      alsoCurrentFor: ["/portal/properties/", "/portal/plans/"],
    },
  ],
});

export function AreaLayout({ area }: { area: AreaId }) {
  const { account } = useRouteContext({ from: areas[area].path });
  // the page on show, where the router has drawn: while the next page
  // loads the old one stays, so its section stays current (matchRoute
  // reads this one too), and the next page's is current once it shows
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  // a press that leaves this page, its next one still loading. Not a change
  // within the page (a search, a Tab, the Schedule's week), which leaves it
  // usable as it reloads, nor a reload of this page after a save or on
  // returning to the tab: those keep their path (#454). Over once the next
  // page is drawn, in the render that draws it, so what it focuses as it
  // mounts isn't inside the old page's out-of-reach frame. A home's route
  // is its area's index, drawn at "/office/" for the address "/office", so
  // both are read without a trailing slash
  const loading = useRouterState({
    select: (s) =>
      s.status === "pending" &&
      trimPathRight(s.location.pathname) !==
        trimPathRight(s.matches.at(-1)?.pathname ?? ""),
  });
  const offers = useOffersCount(area === "cleaner", pathname);
  // the Cleaner's Job on screen, if it is, for the section it's under
  const cleanerJob = useRouterState({
    select: (s) =>
      s.matches.find((m) => m.fullPath === "/cleaner/jobs/$jobId")
        ?.loaderData as CleanerJob | undefined,
  });
  useTours(area, account);
  const lang = useLanguage();
  const nav: NavItem[] = navFor(lang)[area].map(
    ({ alsoCurrentFor = [], jobSection: section, countsOffers, ...item }) => {
      return {
        ...item,
        label:
          countsOffers && offers > 0
            ? cleanerWords[lang].offersCount(offers)
            : item.label,
        isCurrent:
          Boolean(matchRoute(item.href)) ||
          alsoCurrentFor.some((prefix) => pathname.startsWith(prefix)) ||
          (!!cleanerJob && !!section && jobSection(cleanerJob) === section),
      };
    },
  );

  // every area's account parts are at the foot of the sidebar, of the ☰
  // menu on a phone (#305), and of the rail between them (#493). The areas that follow the person's language
  // offer the other one among them; the Office is English for good
  const own = area !== "office";
  // here, so the ☰ menu or the rail's Account stays open while an area
  // switches
  const footActions = useAccountActions(account, area);

  return (
    <AppLayout
      area={areaLabels[lang][area]}
      nav={nav}
      foot={({ close, place }) => (
        <AccountFoot
          account={account}
          actions={footActions}
          close={close}
          place={place}
          withLanguage={own}
        />
      )}
      menuBusy={footActions.switching !== undefined}
      loading={loading}
    >
      <Outlet />
    </AppLayout>
  );
}

// An area's real frame for a prototype's case (screens/Prototype.tsx),
// signed out: its navigation, in the language the case's LanguageProvider
// gives, with `current` the section on show, and no account at its foot, as
// a prototype has none
/** @public */
export function PrototypeFrame({
  area,
  current,
  children,
}: {
  area: AreaId;
  current: AppHref;
  children: ReactNode;
}) {
  const lang = useLanguage();
  const nav: NavItem[] = navFor(lang)[area].map(
    ({ alsoCurrentFor: _a, jobSection: _j, countsOffers: _c, ...item }) => ({
      ...item,
      isCurrent: sameHref(item.href, current),
    }),
  );
  return (
    <AppLayout area={areaLabels[lang][area]} nav={nav} foot={() => null}>
      {children}
    </AppLayout>
  );
}

// How many Jobs wait on a Cleaner's answer, offered or open to them, for
// Offers' label: so they're noticed without crowding Your Jobs. Counted
// again on each page, as answering one changes it; none if it can't be.
function useOffersCount(on: boolean, pathname: string) {
  // the last count stays while the next is counted, or if it can't be
  const { value } = useLoaded(
    on ? pathname : undefined,
    () =>
      Promise.all([
        getJson<CleanerJobs>("/api/assignments/mine"),
        getJson<CleanerNeeded[]>("/api/assignments/open"),
      ]).then(([mine, open]) => offersCount(mine, open)),
    { keep: true },
  );
  return value ?? 0;
}

// what the person can do with their Account, among the account's parts
// (AccountFoot): switch to their other area (Staff
// holding both roles, or a Cleaner who's a Client too), bring back
// first-time help's tours, and sign out
function useAccountActions(account: SignedInAccount, area: AreaId) {
  const navigate = useNavigate();
  const otherAreas = areasFor(account).filter((id) => id !== area);
  const lang = useLanguage();
  const w = { ...words[lang], signOut: said[lang].signOut };
  const action = useAction(w.tipsFailed);
  // the area being switched to, until it's on screen
  const [switching, setSwitching] = useState<AreaId>();

  // pressed before the area is ready, a ☰ menu or the rail's Account stays
  // open with the item
  // pending, and goes with this area as the new one shows. Still here once
  // the switch is over, it went nowhere new (a redirect back to this area,
  // or Back pressed meanwhile), so the menu closes itself
  const switchTo = async (id: AreaId, close: () => void) => {
    setSwitching(id);
    try {
      await navigate({ to: areas[id].path });
    } finally {
      setSwitching(undefined);
      close();
    }
  };

  // every screen's tour shows once more, as on a first visit
  const showTipsAgain = async (close: () => void) => {
    const ok = await action.run(async () => {
      await deleteJson("/api/me/tours");
      forgetAccount();
    }, w.tipsBack);
    if (ok) close();
  };

  const signOutHere = async (close: () => void) => {
    await signOut();
    close();
    void navigate({ to: "/sign-in" });
  };

  return {
    w,
    lang,
    otherAreas,
    switching,
    action,
    switchTo,
    showTipsAgain,
    signOutHere,
  };
}

// who's signed in, and what they can do with their Account, one plain item
// each, at the foot of the sidebar and of a phone's ☰ menu, the other
// language among them where the area follows it (#305). On the rail, from
// md to lg, the other language stays on the rail, one press away, and the
// rest is behind its Account (#493)
function AccountFoot({
  account,
  actions: a,
  close,
  place,
  withLanguage,
}: {
  account: SignedInAccount;
  actions: ReturnType<typeof useAccountActions>;
  close: () => void;
  place: FootPlace;
  // the other language, in an area that follows the person's
  withLanguage: boolean;
}) {
  // nothing here asks who's signed in again: a record connected meanwhile
  // shows on returning to the tab (main.tsx)
  const { w, switching } = a;

  if (place === "rail") return withLanguage && <OtherLanguage onRail />;
  return (
    <>
      <div className="flex items-center gap-3 px-3">
        <User aria-hidden size={20} className="shrink-0 text-fg-muted" />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{account.name}</span>
          <span className="truncate text-sm text-fg-muted">
            {account.email}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {withLanguage && place === "list" && (
          <OtherLanguage onChanged={close} />
        )}
        {a.otherAreas.map((id) => (
          <Button
            key={id}
            variant="quiet"
            className="justify-start"
            isPending={switching === id}
            isDisabled={switching !== undefined}
            onPress={() => void a.switchTo(id, close)}
          >
            <ArrowRightLeft aria-hidden size={20} />
            {w.switchToArea(areaLabels[a.lang][id])}
          </Button>
        ))}
        <Button
          variant="quiet"
          className="justify-start"
          isPending={a.action.isPending}
          isDisabled={switching !== undefined}
          onPress={() => void a.showTipsAgain(close)}
        >
          <Lightbulb aria-hidden size={20} />
          {w.showTips}
        </Button>
        <Button
          variant="quiet"
          className="justify-start"
          isDisabled={switching !== undefined}
          onPress={() => void a.signOutHere(close)}
        >
          <LogOut aria-hidden size={20} />
          {w.signOut}
        </Button>
      </div>
      {a.action.problem && <Notice tone="danger">{a.action.problem}</Notice>}
    </>
  );
}

// the other language, named in its own words (Español on an English screen,
// English on a Spanish one), one press away, so someone who can't read the
// screen's language still finds it (#305). It's the person's own choice,
// written on every Client and Staff member they are (ADR-0025); the area
// turns to it once the Account is asked for again. On the rail, its name
// under its icon, as the rail has no room beside it, and a failure said in
// a toast, as the rail has none for a notice
function OtherLanguage({
  onChanged,
  onRail = false,
}: {
  onChanged?: () => void;
  onRail?: boolean;
}) {
  const router = useRouter();
  const lang = useLanguage();
  const other = LANGUAGES.find((l) => l !== lang)!;
  const action = useAction(words[lang].languageFailed, { toast: onRail });

  const change = async () => {
    const ok = await action.run(async () => {
      await putJson("/api/me/language", { language: other });
      forgetAccount();
      await router.invalidate();
    });
    if (ok) onChanged?.();
  };

  const press = {
    isPending: action.isPending,
    onPress: () => void change(),
  };
  if (onRail) {
    return (
      <RailButton icon={Languages} {...press}>
        <LanguageName language={other} />
      </RailButton>
    );
  }
  return (
    <>
      <Button variant="quiet" className="justify-start" {...press}>
        <Languages aria-hidden size={20} />
        <LanguageName language={other} />
      </Button>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </>
  );
}

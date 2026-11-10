import {
  Outlet,
  useLocation,
  useMatchRoute,
  useNavigate,
  useRouteContext,
  useRouter,
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
import { useState } from "react";
import type {
  CleanerJobs,
  CleanerNeeded,
  SignedInAccount,
} from "@empire-cleaning/models";
import {
  Actions,
  AppLayout,
  Button,
  Dialog,
  DialogTrigger,
  List,
  ListItem,
  Notice,
  type NavItem,
  useLanguage,
} from "@empire-cleaning/ui";
import {
  catalog,
  type Language,
  LANGUAGES,
  languageNames,
} from "@empire-cleaning/models";
import { deleteJson, getJson, putJson } from "../api.ts";
import { useLoaded } from "./load.ts";
import { linkTo } from "../links.ts";
import { InArea } from "./MessagePage.tsx";
import { JobIcon, QuoteIcon } from "./icons.ts";
import {
  areaLabels,
  areas,
  areasFor,
  forgetAccount,
  getAccount,
  signOut,
  type AreaId,
} from "../session.ts";
import { reportUnexpected } from "../monitoring.ts";
import { useAction } from "./action.ts";
import { useTours } from "./run-tours.ts";
import { cleanerWords } from "./cleaner/words.ts";
import { portalWords } from "./portal/words.ts";
import { said } from "./words.ts";

// the Account menu's words, in every area's language (ADR-0025): said to
// Clients and Cleaners alike, so their Spanish addresses no one, neither
// usted nor tú (docs/ux.md, Language)
const words = catalog({
  en: {
    account: "Account",
    switchTo: "Switch to",
    switchToArea: (area: string) => `Switch to ${area}`,
    showTips: "Show tips again",
    tipsBack: "Tips will show again",
    tipsFailed: "Couldn't bring the tips back. Try again.",
    languageFailed: "Couldn't change the language. Try again.",
  },
  es: {
    account: "Cuenta",
    switchTo: "Cambiar a",
    switchToArea: (area: string) => `Cambiar a ${area}`,
    showTips: "Volver a mostrar consejos",
    tipsBack: "Los consejos se volverán a mostrar",
    tipsFailed:
      "No se pudieron volver a mostrar los consejos. Se puede intentar de nuevo.",
    languageFailed: "No se pudo cambiar el idioma. Se puede intentar de nuevo.",
  },
});

// an item is current on its own page, and on the pages that belong to its
// section (alsoCurrentFor: URL prefixes), e.g. a Quote reached from Quotes
type AreaNavItem = NavItem & { alsoCurrentFor?: string[] };

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
      alsoCurrentFor: [
        "/office/clients/",
        "/office/properties",
        "/office/bills/",
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
      alsoCurrentFor: ["/cleaner/jobs/"],
    },
    {
      href: linkTo({ to: "/cleaner/offers" }),
      label: cleanerWords[lang].offers,
      icon: Inbox,
      alsoCurrentFor: ["/cleaner/open/"],
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
    },
  ],
});

export function AreaLayout({ area }: { area: AreaId }) {
  const { account } = useRouteContext({ from: areas[area].path });
  const matchRoute = useMatchRoute();
  const { pathname } = useLocation();
  const offers = useOffersCount(area === "cleaner", pathname);
  useTours(area, account);
  const lang = useLanguage();
  const nav: NavItem[] = navFor(lang)[area].map(
    ({ alsoCurrentFor = [], ...item }) => ({
      ...item,
      label:
        item.href === linkTo({ to: "/cleaner/offers" }) && offers > 0
          ? cleanerWords[lang].offersCount(offers)
          : item.label,
      isCurrent:
        Boolean(matchRoute(item.href)) ||
        alsoCurrentFor.some((prefix) => pathname.startsWith(prefix)),
    }),
  );

  // on a phone, every area's account parts are at the foot of the ☰ menu;
  // on larger screens, in the sidebar's Account menu (#305). The areas that
  // follow the person's language offer the other one beside them; the
  // Office is English for good
  const own = area !== "office";
  // the ☰ menu foot's, here so the menu stays open while an area switches
  const footActions = useAccountActions(account, area);

  return (
    <AppLayout
      area={areaLabels[lang][area]}
      nav={nav}
      account={
        <>
          {own && <OtherLanguage />}
          <AccountMenu account={account} area={area} />
        </>
      }
      menuFoot={({ close }) => (
        <AccountFoot
          account={account}
          actions={footActions}
          close={close}
          withLanguage={own}
        />
      )}
      menuBusy={footActions.switching !== undefined}
    >
      <InArea value>
        <Outlet />
      </InArea>
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
      ]).then(([{ today, upcoming }, open]) => {
        const offered = [...today, ...upcoming].filter(
          (job) => job.assignment.status === "offered" && !job.outcome,
        );
        return offered.length + open.length;
      }),
    { keep: true },
  );
  return value ?? 0;
}

// what the person can do with their Account, wherever it shows (the
// Account menu, or a phone's ☰ menu): switch to their other area (Staff
// holding both roles, or a Cleaner who's a Client too), bring back
// first-time help's tours, and sign out
function useAccountActions(account: SignedInAccount, area: AreaId) {
  const navigate = useNavigate();
  const router = useRouter();
  const otherAreas = areasFor(account).filter((id) => id !== area);
  const lang = useLanguage();
  const w = { ...words[lang], signOut: said[lang].signOut };
  const action = useAction(w.tipsFailed);
  // the area being switched to, until it's on screen
  const [switching, setSwitching] = useState<AreaId>();

  // opening the menu is when an area is chosen: look again at what the
  // Account is connected to, and load each area it offers, its Home included,
  // so pressing one shows it at once (the router keeps them 30 s)
  const preloadAreas = () => {
    forgetAccount();
    getAccount().catch(reportUnexpected);
    for (const id of otherAreas) {
      // a failed load is caught by the router itself (and runs again on the
      // visit, which PageError reports)
      void router.preloadRoute({ to: areas[id].path });
    }
  };

  // pressed before the area is ready, the menu stays open with the row
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
    preloadAreas,
    switchTo,
    showTipsAgain,
    signOutHere,
  };
}

// who's signed in, and what they can do with their Account, in a dialog: in
// the sidebar on larger screens
function AccountMenu({
  account,
  area,
}: {
  account: SignedInAccount;
  area: AreaId;
}) {
  const a = useAccountActions(account, area);
  const { w, switching } = a;

  return (
    <DialogTrigger onOpenChange={(isOpen) => isOpen && a.preloadAreas()}>
      <Button variant="quiet" className="justify-start">
        <User aria-hidden size={20} />
        {account.name}
      </Button>
      <Dialog title={w.account} isBusy={switching !== undefined}>
        {({ close }) => (
          <>
            <div className="flex flex-col">
              <span className="font-semibold">{account.name}</span>
              <span className="text-fg-muted">{account.email}</span>
            </div>
            {a.otherAreas.length > 0 && (
              <List
                aria-label={w.switchTo}
                onAction={(id) => void a.switchTo(id as AreaId, close)}
              >
                {a.otherAreas.map((id) => (
                  <ListItem
                    key={id}
                    id={id}
                    title={w.switchToArea(areaLabels[a.lang][id])}
                    isPending={switching === id}
                    isDisabled={switching !== undefined}
                  />
                ))}
              </List>
            )}
            {a.action.problem && (
              <Notice tone="danger">{a.action.problem}</Notice>
            )}
            <Actions>
              <Button
                variant="quiet"
                isPending={a.action.isPending}
                isDisabled={switching !== undefined}
                onPress={() => void a.showTipsAgain(close)}
              >
                {w.showTips}
              </Button>
              <Button
                variant="quiet"
                isDisabled={switching !== undefined}
                onPress={() => void a.signOutHere(close)}
              >
                {w.signOut}
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the same, at the foot of a phone's ☰ menu, one plain item each, the
// other language among them where the area follows it (#305)
function AccountFoot({
  account,
  actions: a,
  close,
  withLanguage,
}: {
  account: SignedInAccount;
  actions: ReturnType<typeof useAccountActions>;
  close: () => void;
  // the other language, in an area that follows the person's
  withLanguage: boolean;
}) {
  // opening the ☰ menu asks nothing again, as it's how a phone moves
  // between pages: a record connected meanwhile shows on returning to the
  // tab (main.tsx)
  const { w, switching } = a;

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
        {withLanguage && <OtherLanguage onChanged={close} />}
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
// turns to it once the Account is asked for again
function OtherLanguage({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter();
  const lang = useLanguage();
  const other = LANGUAGES.find((l) => l !== lang)!;
  const action = useAction(words[lang].languageFailed);

  const change = async () => {
    const ok = await action.run(async () => {
      await putJson("/api/me/language", { language: other });
      forgetAccount();
      await router.invalidate();
    });
    if (ok) onChanged?.();
  };

  return (
    <>
      <Button
        variant="quiet"
        className="justify-start"
        isPending={action.isPending}
        onPress={() => void change()}
      >
        <Languages aria-hidden size={20} />
        <span lang={other}>{languageNames[other]}</span>
      </Button>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </>
  );
}

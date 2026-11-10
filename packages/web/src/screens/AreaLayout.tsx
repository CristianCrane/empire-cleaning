import {
  Outlet,
  useLocation,
  useMatchRoute,
  useNavigate,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import {
  CalendarDays,
  ContactRound,
  House,
  Inbox,
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
import { catalog, type Language } from "@empire-cleaning/models";
import { deleteJson, getJson } from "../api.ts";
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
  },
  es: {
    account: "Cuenta",
    switchTo: "Cambiar a",
    switchToArea: (area: string) => `Cambiar a ${area}`,
    showTips: "Volver a mostrar consejos",
    tipsBack: "Los consejos se volverán a mostrar",
    tipsFailed:
      "No se pudieron volver a mostrar los consejos. Se puede intentar de nuevo.",
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

  return (
    <AppLayout
      area={areaLabels[lang][area]}
      nav={nav}
      account={<AccountMenu account={account} area={area} />}
      atHome={pathname.replace(/\/$/, "") === areas[area].path}
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

// who's signed in, a way into their other area (Staff holding both roles),
// bringing back first-time help's tours, and signing out
function AccountMenu({
  account,
  area,
}: {
  account: SignedInAccount;
  area: AreaId;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const otherAreas = areasFor(account).filter((id) => id !== area);
  const lang = useLanguage();
  const w = words[lang];
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

  return (
    <DialogTrigger onOpenChange={(isOpen) => isOpen && preloadAreas()}>
      <Button variant="quiet" className="justify-start">
        <User aria-hidden size={20} />
        <span className="max-md:sr-only">{account.name}</span>
      </Button>
      <Dialog title={w.account} isBusy={switching !== undefined}>
        {({ close }) => (
          <>
            <div className="flex flex-col">
              <span className="font-semibold">{account.name}</span>
              <span className="text-fg-muted">{account.email}</span>
            </div>
            {otherAreas.length > 0 && (
              <List
                aria-label={w.switchTo}
                onAction={(id) => void switchTo(id as AreaId, close)}
              >
                {otherAreas.map((id) => (
                  <ListItem
                    key={id}
                    id={id}
                    title={w.switchToArea(areaLabels[lang][id])}
                    isPending={switching === id}
                    isDisabled={switching !== undefined}
                  />
                ))}
              </List>
            )}
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button
                variant="quiet"
                isPending={action.isPending}
                isDisabled={switching !== undefined}
                onPress={() => void showTipsAgain(close)}
              >
                {w.showTips}
              </Button>
              <Button
                variant="quiet"
                isDisabled={switching !== undefined}
                onPress={async () => {
                  await signOut();
                  close();
                  void navigate({ to: "/sign-in" });
                }}
              >
                {said[lang].signOut}
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

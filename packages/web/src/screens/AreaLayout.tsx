import {
  Outlet,
  useLocation,
  useMatchRoute,
  useNavigate,
  useRouteContext,
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
import { useEffect, useState } from "react";
import type {
  CleanerJobs,
  OpenPlace,
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
  type NavItem,
} from "@empire-cleaning/ui";
import { getJson } from "../api.ts";
import { linkTo } from "../links.ts";
import { InArea } from "./MessagePage.tsx";
import { JobIcon, QuoteIcon } from "./icons.ts";
import { areas, areasFor, signOut, type AreaId } from "../session.ts";

// an item is current on its own page, and on the pages that belong to its
// section (alsoCurrentFor: URL prefixes), e.g. a Quote reached from Quotes
type AreaNavItem = NavItem & { alsoCurrentFor?: string[] };

// each area's navigation; feature tickets add their screens here
const navFor: Record<AreaId, AreaNavItem[]> = {
  office: [
    { href: linkTo({ to: "/office" }), label: "Today", icon: LayoutDashboard },
    {
      href: linkTo({ to: "/office/quotes" }),
      label: "Quotes",
      icon: QuoteIcon,
      alsoCurrentFor: ["/office/quotes/"],
    },
    {
      href: linkTo({ to: "/office/jobs" }),
      label: "Jobs",
      icon: JobIcon,
      alsoCurrentFor: ["/office/jobs/"],
    },
    {
      href: linkTo({ to: "/office/clients" }),
      label: "Clients",
      icon: ContactRound,
      alsoCurrentFor: [
        "/office/clients/",
        "/office/properties",
        "/office/bills/",
      ],
    },
    {
      href: linkTo({ to: "/office/schedule" }),
      label: "Schedule",
      icon: CalendarDays,
    },
    {
      href: linkTo({ to: "/office/staff" }),
      label: "Staff",
      icon: Users,
      alsoCurrentFor: ["/office/staff/"],
    },
    {
      href: linkTo({ to: "/office/services" }),
      label: "Services",
      icon: Sparkles,
      alsoCurrentFor: ["/office/services/"],
    },
    {
      href: linkTo({ to: "/office/price-list" }),
      label: "Price List",
      icon: Tag,
    },
  ],
  cleaner: [
    {
      href: linkTo({ to: "/cleaner" }),
      label: "Your Jobs",
      icon: CalendarDays,
      alsoCurrentFor: ["/cleaner/jobs/"],
    },
    {
      href: linkTo({ to: "/cleaner/offers" }),
      label: "Offers",
      icon: Inbox,
      alsoCurrentFor: ["/cleaner/open/"],
    },
  ],
  portal: [
    {
      href: linkTo({ to: "/portal" }),
      label: "Home",
      icon: House,
      alsoCurrentFor: ["/portal/request", "/portal/quotes"],
    },
    {
      href: linkTo({ to: "/portal/cleans" }),
      label: "Cleans",
      icon: Sparkles,
      alsoCurrentFor: ["/portal/jobs/"],
    },
    {
      href: linkTo({ to: "/portal/payments" }),
      label: "Payments",
      icon: Wallet,
      alsoCurrentFor: ["/portal/payment-method", "/portal/bills/"],
    },
    {
      href: linkTo({ to: "/portal/details" }),
      label: "Your details",
      icon: UserRound,
    },
  ],
};

export function AreaLayout({ area }: { area: AreaId }) {
  const { account } = useRouteContext({ from: areas[area].path });
  const matchRoute = useMatchRoute();
  const { pathname } = useLocation();
  const offers = useOffersCount(area === "cleaner", pathname);
  const nav: NavItem[] = navFor[area].map(
    ({ alsoCurrentFor = [], ...item }) => ({
      ...item,
      label:
        item.label === "Offers" && offers > 0
          ? `Offers (${offers})`
          : item.label,
      isCurrent:
        Boolean(matchRoute(item.href)) ||
        alsoCurrentFor.some((prefix) => pathname.startsWith(prefix)),
    }),
  );

  return (
    <AppLayout
      area={areas[area].label}
      nav={nav}
      account={<AccountMenu account={account} area={area} />}
    >
      <InArea value>
        <Outlet />
      </InArea>
    </AppLayout>
  );
}

// How many places wait on a Cleaner's answer, offered or open to them, for
// Offers' label: so they're noticed without crowding Your Jobs. Counted
// again on each page, as answering one changes it; none if it can't be.
function useOffersCount(on: boolean, pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!on) return;
    let live = true;
    Promise.all([
      getJson<CleanerJobs>("/api/assignments/mine"),
      getJson<OpenPlace[]>("/api/assignments/open"),
    ])
      .then(([{ today, upcoming }, open]) => {
        const offered = [...today, ...upcoming].filter(
          (job) => job.assignment.status === "offered" && !job.outcome,
        );
        if (live) setCount(offered.length + open.length);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [on, pathname]);
  return count;
}

// who's signed in, a way into their other area (Staff holding both roles)
// and signing out
function AccountMenu({
  account,
  area,
}: {
  account: SignedInAccount;
  area: AreaId;
}) {
  const navigate = useNavigate();
  const otherAreas = areasFor(account).filter((id) => id !== area);

  return (
    <DialogTrigger>
      <Button variant="quiet" className="justify-start">
        <User aria-hidden size={20} />
        <span className="max-md:sr-only">{account.name}</span>
      </Button>
      <Dialog title="Account">
        {({ close }) => (
          <>
            <div className="flex flex-col">
              <span className="font-semibold">{account.name}</span>
              <span className="text-fg-muted">{account.email}</span>
            </div>
            {otherAreas.length > 0 && (
              <List
                aria-label="Switch to"
                onAction={(id) => {
                  close();
                  void navigate({ to: areas[id as AreaId].path });
                }}
              >
                {otherAreas.map((id) => (
                  <ListItem
                    key={id}
                    id={id}
                    title={`Switch to ${areas[id].label}`}
                  />
                ))}
              </List>
            )}
            <Actions>
              <Button
                variant="quiet"
                onPress={async () => {
                  await signOut();
                  close();
                  void navigate({ to: "/sign-in" });
                }}
              >
                Sign out
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

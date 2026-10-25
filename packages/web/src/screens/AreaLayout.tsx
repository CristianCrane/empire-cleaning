import {
  Outlet,
  useLocation,
  useMatchRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  CalendarDays,
  House,
  Inbox,
  LayoutDashboard,
  User,
  UserRound,
} from "lucide-react";
import type { SignedInAccount } from "@empire-cleaning/models";
import {
  Actions,
  AppLayout,
  Button,
  Dialog,
  DialogTrigger,
  type NavItem,
} from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";
import { areas, areasFor, signOut, type AreaId } from "../session.ts";

// an item is current on its own page, and on the pages that belong to its
// section (alsoCurrentFor: URL prefixes), e.g. a Client reached from Requests
type AreaNavItem = NavItem & { alsoCurrentFor?: string[] };

// each area's navigation; feature tickets add their screens here
const navFor: Record<AreaId, AreaNavItem[]> = {
  office: [
    { href: linkTo({ to: "/office" }), label: "Today", icon: LayoutDashboard },
    {
      href: linkTo({ to: "/office/requests" }),
      label: "Requests",
      icon: Inbox,
      alsoCurrentFor: ["/office/clients"],
    },
  ],
  cleaner: [
    { href: linkTo({ to: "/cleaner" }), label: "Today", icon: CalendarDays },
  ],
  portal: [
    {
      href: linkTo({ to: "/portal" }),
      label: "Home",
      icon: House,
      alsoCurrentFor: ["/portal/request"],
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
  const nav: NavItem[] = navFor[area].map(
    ({ alsoCurrentFor = [], ...item }) => ({
      ...item,
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
      <Outlet />
    </AppLayout>
  );
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
            <Actions>
              {otherAreas.map((id) => (
                <Button
                  key={id}
                  variant="secondary"
                  onPress={() => {
                    close();
                    void navigate({ to: areas[id].path });
                  }}
                >
                  Switch to {areas[id].label}
                </Button>
              ))}
              <Button
                variant="secondary"
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

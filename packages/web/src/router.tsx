import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import type {
  ClientView,
  NeedsAttentionItem,
  OpenQuoteRequest,
  PriceList,
  QuoteRequestDetail,
  ScheduleDay,
  StaffDetail,
  StaffMember,
  Today,
} from "@empire-cleaning/models";
import { RouterProvider, ToastRegion } from "@empire-cleaning/ui";
import { getJson } from "./api.ts";
import { AreaLayout } from "./screens/AreaLayout.tsx";
import { CleanerHome } from "./screens/AreaHomes.tsx";
import { Dashboard } from "./screens/office/Dashboard.tsx";
import { PriceListScreen } from "./screens/office/PriceListScreen.tsx";
import { QuoteRequest } from "./screens/office/QuoteRequest.tsx";
import { QuoteRequests } from "./screens/office/QuoteRequests.tsx";
import { ClientDetail } from "./screens/office/ClientDetail.tsx";
import { ScheduleScreen } from "./screens/office/ScheduleScreen.tsx";
import { StaffMemberScreen } from "./screens/office/StaffMemberScreen.tsx";
import { StaffScreen } from "./screens/office/StaffScreen.tsx";
import {
  isDay,
  scheduleRange,
  type ScheduleSearch,
} from "./screens/office/schedule-range.ts";
import { PortalHome } from "./screens/portal/PortalHome.tsx";
import { PortalRequest } from "./screens/portal/PortalRequest.tsx";
import { PortalDetails } from "./screens/portal/PortalDetails.tsx";
import { NotFound } from "./screens/NotFound.tsx";
import { SignIn } from "./screens/SignIn.tsx";
import { Welcome } from "./screens/Welcome.tsx";
import {
  areas,
  areasFor,
  forgetAccount,
  getAccount,
  safeNext,
  type AreaId,
} from "./session.ts";

// lets design-system links (Link, AppLayout's nav) navigate through the router
function Root() {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(to, options) => router.navigate({ ...to, ...options })}
      useHref={(to) => router.buildLocation(to).href}
    >
      <Outlet />
      <ToastRegion />
    </RouterProvider>
  );
}

const rootRoute = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
});

// where a signed-in Account belongs: its first area (the Office for Staff
// holding both roles), or the welcome page if it's connected to nothing yet
const homeOf = async () => {
  const account = await getAccount();
  if (!account) return undefined;
  const [first] = areasFor(account);
  return first ? areas[first].path : "/welcome";
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    throw redirect({ to: (await homeOf()) ?? "/sign-in" });
  },
});

export type SignInSearch = { next?: string; error?: string };

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    next: safeNext(typeof search.next === "string" ? search.next : undefined),
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const home = await homeOf();
    if (home) throw redirect({ href: search.next ?? home });
  },
  component: SignIn,
});

const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  beforeLoad: async ({ location }) => {
    const account = await getAccount();
    if (!account) {
      throw redirect({ to: "/sign-in", search: { next: location.href } });
    }
    // once connected to something, its area is the place to be
    const home = await homeOf();
    if (home !== "/welcome") throw redirect({ to: home ?? "/sign-in" });
    return { account };
  },
  component: Welcome,
});

// the area the person was last in; moving to another is a moment to look
// again at what their Account is connected to
let lastArea: AreaId | undefined;

// an area is only for Accounts holding its role: anyone signed out goes to
// sign-in (and comes back afterwards), anyone else to their own area
const areaRoute = <Id extends AreaId>(id: Id) =>
  createRoute({
    getParentRoute: () => rootRoute,
    // the area's own path as a literal type, so its child routes are typed
    path: areas[id].path as (typeof areas)[Id]["path"],
    beforeLoad: async ({ location }) => {
      if (lastArea !== id) {
        forgetAccount();
        lastArea = id;
      }
      const account = await getAccount();
      if (!account) {
        throw redirect({ to: "/sign-in", search: { next: location.href } });
      }
      if (!account.roles.includes(areas[id].role)) {
        throw redirect({ to: (await homeOf()) ?? "/sign-in" });
      }
      return { account };
    },
    component: () => <AreaLayout area={id} />,
  });

// the signed-in Client with their homes and Quote Requests
const ownClient = () => getJson<ClientView>("/api/clients/me");

const officeRoute = areaRoute("office");
const cleanerRoute = areaRoute("cleaner");
const portalRoute = areaRoute("portal");

// every route is a named constant: TanStack loses a route's types (and with
// them every link's checking) when it's written inline inside addChildren()

const officeHomeRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/",
  loader: async () => {
    const [needsAttention, today] = await Promise.all([
      getJson<NeedsAttentionItem[]>("/api/dashboard/needs-attention"),
      getJson<Today>("/api/dashboard/today"),
    ]);
    return { needsAttention, today };
  },
  component: Dashboard,
});

const officeRequestsRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/requests",
  loader: () => getJson<OpenQuoteRequest[]>("/api/quote-requests"),
  component: QuoteRequests,
});

const officeRequestRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/requests/$requestId",
  loader: ({ params }) =>
    getJson<QuoteRequestDetail>(`/api/quote-requests/${params.requestId}`),
  component: QuoteRequest,
});

const officePriceListRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/price-list",
  loader: () => getJson<PriceList>("/api/price-list"),
  component: PriceListScreen,
});

const officeClientRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/clients/$clientId",
  loader: ({ params }) =>
    getJson<ClientView>(`/api/clients/${params.clientId}`),
  component: ClientDetail,
});

const officeStaffRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/staff",
  loader: () => getJson<StaffMember[]>("/api/staff"),
  component: StaffScreen,
});

const officeStaffMemberRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/staff/$staffId",
  loader: ({ params }) => getJson<StaffDetail>(`/api/staff/${params.staffId}`),
  component: StaffMemberScreen,
});

const officeScheduleRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/schedule",
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    from: isDay(search.from) ? search.from : undefined,
    to: isDay(search.to) ? search.to : undefined,
  }),
  loaderDeps: ({ search }) => scheduleRange(search),
  loader: ({ deps }) =>
    getJson<ScheduleDay[]>(`/api/schedule?from=${deps.from}&to=${deps.to}`),
  component: ScheduleScreen,
});

const cleanerHomeRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/",
  component: CleanerHome,
});

const portalHomeRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/",
  loader: ownClient,
  component: PortalHome,
});

const portalRequestRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/request",
  loader: ownClient,
  component: PortalRequest,
});

const portalDetailsRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/details",
  loader: ownClient,
  component: PortalDetails,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  officeRoute.addChildren([
    officeHomeRoute,
    officeRequestsRoute,
    officeRequestRoute,
    officeClientRoute,
    officePriceListRoute,
    officeStaffRoute,
    officeStaffMemberRoute,
    officeScheduleRoute,
  ]),
  cleanerRoute.addChildren([cleanerHomeRoute]),
  portalRoute.addChildren([
    portalHomeRoute,
    portalRequestRoute,
    portalDetailsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

import { useEffect, useState } from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import type {
  BillSummary,
  BillView,
  CleanerJob,
  CleanerJobs,
  CleanerSiteVisits,
  ClientSiteVisit,
  ClientList,
  JobList,
  ClientJob,
  ClientJobDetail,
  ClientPastJob,
  ClientQuoteView,
  ClientView,
  OfficeClientView,
  OfficePropertyView,
  NeedsAttentionItem,
  OfficeJob,
  OfficeQuote,
  OfficeServicePlan,
  OfficeSiteVisit,
  OpenPlace,
  PaymentMethodView,
  PremisesTypeChoice,
  PriceList,
  Service,
  Site,
  QuoteSummary,
  ScheduleDay,
  ServicePlanSummary,
  ServicePlanView,
  StaffDetail,
  StaffMember,
  Today,
} from "@empire-cleaning/models";
import {
  RouterProvider,
  TestSiteBanner,
  ToastRegion,
} from "@empire-cleaning/ui";
import { getJson } from "./api.ts";
import { AreaLayout } from "./screens/AreaLayout.tsx";
import { CleanerHome } from "./screens/cleaner/CleanerHome.tsx";
import { CleanerJobScreen } from "./screens/cleaner/CleanerJobScreen.tsx";
import { OpenPlaceScreen } from "./screens/cleaner/OpenPlaceScreen.tsx";
import { BillScreen } from "./screens/office/BillScreen.tsx";
import { Dashboard } from "./screens/office/Dashboard.tsx";
import { JobScreen } from "./screens/office/JobScreen.tsx";
import { PriceListScreen } from "./screens/office/PriceListScreen.tsx";
import {
  NewServiceScreen,
  ServiceScreen,
  ServicesScreen,
} from "./screens/office/ServicesScreen.tsx";
import {
  QuoteDraftScreen,
  QuoteScreen,
} from "./screens/office/QuoteScreen.tsx";
import {
  QuotesScreen,
  quoteListStatuses,
  type QuotesSearch,
} from "./screens/office/QuotesScreen.tsx";
import {
  NewQuoteScreen,
  type NewQuoteSearch,
} from "./screens/office/NewQuoteScreen.tsx";
import { ClientDetail } from "./screens/office/ClientDetail.tsx";
import {
  CLIENTS_PAGE,
  clientTabs,
  ClientsScreen,
  type ClientsSearch,
  tabFor,
} from "./screens/office/ClientsScreen.tsx";
import {
  JOBS_PAGE,
  jobTabs,
  jobsTabFor,
  JobsScreen,
  type JobsSearch,
} from "./screens/office/JobsScreen.tsx";
import {
  currentVisit,
  PropertyScreen,
  propertyTabs,
  type PropertySearch,
} from "./screens/office/PropertyScreen.tsx";
import { ScheduleScreen } from "./screens/office/ScheduleScreen.tsx";
import { ServicePlanScreen } from "./screens/office/ServicePlanScreen.tsx";
import { SiteVisitScreen } from "./screens/office/SiteVisitScreen.tsx";
import { StaffMemberScreen } from "./screens/office/StaffMemberScreen.tsx";
import { StaffScreen } from "./screens/office/StaffScreen.tsx";
import {
  isDay,
  scheduleRange,
  type ScheduleSearch,
} from "./screens/schedule-range.ts";
import { PortalBill } from "./screens/portal/PortalBill.tsx";
import { PortalHome } from "./screens/portal/PortalHome.tsx";
import { HomeCasesPrototype } from "./screens/portal/home-cases.prototype.tsx";
import { PortalJob } from "./screens/portal/PortalJob.tsx";
import { PortalPaymentMethod } from "./screens/portal/PortalPaymentMethod.tsx";
import { PortalPlan } from "./screens/portal/PortalPlan.tsx";
import { PortalQuote } from "./screens/portal/PortalQuote.tsx";
import { PortalRequest } from "./screens/portal/PortalRequest.tsx";
import { PortalDetails } from "./screens/portal/PortalDetails.tsx";
import { NotFound } from "./screens/NotFound.tsx";
import { PageError } from "./screens/PageError.tsx";
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
// asked once: which site this is doesn't change while the app is open. The
// banner is only a label, so it isn't worth holding up the page for
const site = getJson<Site>("/api/site").catch(() => null);

function Root() {
  const router = useRouter();
  const [isTestSite, setIsTestSite] = useState(false);
  useEffect(() => {
    void site.then((found) => setIsTestSite(found?.mode === "test"));
  }, []);
  return (
    <RouterProvider
      navigate={(to, options) => router.navigate({ ...to, ...options })}
      useHref={(to) => router.buildLocation(to).href}
    >
      {isTestSite && <TestSiteBanner />}
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

// the signed-in Client with their homes and Quotes
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

const officeQuotesRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/quotes",
  validateSearch: (search: Record<string, unknown>): QuotesSearch => ({
    // a number-like search (a house number) comes back as a number
    q:
      typeof search.q === "string" || typeof search.q === "number"
        ? String(search.q) || undefined
        : undefined,
    status: quoteListStatuses.find((s) => s === search.status),
  }),
  loader: () => getJson<QuoteSummary[]>("/api/quotes"),
  component: QuotesScreen,
});

// Requests became Quotes (ADR-0017): old links still lead there
const officeRequestsRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/requests",
  beforeLoad: () => {
    throw redirect({ to: "/office/quotes" });
  },
});

const officeRequestRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/requests/$requestId",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/office/quotes/$quoteId",
      params: { quoteId: params.requestId },
    });
  },
});

// quoting someone who phones (#34), for a Client found already if given
const officeNewQuoteRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/quotes/new",
  validateSearch: (search: Record<string, unknown>): NewQuoteSearch => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
  }),
  loaderDeps: ({ search }) => ({ clientId: search.clientId }),
  loader: ({ deps }) =>
    deps.clientId
      ? getJson<OfficeClientView>(`/api/clients/${deps.clientId}`)
      : null,
  component: NewQuoteScreen,
});

const officeQuoteRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/quotes/$quoteId",
  loader: ({ params }) => getJson<OfficeQuote>(`/api/quotes/${params.quoteId}`),
  component: QuoteScreen,
});

// building a Revision; with none being written, it's the Quote's page
const officeQuoteDraftRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/quotes/$quoteId/draft",
  // never shown from the cache: the form starts from what it's first given,
  // so a cached visit (an earlier Revision, or before its last save) would
  // stick
  gcTime: 0,
  loader: async ({ params }) => {
    const quote = await getJson<OfficeQuote>(`/api/quotes/${params.quoteId}`);
    if (!quote.draft) {
      throw redirect({
        to: "/office/quotes/$quoteId",
        params: { quoteId: quote.id },
      });
    }
    return quote;
  },
  component: QuoteDraftScreen,
});

const officePriceListRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/price-list",
  loader: async () => {
    const [list, services] = await Promise.all([
      getJson<PriceList>("/api/price-list"),
      getJson<Service[]>("/api/services"),
    ]);
    return { list, services };
  },
  component: PriceListScreen,
});

const officeServicesRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/services",
  loader: () => getJson<Service[]>("/api/services"),
  component: ServicesScreen,
});

const officeNewServiceRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/services/new",
  loader: async () => {
    const [services, list] = await Promise.all([
      getJson<Service[]>("/api/services"),
      getJson<PriceList>("/api/price-list"),
    ]);
    return { services, list };
  },
  component: NewServiceScreen,
});

const officeServiceRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/services/$serviceKey",
  loader: async ({ params }) => {
    const [service, services, list] = await Promise.all([
      getJson<Service>(`/api/services/${params.serviceKey}`),
      getJson<Service[]>("/api/services"),
      getJson<PriceList>("/api/price-list"),
    ]);
    return { service, services, list };
  },
  component: ServiceScreen,
});

const officeClientsRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/clients",
  validateSearch: (search: Record<string, unknown>): ClientsSearch => ({
    // a number-like search ("718555") comes back from the URL as a number
    q:
      typeof search.q === "string" || typeof search.q === "number"
        ? String(search.q) || undefined
        : undefined,
    tab: clientTabs.find((t) => t === search.tab),
    shown:
      typeof search.shown === "number" && search.shown > CLIENTS_PAGE
        ? Math.floor(search.shown)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    tab: tabFor(search),
    shown: search.shown ?? CLIENTS_PAGE,
  }),
  loader: ({ deps }) =>
    getJson<ClientList>(
      `/api/clients?${new URLSearchParams({
        ...(deps.q && { q: deps.q }),
        standing: deps.tab,
        limit: String(deps.shown),
      })}`,
    ),
  component: ClientsScreen,
});

const officeClientRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/clients/$clientId",
  loader: async ({ params }) => {
    const [client, bills] = await Promise.all([
      getJson<OfficeClientView>(`/api/clients/${params.clientId}`),
      getJson<BillSummary[]>(`/api/bills?clientId=${params.clientId}`),
    ]);
    return { client, bills };
  },
  component: ClientDetail,
});

const officeBillRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/bills/$billId",
  loader: ({ params }) => getJson<BillView>(`/api/bills/${params.billId}`),
  component: BillScreen,
});

const officePropertyRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/properties/$propertyId",
  validateSearch: (search: Record<string, unknown>): PropertySearch => ({
    tab: propertyTabs.find((t) => t === search.tab && t !== "details"),
  }),
  // business premises are corrected to a Premises Type on offer
  loader: async ({ params }) => {
    const [home, premisesTypes] = await Promise.all([
      getJson<OfficePropertyView>(`/api/properties/${params.propertyId}`),
      getJson<PremisesTypeChoice[]>("/api/price-list/premises-types"),
    ]);
    // its current Service Plan and Site Visit in full, for their Tabs
    const current = currentVisit(home);
    const [plan, visit] = await Promise.all([
      home.servicePlan
        ? getJson<OfficeServicePlan>(
            `/api/service-plans/${home.servicePlan.id}`,
          )
        : null,
      current
        ? getJson<OfficeSiteVisit>(`/api/site-visits/${current.id}`)
        : null,
    ]);
    return { home, premisesTypes, plan, visit };
  },
  component: PropertyScreen,
});

const officeServicePlanRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/service-plans/$planId",
  // a current plan is shown on its home's Service Plan Tab; an Ended one
  // keeps this page
  loader: async ({ params }) => {
    const plan = await getJson<OfficeServicePlan>(
      `/api/service-plans/${params.planId}`,
    );
    if (plan.status !== "ended")
      throw redirect({
        to: "/office/properties/$propertyId",
        params: { propertyId: plan.property.id },
        search: { tab: "plan" },
        replace: true,
      });
    return plan;
  },
  component: ServicePlanScreen,
});

// findings are recorded to a Premises Type on offer
const officeSiteVisitRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/site-visits/$visitId",
  // a home's current Site Visit is shown on its Site Visit Tab; earlier
  // and cancelled ones keep this page
  loader: async ({ params }) => {
    const [visit, premisesTypes] = await Promise.all([
      getJson<OfficeSiteVisit>(`/api/site-visits/${params.visitId}`),
      getJson<PremisesTypeChoice[]>("/api/price-list/premises-types"),
    ]);
    const home = await getJson<OfficePropertyView>(
      `/api/properties/${visit.property.id}`,
    );
    if (currentVisit(home)?.id === visit.id)
      throw redirect({
        to: "/office/properties/$propertyId",
        params: { propertyId: home.id },
        search: { tab: "visit" },
        replace: true,
      });
    return { visit, premisesTypes };
  },
  component: SiteVisitScreen,
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

const officeJobsRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/jobs",
  validateSearch: (search: Record<string, unknown>): JobsSearch => ({
    // a number-like search ("41") comes back from the URL as a number
    q:
      typeof search.q === "string" || typeof search.q === "number"
        ? String(search.q) || undefined
        : undefined,
    tab: jobTabs.find((t) => t === search.tab),
    shown:
      typeof search.shown === "number" && search.shown > JOBS_PAGE
        ? Math.floor(search.shown)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    tab: jobsTabFor(search),
    shown: search.shown ?? JOBS_PAGE,
  }),
  loader: ({ deps }) =>
    getJson<JobList>(
      `/api/jobs?${new URLSearchParams({
        ...(deps.q && { q: deps.q }),
        tab: deps.tab,
        limit: String(deps.shown),
      })}`,
    ),
  component: JobsScreen,
});

const officeJobRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/jobs/$jobId",
  loader: ({ params }) => getJson<OfficeJob>(`/api/jobs/${params.jobId}`),
  component: JobScreen,
});

const cleanerHomeRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/",
  loader: async () => {
    const [jobs, siteVisits, open] = await Promise.all([
      getJson<CleanerJobs>("/api/assignments/mine"),
      getJson<CleanerSiteVisits>("/api/site-visits/visiting"),
      getJson<OpenPlace[]>("/api/assignments/open"),
    ]);
    return { ...jobs, siteVisits, open };
  },
  component: CleanerHome,
});

// where the Offer email's link leads
const cleanerJobRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/jobs/$jobId",
  loader: ({ params }) =>
    getJson<CleanerJob>(`/api/assignments/mine/${params.jobId}`),
  component: CleanerJobScreen,
});

// where the Open Places emails lead, for a single Job
const openPlaceRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/open/$jobId",
  loader: ({ params }) =>
    getJson<OpenPlace>(`/api/assignments/open/${params.jobId}`),
  component: OpenPlaceScreen,
});

const portalHomeRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/",
  loader: async () => {
    const [client, plans, quotes, jobs, pastJobs, siteVisits, bills] =
      await Promise.all([
        ownClient(),
        getJson<ServicePlanSummary[]>("/api/service-plans/mine"),
        getJson<QuoteSummary[]>("/api/quotes/mine"),
        getJson<ClientJob[]>("/api/jobs/mine"),
        getJson<ClientPastJob[]>("/api/jobs/mine/past"),
        getJson<ClientSiteVisit[]>("/api/site-visits/mine"),
        getJson<BillSummary[]>("/api/bills/mine"),
      ]);
    return { client, plans, quotes, jobs, pastJobs, siteVisits, bills };
  },
  component: PortalHome,
});

// where the Quote email's link leads: signed out, the portal sends the
// Client to sign in (or up) and back here
const ownPaymentMethod = () =>
  getJson<PaymentMethodView | null>("/api/payment-methods/mine");

const portalQuoteRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/quotes/$quoteId",
  loader: async ({ params }) => {
    const [quote, paymentMethod] = await Promise.all([
      getJson<ClientQuoteView>(`/api/quotes/mine/${params.quoteId}`),
      ownPaymentMethod(),
    ]);
    return { quote, paymentMethod };
  },
  component: PortalQuote,
});

// where the acceptance and the portal's home lead
const portalPlanRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/plans/$planId",
  loader: ({ params }) =>
    getJson<ServicePlanView>(`/api/service-plans/mine/${params.planId}`),
  component: PortalPlan,
});

// where the receipt, approval and Unpaid emails lead
const portalJobRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/jobs/$jobId",
  loader: ({ params }) =>
    getJson<ClientJobDetail>(`/api/jobs/mine/${params.jobId}`),
  component: PortalJob,
});

// where a weekly Bill's emails lead
const portalBillRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/bills/$billId",
  loader: ({ params }) => getJson<BillView>(`/api/bills/mine/${params.billId}`),
  component: PortalBill,
});

// where the Office's "add a Payment Method" email leads
const portalPaymentMethodRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/payment-method",
  loader: ownPaymentMethod,
  component: PortalPaymentMethod,
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

// PROTOTYPE: the Client's Home in every case, on made-up data, signed out
const homeCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prototype/home",
  validateSearch: (
    search: Record<string, unknown>,
  ): { case?: string; layout?: string; shortcuts?: string } => ({
    // ?case=20 arrives as a number
    case: search.case === undefined ? undefined : String(search.case),
    layout: typeof search.layout === "string" ? search.layout : undefined,
    shortcuts:
      typeof search.shortcuts === "string" ? search.shortcuts : undefined,
  }),
  component: HomeCasesPrototype,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  homeCasesRoute,
  signInRoute,
  welcomeRoute,
  officeRoute.addChildren([
    officeHomeRoute,
    officeQuotesRoute,
    officeRequestsRoute,
    officeRequestRoute,
    officeNewQuoteRoute,
    officeQuoteRoute,
    officeQuoteDraftRoute,
    officeClientsRoute,
    officeClientRoute,
    officePropertyRoute,
    officeServicePlanRoute,
    officeSiteVisitRoute,
    officePriceListRoute,
    officeServicesRoute,
    officeNewServiceRoute,
    officeServiceRoute,
    officeStaffRoute,
    officeStaffMemberRoute,
    officeScheduleRoute,
    officeJobsRoute,
    officeJobRoute,
    officeBillRoute,
  ]),
  cleanerRoute.addChildren([cleanerHomeRoute, cleanerJobRoute, openPlaceRoute]),
  portalRoute.addChildren([
    portalHomeRoute,
    portalRequestRoute,
    portalQuoteRoute,
    portalPlanRoute,
    portalJobRoute,
    portalBillRoute,
    portalDetailsRoute,
    portalPaymentMethodRoute,
  ]),
]);

// Scroll restoration keeps each page's place: without it, refreshing a page's
// data after a save (router.invalidate()) jumps it back to the top. New
// pages still open at the top, and Back returns to where you were.
// A page that can't load shows PageError in its place, within its area.
export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultErrorComponent: PageError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

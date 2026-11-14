import { useEffect, useState } from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  redirect,
  useRouter,
  useRouterState,
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
  ClientJobDetail,
  ClientPastJob,
  ClientPayment,
  ClientUpcomingJob,
  ClientQuoteView,
  ClientView,
  DemoPerson,
  Language,
  Me,
  OfficeClientView,
  OfficePropertyView,
  NeedsAttentionItem,
  OfficeJob,
  OfficeQuote,
  OfficeServicePlan,
  OfficeSiteVisit,
  CleanerNeeded,
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
} from "@empire-cleaning/models";
import {
  LanguageProvider,
  Link,
  RouterProvider,
  TestSiteBanner,
  ToastRegion,
} from "@empire-cleaning/ui";
import { getJson } from "./api.ts";
import {
  setAppLanguage,
  signedOutLanguage,
  useAppLanguage,
} from "./language.ts";
import { linkTo } from "./links.ts";
import { AreaLayout } from "./screens/AreaLayout.tsx";
import { CleanerHome } from "./screens/cleaner/CleanerHome.tsx";
import { ConfirmEmail } from "./screens/ConfirmEmail.tsx";
import { SignInLink, type SignInLinkSearch } from "./screens/SignInLink.tsx";
import { CleanerOffers, offerTabs } from "./screens/cleaner/CleanerOffers.tsx";
import { CleanerJobScreen } from "./screens/cleaner/CleanerJobScreen.tsx";
import { CleanerNeededScreen } from "./screens/cleaner/CleanerNeededScreen.tsx";
import { BillScreen } from "./screens/office/BillScreen.tsx";
import { Dashboard } from "./screens/office/Dashboard.tsx";
import { JobScreen } from "./screens/office/JobScreen.tsx";
import { PriceListScreen } from "./screens/office/PriceListScreen.tsx";
import {
  NewServiceScreen,
  ServiceScreen,
  ServicesScreen,
  serviceTabs,
} from "./screens/office/ServicesScreen.tsx";
import {
  QuoteDraftScreen,
  QuoteScreen,
} from "./screens/office/QuoteScreen.tsx";
import { QuotesScreen, quoteTabs } from "./screens/office/QuotesScreen.tsx";
import {
  NewQuoteScreen,
  type NewQuoteSearch,
} from "./screens/office/NewQuoteScreen.tsx";
import { ClientDetail } from "./screens/office/ClientDetail.tsx";
import { clientTabs, ClientsScreen } from "./screens/office/ClientsScreen.tsx";
import { jobTabs, JobsScreen } from "./screens/office/JobsScreen.tsx";
import { listAsk, listUrl } from "./screens/list-search.ts";
import {
  currentVisit,
  PropertyScreen,
} from "./screens/office/PropertyScreen.tsx";
import { ScheduleScreen } from "./screens/office/ScheduleScreen.tsx";
import { ServicePlanScreen } from "./screens/office/ServicePlanScreen.tsx";
import { SiteVisitScreen } from "./screens/office/SiteVisitScreen.tsx";
import { StaffMemberScreen } from "./screens/office/StaffMemberScreen.tsx";
import { StaffScreen, staffTabs } from "./screens/office/StaffScreen.tsx";
import {
  isDay,
  scheduleRange,
  type ScheduleSearch,
} from "./screens/schedule-range.ts";
import { PortalBill } from "./screens/portal/PortalBill.tsx";
import { PortalCleans, cleansTabs } from "./screens/portal/PortalCleans.tsx";
import { PortalHome } from "./screens/portal/PortalHome.tsx";
import type { HomeData } from "./screens/portal/whats-next.ts";
import { PortalJob } from "./screens/portal/PortalJob.tsx";
import { PortalPaymentMethod } from "./screens/portal/PortalPaymentMethod.tsx";
import { PortalProperty } from "./screens/portal/PortalProperty.tsx";
import {
  PortalPayments,
  type PaymentsSearch,
} from "./screens/portal/PortalPayments.tsx";
import { PortalPlan } from "./screens/portal/PortalPlan.tsx";
import { PortalQuote } from "./screens/portal/PortalQuote.tsx";
import { PortalRequest } from "./screens/portal/PortalRequest.tsx";
import { PortalDetails } from "./screens/portal/PortalDetails.tsx";
import { NotFound } from "./screens/NotFound.tsx";
import { PeopleScreen, personAsked } from "./screens/PeopleScreen.tsx";
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
import { reportUnexpected } from "./monitoring.ts";

// lets design-system links (Link, AppLayout's nav) navigate through the router
// asked once: which site this is doesn't change while the app is open. The
// banner is only a label, so it isn't worth holding up the page for
const site = getJson<Site>("/api/site").catch((e: unknown) => {
  reportUnexpected(e);
  return null;
});

function Root() {
  const router = useRouter();
  const [isTestSite, setIsTestSite] = useState(false);
  useEffect(() => {
    void site.then((found) => setIsTestSite(found?.mode === "test"));
  }, []);
  // on the test site, who's signed in, looked at again on every page (it's
  // remembered, so that's no extra request) as signing in moves between pages
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [you, setYou] = useState<string>();
  useEffect(() => {
    if (isTestSite) void getAccount().then((account) => setYou(account?.name));
  }, [isTestSite, pathname]);
  const lang = useAppLanguage();
  return (
    <LanguageProvider lang={lang}>
      <RouterProvider
        navigate={(to, options) => router.navigate({ ...to, ...options })}
        useHref={(to) => router.buildLocation(to).href}
      >
        {isTestSite && (
          <TestSiteBanner>
            {you && (
              <Link
                href={linkTo({ to: "/people" })}
                className="font-normal text-warning-strong"
              >
                You're {you}
              </Link>
            )}
          </TestSiteBanner>
        )}
        <Outlet />
        <ToastRegion />
      </RouterProvider>
    </LanguageProvider>
  );
}

// whether a path is in an area, whose route says its language once it
// knows who's signed in
const inArea = (pathname: string) =>
  Object.values(areas).some(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );

const rootRoute = createRootRoute({
  // a screen outside an area (sign-in, its links' pages, not found) is in
  // the signed-out language. An area's is left as it is until its route says
  // its own: the screen on show keeps its language while the Account is
  // asked for again (returning to the tab), rather than flashing the
  // signed-out one (#305)
  beforeLoad: ({ location }) => {
    if (!inArea(location.pathname)) setAppLanguage(signedOutLanguage());
  },
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

// the emailed sign-in link opens here, and signs in once its button is
// pressed (#243); one without a token is as good as used
const signInLinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in/link",
  validateSearch: (search: Record<string, unknown>): SignInLinkSearch => ({
    token: typeof search.token === "string" ? search.token : "",
    callbackURL:
      typeof search.callbackURL === "string" ? search.callbackURL : undefined,
    errorCallbackURL:
      typeof search.errorCallbackURL === "string"
        ? search.errorCallbackURL
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/sign-in", search: { error: "INVALID_TOKEN" } });
    }
  },
  component: SignInLink,
});

// the link emailed to a Client's new email (#243): pressing its page's button
// confirms it, signed in or not, once
const confirmEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/confirm-email",
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ConfirmEmail,
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

export type PeopleSearch = { as?: string; next?: string };

// the test site's demo people, to sign in as one (PeopleScreen). Someone the
// link asks for who is signed in already goes straight on
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  validateSearch: (search: Record<string, unknown>): PeopleSearch => ({
    as: typeof search.as === "string" ? search.as : undefined,
    next: safeNext(typeof search.next === "string" ? search.next : undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    forgetAccount();
    const [people, account] = await Promise.all([
      getJson<DemoPerson[]>("/api/demo-people"),
      getAccount(),
    ]);
    const wanted = personAsked(people, deps.as);
    if (account && wanted?.email === account.email) {
      throw redirect({ href: deps.next ?? (await homeOf()) ?? "/" });
    }
    return { people, account };
  },
  component: PeopleScreen,
});

// each area's language (ADR-0025): the portal the Client's Preferred
// Language, the Cleaner area the Staff member's, the Office English for good
const areaLanguage: Record<AreaId, (account: Me) => Language> = {
  portal: (account) => account.languages.portal ?? signedOutLanguage(),
  office: () => "en",
  cleaner: (account) => account.languages.cleaner ?? signedOutLanguage(),
};

// an area is only for Accounts holding its role: anyone signed out goes to
// sign-in (and comes back afterwards), anyone else to their own area. The
// Account is the one remembered (session.ts), so switching to one asks
// nothing new
const areaRoute = <Id extends AreaId>(id: Id) =>
  createRoute({
    getParentRoute: () => rootRoute,
    // the area's own path as a literal type, so its child routes are typed
    path: areas[id].path as (typeof areas)[Id]["path"],
    beforeLoad: async ({ location }) => {
      const account = await getAccount();
      if (!account) {
        throw redirect({ to: "/sign-in", search: { next: location.href } });
      }
      if (!account.roles.includes(areas[id].role)) {
        throw redirect({ to: (await homeOf()) ?? "/sign-in" });
      }
      setAppLanguage(areaLanguage[id](account));
      return { account };
    },
    component: () => <AreaLayout area={id} />,
  });

// the signed-in Client with their homes and Quotes
const ownClient = () => getJson<ClientView>("/api/clients/me");

const ownPaymentMethod = () =>
  getJson<PaymentMethodView | null>("/api/payment-methods/mine");

const officeRoute = areaRoute("office");
const cleanerRoute = areaRoute("cleaner");
const portalRoute = areaRoute("portal");

// every route is a named constant: TanStack loses a route's types (and with
// them every link's checking) when it's written inline inside addChildren()

const officeHomeRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/",
  loader: () => getJson<NeedsAttentionItem[]>("/api/dashboard/needs-attention"),
  component: Dashboard,
});

const officeQuotesRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/quotes",
  validateSearch: listUrl(quoteTabs),
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
  // and the Price List and Services, to show what it comes to as it is said
  loader: async ({ deps }) => {
    const [client, list, services] = await Promise.all([
      deps.clientId
        ? getJson<OfficeClientView>(`/api/clients/${deps.clientId}`)
        : null,
      getJson<PriceList>("/api/price-list"),
      getJson<Service[]>("/api/services"),
    ]);
    return { client, list, services };
  },
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
  validateSearch: listUrl(serviceTabs),
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
  validateSearch: listUrl(clientTabs),
  loaderDeps: ({ search }) => listAsk(clientTabs, search),
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
  // business premises are corrected to a Premises Type on offer
  loader: async ({ params }) => {
    const [home, premisesTypes] = await Promise.all([
      getJson<OfficePropertyView>(`/api/properties/${params.propertyId}`),
      getJson<PremisesTypeChoice[]>("/api/price-list/premises-types"),
    ]);
    // its current Service Plan in full, and its current Site Visit
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
  // a current plan is shown on its home's page; an Ended one keeps this page
  loader: async ({ params }) => {
    const plan = await getJson<OfficeServicePlan>(
      `/api/service-plans/${params.planId}`,
    );
    if (plan.status !== "ended")
      throw redirect({
        to: "/office/properties/$propertyId",
        params: { propertyId: plan.property.id },
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
  loader: async ({ params }) => {
    const [visit, premisesTypes] = await Promise.all([
      getJson<OfficeSiteVisit>(`/api/site-visits/${params.visitId}`),
      getJson<PremisesTypeChoice[]>("/api/price-list/premises-types"),
    ]);
    return { visit, premisesTypes };
  },
  component: SiteVisitScreen,
});

const officeStaffRoute = createRoute({
  getParentRoute: () => officeRoute,
  path: "/staff",
  validateSearch: listUrl(staffTabs),
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
  validateSearch: listUrl(jobTabs),
  loaderDeps: ({ search }) => listAsk(jobTabs, search),
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
    const [jobs, siteVisits] = await Promise.all([
      getJson<CleanerJobs>("/api/assignments/mine"),
      getJson<CleanerSiteVisits>("/api/site-visits/visiting"),
    ]);
    return { ...jobs, siteVisits };
  },
  component: CleanerHome,
});

// Jobs that aren't theirs yet: offered to them, or open to them
const cleanerOffersRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/offers",
  validateSearch: listUrl(offerTabs),
  loader: async () => {
    const [{ today, upcoming }, open] = await Promise.all([
      getJson<CleanerJobs>("/api/assignments/mine"),
      getJson<CleanerNeeded[]>("/api/assignments/open"),
    ]);
    return {
      offered: [...today, ...upcoming].filter(
        (job) => job.assignment.status === "offered" && !job.outcome,
      ),
      open,
    };
  },
  component: CleanerOffers,
});

// where the Offer email's link leads
const cleanerJobRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/jobs/$jobId",
  loader: ({ params }) =>
    getJson<CleanerJob>(`/api/assignments/mine/${params.jobId}`),
  component: CleanerJobScreen,
});

// where the Cleaners Needed emails lead, for a single Job
const cleanerNeededRoute = createRoute({
  getParentRoute: () => cleanerRoute,
  path: "/open/$jobId",
  loader: ({ params }) =>
    getJson<CleanerNeeded>(`/api/assignments/open/${params.jobId}`),
  component: CleanerNeededScreen,
});

const portalHomeRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/",
  loader: async () => {
    const [
      client,
      plans,
      quotes,
      jobs,
      pastJobs,
      siteVisits,
      bills,
      paymentMethod,
    ] = await Promise.all([
      ownClient(),
      getJson<ServicePlanSummary[]>("/api/service-plans/mine"),
      getJson<QuoteSummary[]>("/api/quotes/mine"),
      getJson<ClientUpcomingJob[]>("/api/jobs/mine"),
      getJson<ClientPastJob[]>("/api/jobs/mine/past"),
      getJson<ClientSiteVisit[]>("/api/site-visits/mine"),
      getJson<BillSummary[]>("/api/bills/mine"),
      ownPaymentMethod(),
    ]);
    return {
      client,
      plans,
      quotes,
      jobs,
      pastJobs,
      siteVisits,
      bills,
      paymentMethod,
    } satisfies HomeData;
  },
  component: PortalHome,
});

// where the Quote email's link leads: signed out, the portal sends the
// Client to sign in (or up) and back here

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

// every clean of theirs: what's coming (with Site Visits) and what's done
const portalCleansRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/cleans",
  validateSearch: listUrl(cleansTabs),
  loader: async () => {
    const [client, jobs, pastJobs, siteVisits] = await Promise.all([
      ownClient(),
      getJson<ClientUpcomingJob[]>("/api/jobs/mine"),
      getJson<ClientPastJob[]>("/api/jobs/mine/past"),
      getJson<ClientSiteVisit[]>("/api/site-visits/mine"),
    ]);
    return { client, jobs, pastJobs, siteVisits };
  },
  component: PortalCleans,
});

// where the receipt, approval and Unpaid emails lead
const portalJobRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/jobs/$jobId",
  loader: ({ params }) =>
    getJson<ClientJobDetail>(`/api/jobs/mine/${params.jobId}`),
  component: PortalJob,
});

// what they owe, if anything, and every payment between them and us
const portalPaymentsRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/payments",
  validateSearch: (search: Record<string, unknown>): PaymentsSearch => ({
    all: search.all === true || search.all === "true" ? true : undefined,
  }),
  loader: async () => {
    const [pastJobs, bills, paymentMethod, history] = await Promise.all([
      getJson<ClientPastJob[]>("/api/jobs/mine/past"),
      getJson<BillSummary[]>("/api/bills/mine"),
      ownPaymentMethod(),
      getJson<ClientPayment[]>("/api/payments/mine"),
    ]);
    return { pastJobs, bills, paymentMethod, history };
  },
  component: PortalPayments,
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
  loader: async () => {
    const [saved, pastJobs] = await Promise.all([
      ownPaymentMethod(),
      getJson<ClientPastJob[]>("/api/jobs/mine/past"),
    ]);
    // the cleans a card puts right; one waiting on the payment service we
    // try again ourselves
    return {
      saved,
      unpaid: pastJobs.filter((j) => j.unpaid && j.unpaid !== "waiting"),
    };
  },
  component: PortalPaymentMethod,
});

const portalRequestRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/request",
  loader: ownClient,
  component: PortalRequest,
});

// the Client's homes: what each is, and where it stands
const ownProperties = async () => {
  const [client, plans, quotes, jobs] = await Promise.all([
    ownClient(),
    getJson<ServicePlanSummary[]>("/api/service-plans/mine"),
    getJson<QuoteSummary[]>("/api/quotes/mine"),
    getJson<ClientUpcomingJob[]>("/api/jobs/mine"),
  ]);
  return { client, plans, quotes, jobs };
};

const portalDetailsRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/details",
  loader: ownProperties,
  component: PortalDetails,
});

const portalPropertyRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/properties/$propertyId",
  loader: async ({ params }) => {
    const data = await ownProperties();
    const property = data.client.properties.find(
      (p) => p.id === params.propertyId,
    );
    if (!property) throw notFound();
    return { ...data, property };
  },
  component: PortalProperty,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signInLinkRoute,
  confirmEmailRoute,
  welcomeRoute,
  peopleRoute,
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
  cleanerRoute.addChildren([
    cleanerHomeRoute,
    cleanerOffersRoute,
    cleanerJobRoute,
    cleanerNeededRoute,
  ]),
  portalRoute.addChildren([
    portalHomeRoute,
    portalRequestRoute,
    portalQuoteRoute,
    portalPlanRoute,
    portalCleansRoute,
    portalJobRoute,
    portalPaymentsRoute,
    portalBillRoute,
    portalDetailsRoute,
    portalPaymentMethodRoute,
    portalPropertyRoute,
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

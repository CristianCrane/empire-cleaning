import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { RouterProvider, ToastRegion } from "@empire-cleaning/ui";
import { AreaLayout } from "./screens/AreaLayout.tsx";
import { CleanerHome, OfficeHome, PortalHome } from "./screens/AreaHomes.tsx";
import { NotFound } from "./screens/NotFound.tsx";
import { SignIn } from "./screens/SignIn.tsx";
import { Welcome } from "./screens/Welcome.tsx";
import {
  areas,
  areasFor,
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

// an area is only for Accounts holding its role: anyone signed out goes to
// sign-in (and comes back afterwards), anyone else to their own area
const areaRoute = (id: AreaId) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: areas[id].path,
    beforeLoad: async ({ location }) => {
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

const officeRoute = areaRoute("office");
const cleanerRoute = areaRoute("cleaner");
const portalRoute = areaRoute("portal");

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  officeRoute.addChildren([
    createRoute({
      getParentRoute: () => officeRoute,
      path: "/",
      component: OfficeHome,
    }),
  ]),
  cleanerRoute.addChildren([
    createRoute({
      getParentRoute: () => cleanerRoute,
      path: "/",
      component: CleanerHome,
    }),
  ]),
  portalRoute.addChildren([
    createRoute({
      getParentRoute: () => portalRoute,
      path: "/",
      component: PortalHome,
    }),
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

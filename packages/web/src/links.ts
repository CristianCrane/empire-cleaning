import type {
  NavigateOptions,
  RegisteredRouter,
  ToOptions,
  ValidateLinkOptions,
} from "@tanstack/react-router";

// every design-system link takes an AppHref, which only linkTo() makes, so
// links get TanStack's full checking: the route must exist and its params
// must be given. linkTo({ to: "/office" })
declare const appHref: unique symbol;
export type AppHref = ToOptions & { readonly [appHref]: true };

export function linkTo<TOptions>(
  options: ValidateLinkOptions<RegisteredRouter, TOptions>,
): AppHref {
  return options as unknown as AppHref;
}

// two links to the same place: linkTo() makes a new one each time, so two
// built apart are never the same object
export const sameHref = (a: AppHref | undefined, b: AppHref | undefined) =>
  a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);

declare module "@empire-cleaning/ui" {
  interface RouterConfig {
    href: AppHref;
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

import type { ReactNode } from "react";
import {
  Link as AriaLink,
  composeRenderProps,
  type LinkProps,
} from "react-aria-components";
import type { VariantProps } from "tailwind-variants";
import { buttonStyles } from "./Button.tsx";
import { focusRing, tv } from "./utils.ts";

// a text link's look, for a plain <a> to somewhere outside the app too
export const linkStyles = tv({
  extend: focusRing,
  base: "rounded-sm font-semibold text-primary underline decoration-1 underline-offset-2 hover:decoration-2",
});

// a text link; inside the app it navigates through the app's router (see
// RouterProvider), so pass the router's link type as href
export function Link(props: LinkProps) {
  return (
    <AriaLink
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        linkStyles({ ...renderProps, className }),
      )}
    />
  );
}

// a link drawn as a button to somewhere outside the app: a phone number to
// call, a map's directions, an inbox. A web page opens in a new tab, as
// the app stays where it was; a phone number in place, as it opens the
// phone's dialler. A plain <a>, as the app's router reads every link
// ButtonLink draws, so it falls back to the browser's :focus-visible
export function ExternalButtonLink({
  href,
  variant,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
} & Pick<VariantProps<typeof buttonStyles>, "variant">) {
  return (
    <a
      href={href}
      {...(opensATab(href) ? { target: "_blank", rel: "noreferrer" } : {})}
      className={buttonStyles({
        variant,
        className: `no-underline ${className ?? ""}`,
      })}
    >
      {children}
    </a>
  );
}

// whether an outside link opens in a new tab: a web page does
export const opensATab = (href: string) => /^https?:/.test(href);

// a link drawn as a button, for navigation that's a main action on the page
// (e.g. "Request a Quote"); use Button for actions that don't go anywhere
export function ButtonLink({
  variant,
  size,
  ...props
}: LinkProps & VariantProps<typeof buttonStyles>) {
  return (
    <AriaLink
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        buttonStyles({
          ...renderProps,
          variant,
          size,
          className: `no-underline ${className ?? ""}`,
        }),
      )}
    />
  );
}

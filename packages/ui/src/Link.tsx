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

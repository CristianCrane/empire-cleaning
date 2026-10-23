import {
  Link as AriaLink,
  composeRenderProps,
  type LinkProps,
} from "react-aria-components";
import { focusRing, tv } from "./utils.ts";

const link = tv({
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
        link({ ...renderProps, className }),
      )}
    />
  );
}

import {
  Breadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Link as AriaLink,
  type LinkProps,
} from "react-aria-components";
import { ChevronRight } from "lucide-react";
import { focusRing, tv } from "./utils.ts";

export type Crumb = {
  label: string;
  // where it goes (the app's router link type); the last crumb is the current
  // page and needs none
  href?: LinkProps["href"];
};

const crumb = tv({
  extend: focusRing,
  base: "rounded-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline current:font-semibold current:text-fg current:no-underline",
});

// where you are in the app: the pages above this one, then this page. Put it
// at the top of any page more than one step from its area's navigation.
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <AriaBreadcrumbs className="flex flex-wrap items-center gap-1 text-sm">
      {trail.map(({ label, href }, i) => (
        <Breadcrumb key={label} className="flex items-center gap-1">
          <AriaLink href={href} className={(renderProps) => crumb(renderProps)}>
            {label}
          </AriaLink>
          {i < trail.length - 1 && (
            <ChevronRight aria-hidden size={14} className="text-fg-muted" />
          )}
        </Breadcrumb>
      ))}
    </AriaBreadcrumbs>
  );
}

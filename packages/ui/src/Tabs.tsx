import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  composeRenderProps,
  type TabListProps,
  type TabPanelProps,
  type TabProps,
  type TabsProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { composeTailwindRenderProps, focusRing } from "./utils.ts";

// views of one collection, e.g. a list's statuses: a row of Tabs over the
// TabPanel showing the chosen one. Scrolls sideways on a phone rather than
// wrapping.
export function Tabs(props: TabsProps) {
  return (
    <AriaTabs
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-4",
      )}
    />
  );
}

export function TabList<T extends object>(props: TabListProps<T>) {
  return (
    <AriaTabList
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        // the baseline drawn inside, under the Tabs' own underlines: a border
        // would need the Tabs to overlap it, which overflows and scrolls
        "flex overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]",
      )}
    />
  );
}

export function Tab({
  count,
  ...props
}: Omit<TabProps, "children"> & {
  children: ReactNode;
  // how many items the Tab holds, shown beside its name
  count?: number;
}) {
  return (
    <AriaTab
      {...props}
      className={composeRenderProps(
        props.className,
        (className, renderProps) =>
          `${focusRing(renderProps)} flex min-h-touch cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap -outline-offset-2 ${renderProps.isSelected ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg"} ${className ?? ""}`,
      )}
    >
      {props.children}
      {count !== undefined && (
        <span className="rounded-full bg-surface-sunken px-2 text-xs text-fg-muted">
          {count}
        </span>
      )}
    </AriaTab>
  );
}

export function TabPanel(props: TabPanelProps) {
  return (
    <AriaTabPanel
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    />
  );
}

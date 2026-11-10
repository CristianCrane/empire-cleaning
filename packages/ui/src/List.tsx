import {
  GridList,
  GridListItem,
  type GridListItemProps,
  type GridListProps,
} from "react-aria-components";
import { ChevronRight } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { composeTailwindRenderProps, focusRing } from "./utils.ts";

// whether rows open something, set by the List's (or a row's own) onAction
const OpensItems = createContext(false);

// the phone-first way to show a collection (today's Jobs, open Quotes):
// one tappable row per item. Give onAction to open an item.
export function List<T extends object>(props: GridListProps<T>) {
  return (
    <OpensItems.Provider value={props.onAction !== undefined}>
      <GridList
        {...props}
        className={composeTailwindRenderProps(
          props.className,
          "overflow-hidden rounded-lg border border-border bg-surface",
        )}
      />
    </OpensItems.Provider>
  );
}

export type ListItemProps = Omit<GridListItemProps, "children"> & {
  title: string;
  description?: ReactNode;
  // leading content, e.g. an Avatar
  start?: ReactNode;
  // trailing content, e.g. a StatusBadge
  end?: ReactNode;
  // in a row that opens nothing, its one action where the chevron would be,
  // beside the text at every width: a quiet icon Button, e.g. an X to take
  // someone off a Job's crew
  action?: ReactNode;
};

export function ListItem({
  title,
  description,
  start,
  end,
  action,
  ...props
}: ListItemProps) {
  const opens = useContext(OpensItems) || props.onAction !== undefined;

  // on a phone, `end` (a badge) goes under the text rather than squeezing
  // it beside: a grid of the text's column, with `start` and the chevron
  // (or `action`) beside both lines. A row with no `end` keeps its one line
  const stacked = end !== undefined && end !== null && end !== false;
  const grid = !stacked
    ? ""
    : start
      ? "max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:gap-y-1"
      : "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-y-1";
  const beside = !stacked
    ? ""
    : start
      ? "max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1"
      : "max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1";
  return (
    <GridListItem
      textValue={title}
      {...props}
      data-actionable={(opens && !props.isDisabled) || undefined}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex min-h-touch items-center gap-3 border-b border-border px-4 py-3 -outline-offset-2 last:border-b-0 ${grid} ${opens ? "hover:bg-surface-sunken pressed:bg-surface-sunken" : ""}`
      }
    >
      {({ isDisabled }) => (
        <>
          {start && (
            <div
              className={`shrink-0 self-center ${stacked ? "max-sm:row-span-2" : ""}`}
            >
              {start}
            </div>
          )}
          <div
            className={`flex min-w-0 flex-1 flex-col ${stacked && start ? "max-sm:col-start-2" : ""}`}
          >
            <span className="font-semibold text-fg [overflow-wrap:anywhere]">
              {title}
            </span>
            {description && (
              <span className="text-sm text-fg-muted">{description}</span>
            )}
          </div>
          {stacked && (
            <div
              className={`shrink-0 max-sm:row-start-2 max-sm:justify-self-start ${start ? "max-sm:col-start-2" : "max-sm:col-start-1"}`}
            >
              {end}
            </div>
          )}
          {action && (
            <div className={`shrink-0 self-center ${beside}`}>{action}</div>
          )}
          {opens && !isDisabled && (
            <ChevronRight
              aria-hidden
              size={20}
              className={`text-fg-muted self-center ${beside}`}
            />
          )}
        </>
      )}
    </GridListItem>
  );
}

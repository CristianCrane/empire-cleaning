import {
  GridList,
  GridListItem,
  type GridListItemProps,
  type GridListProps,
} from "react-aria-components";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { useUiWords } from "./language.ts";
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
  // what it opens is on its way: a spinner where its chevron is, as a
  // pending Button shows one, and "Opening" said to a screen reader. Disable
  // it too while pending, so a second press does nothing
  isPending?: boolean;
};

export function ListItem({
  title,
  description,
  start,
  end,
  isPending,
  ...props
}: ListItemProps) {
  const opens = useContext(OpensItems) || props.onAction !== undefined;

  const words = useUiWords();
  return (
    <GridListItem
      textValue={title}
      {...props}
      data-actionable={(opens && !props.isDisabled) || undefined}
      className={(renderProps) =>
        // on a phone, `end` (a badge) goes under the text rather than
        // squeezing it beside, `start` and the chevron spanning both lines
        `${focusRing(renderProps)} flex min-h-touch items-center gap-3 border-b border-border px-4 py-3 -outline-offset-2 last:border-b-0 max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:gap-y-1 ${opens ? "hover:bg-surface-sunken pressed:bg-surface-sunken" : ""}`
      }
    >
      {({ isDisabled }) => (
        <>
          {start && (
            <div className="shrink-0 self-center max-sm:row-span-2">
              {start}
            </div>
          )}
          <div
            className={`flex min-w-0 flex-1 flex-col ${start ? "max-sm:col-start-2" : "max-sm:col-span-2"}`}
          >
            <span className="font-semibold text-fg [overflow-wrap:anywhere]">
              {title}
            </span>
            {description && (
              <span className="text-sm text-fg-muted">{description}</span>
            )}
          </div>
          {end && (
            <div className="shrink-0 max-sm:col-start-2 max-sm:row-start-2 max-sm:justify-self-start">
              {end}
            </div>
          )}
          {/* there before it's pending, so a screen reader hears it change */}
          <span role="status" className="sr-only">
            {isPending ? words.opening : ""}
          </span>
          {isPending ? (
            <LoaderCircle
              aria-hidden
              size={20}
              className="animate-spin text-fg-muted self-center max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1"
            />
          ) : (
            opens &&
            !isDisabled && (
              <ChevronRight
                aria-hidden
                size={20}
                className="text-fg-muted self-center max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1"
              />
            )
          )}
        </>
      )}
    </GridListItem>
  );
}

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

// the phone-first way to show a collection (today's Jobs, Quote Requests):
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
};

export function ListItem({
  title,
  description,
  start,
  end,
  ...props
}: ListItemProps) {
  const opens = useContext(OpensItems) || props.onAction !== undefined;

  return (
    <GridListItem
      textValue={title}
      {...props}
      data-actionable={(opens && !props.isDisabled) || undefined}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex min-h-touch items-center gap-3 border-b border-border px-4 py-3 -outline-offset-2 last:border-b-0 ${opens ? "hover:bg-surface-sunken pressed:bg-surface-sunken" : ""}`
      }
    >
      {({ isDisabled }) => (
        <>
          {start}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-fg">{title}</span>
            {description && (
              <span className="text-sm text-fg-muted">{description}</span>
            )}
          </div>
          {end}
          {opens && !isDisabled && (
            <ChevronRight aria-hidden size={20} className="text-fg-muted" />
          )}
        </>
      )}
    </GridListItem>
  );
}

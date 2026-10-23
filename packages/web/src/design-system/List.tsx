import {
  GridList,
  GridListItem,
  type GridListItemProps,
  type GridListProps,
} from "react-aria-components";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { composeTailwindRenderProps, focusRing } from "./utils.ts";

// the phone-first way to show a collection (today's Jobs, Quote Requests):
// one tappable row per item. Give onAction to open an item.
export function List<T extends object>(props: GridListProps<T>) {
  return (
    <GridList
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "overflow-hidden rounded-lg border border-border bg-surface",
      )}
    />
  );
}

export type ListItemProps = Omit<GridListItemProps, "children"> & {
  title: string;
  description?: ReactNode;
  // trailing content, e.g. a StatusBadge
  end?: ReactNode;
};

export function ListItem({ title, description, end, ...props }: ListItemProps) {
  return (
    <GridListItem
      textValue={title}
      {...props}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex min-h-touch cursor-default items-center gap-3 border-b border-border px-4 py-3 -outline-offset-2 last:border-b-0 hover:bg-surface-sunken pressed:bg-surface-sunken`
      }
    >
      {({ isDisabled }) => (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-fg">{title}</span>
            {description && (
              <span className="text-sm text-fg-muted">{description}</span>
            )}
          </div>
          {end}
          {props.onAction && !isDisabled && (
            <ChevronRight aria-hidden size={20} className="text-fg-muted" />
          )}
        </>
      )}
    </GridListItem>
  );
}

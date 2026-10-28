import {
  Cell as AriaCell,
  Column as AriaColumn,
  Row as AriaRow,
  Table as AriaTable,
  TableBody as AriaTableBody,
  TableHeader as AriaTableHeader,
  composeRenderProps,
  type CellProps,
  type ColumnProps,
  type RowProps,
  type TableBodyProps,
  type TableHeaderProps,
  type TableProps,
} from "react-aria-components";
import { ArrowUp } from "lucide-react";
import { composeTailwindRenderProps, focusRing } from "./utils.ts";

// for the Office's dense, wide data on larger screens; on a phone, prefer List.
// Scrolls sideways inside its own frame rather than stretching the page.
export function Table(props: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <AriaTable
        {...props}
        className={composeTailwindRenderProps(
          props.className,
          "w-full border-separate border-spacing-0 text-left text-sm",
        )}
      />
    </div>
  );
}

export function TableHeader<T extends object>(props: TableHeaderProps<T>) {
  return (
    <AriaTableHeader
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "bg-surface-sunken",
      )}
    />
  );
}

export function Column(props: ColumnProps) {
  return (
    <AriaColumn
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "border-b border-border px-4 py-3 font-semibold whitespace-nowrap text-fg-muted outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
      )}
    >
      {composeRenderProps(
        props.children,
        (children, { allowsSorting, sortDirection }) => (
          <span className="inline-flex items-center gap-1">
            {children}
            {allowsSorting && (
              <ArrowUp
                aria-hidden
                size={14}
                className={`transition-transform ${sortDirection ? "" : "invisible"} ${sortDirection === "descending" ? "rotate-180" : ""}`}
              />
            )}
          </span>
        ),
      )}
    </AriaColumn>
  );
}

export function TableBody<T extends object>(props: TableBodyProps<T>) {
  return <AriaTableBody {...props} />;
}

export function Row<T extends object>(props: RowProps<T>) {
  return (
    <AriaRow
      {...props}
      className={composeRenderProps(
        props.className,
        (className, renderProps) =>
          `${focusRing(renderProps)} -outline-offset-2 text-fg hover:bg-surface-sunken selected:bg-success-subtle ${renderProps.isHovered ? "cursor-pointer" : ""} ${className ?? ""}`,
      )}
    />
  );
}

export function Cell(props: CellProps) {
  return (
    <AriaCell
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "border-b border-border px-4 py-3 outline-none [tr:last-child_&]:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
      )}
    />
  );
}

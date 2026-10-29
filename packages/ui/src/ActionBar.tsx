import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Toolbar,
  Tooltip,
  TooltipTrigger,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { Button } from "./Button.tsx";

// A row of icon Buttons for what can be done to a whole record, beside its
// title, where labelled Buttons would crowd it (a Job's Move, Ask for a new
// time, Cancel). Each names itself in a tooltip on hover or focus; arrow
// keys move between them.
export function ActionBar({
  children,
  ...props
}: {
  "aria-label": string;
  children: ReactNode;
}) {
  return (
    <Toolbar {...props} className="flex items-center gap-1">
      {children}
    </Toolbar>
  );
}

// One action in an ActionBar: an icon, named by its label (its tooltip and
// accessible name). Brand-coloured, or danger for one that undoes
// something, like Cancel. It can open a dialog: put it first inside a
// DialogTrigger.
export function IconAction({
  icon: Icon,
  label,
  danger = false,
  ...props
}: Omit<AriaButtonProps, "children" | "className"> & {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
}) {
  return (
    <TooltipTrigger delay={300} closeDelay={0}>
      <Button
        {...props}
        variant={danger ? "danger-text" : "text"}
        size="icon"
        aria-label={label}
      >
        <Icon aria-hidden size={20} />
      </Button>
      <Tooltip
        offset={6}
        className="rounded-md bg-fg px-2 py-1 text-sm font-semibold text-bg shadow-overlay entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out"
      >
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Separator,
  type MenuItemProps as AriaMenuItemProps,
} from "react-aria-components";
import { Button } from "./Button.tsx";
import { Popover } from "./Popover.tsx";

// What can be done to a whole record (a Job's Move, Ask for a new time,
// Cancel), at the end of its title row: an outlined Button named for what
// it holds, "Actions", a chevron after it, opening a menu of them. Each item
// says what it does in words. One that opens a dialog sets that dialog's
// isOpen from its onAction; focus comes back to the Button as it closes.
export function MenuButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <MenuTrigger>
      <Button variant="secondary" className="shrink-0">
        {label}
        <ChevronDown aria-hidden size={18} />
      </Button>
      <Popover placement="bottom end" className="min-w-56 p-1">
        <AriaMenu className="outline-none">{children}</AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

// one thing in a MenuButton's menu: an icon and what it does. danger for
// one that undoes something, like Cancel, last, after a MenuSeparator
export function MenuItem({
  icon: Icon,
  danger = false,
  children,
  ...props
}: Omit<AriaMenuItemProps, "children" | "className" | "textValue"> & {
  icon: LucideIcon;
  danger?: boolean;
  children: string;
}) {
  return (
    <AriaMenuItem
      {...props}
      textValue={children}
      className={`flex min-h-touch cursor-default items-center gap-3 rounded-md px-3 font-semibold outline-none focus:bg-surface-sunken ${danger ? "text-danger" : "text-fg"}`}
    >
      <Icon aria-hidden size={18} />
      {children}
    </AriaMenuItem>
  );
}

// a rule between a MenuButton's items, e.g. before a danger one
export function MenuSeparator() {
  return <Separator className="my-1 border-t border-border" />;
}

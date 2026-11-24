import type { ReactElement, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Separator,
  Text,
  type MenuItemProps as AriaMenuItemProps,
} from "react-aria-components";
import { Popover } from "./Popover.tsx";

// A menu opening under the Button given as its `trigger`, toward its end:
// what a page can do besides its next step, behind the split button's
// arrow or a quiet ⋯ (PageActions). Each item says what it does in words.
// One that opens a dialog sets that dialog's isOpen from its onAction;
// focus comes back to the trigger as it closes
export function Menu({
  trigger,
  children,
}: {
  // a Button, named for what the menu holds
  trigger: ReactElement;
  children: ReactNode;
}) {
  return (
    <MenuTrigger>
      {trigger}
      <Popover placement="bottom end" className="min-w-56 p-1">
        <AriaMenu className="outline-none">{children}</AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

// one thing in a Menu, or in an ActionSheet: an icon and what it does,
// `large` as a sheet's row, for a thumb. danger for one that loses what
// can't be got back, like Cancel, last, after a MenuSeparator. isDisabled
// greys it, as a Button is greyed, and `description` says under it why,
// at full strength, as the menu may cover the page's alert that says so
export function MenuItem({
  icon: Icon,
  danger = false,
  large = false,
  description,
  children,
  ...props
}: Omit<AriaMenuItemProps, "children" | "className" | "textValue"> & {
  icon: LucideIcon;
  danger?: boolean;
  large?: boolean;
  description?: string;
  children: string;
}) {
  const greyed = "group-data-disabled:opacity-50";
  return (
    <AriaMenuItem
      {...props}
      textValue={children}
      className={`group flex cursor-default items-center rounded-md font-semibold outline-none focus:bg-surface-sunken ${large ? "min-h-14 gap-4 px-4 text-lg" : "min-h-touch gap-3 px-3"} ${danger ? "text-danger" : "text-fg"}`}
    >
      <Icon
        aria-hidden
        size={large ? 22 : 18}
        className={`shrink-0 ${greyed}`}
      />
      {description ? (
        <span className="flex flex-col py-2">
          <Text slot="label" className={greyed}>
            {children}
          </Text>
          <Text
            slot="description"
            className={`font-normal text-fg-muted ${large ? "text-base" : "text-sm"}`}
          >
            {description}
          </Text>
        </span>
      ) : (
        <span className={greyed}>{children}</span>
      )}
    </AriaMenuItem>
  );
}

// a rule between a menu's items, e.g. before a danger one
export function MenuSeparator() {
  return <Separator className="my-1 border-t border-border" />;
}

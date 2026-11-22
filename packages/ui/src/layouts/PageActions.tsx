import { Fragment, useState, type ReactNode } from "react";
import type { LinkProps } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Button } from "../Button.tsx";
import type { DialogState } from "../Dialog.tsx";
import { useUiWords } from "../language.ts";
import { ButtonLink } from "../Link.tsx";
import { MenuButton, MenuItem, MenuSeparator } from "../Menu.tsx";

// Something done to the whole page's subject: a dialog it opens (given its
// open state), another page, or a thing done straight away. `danger` loses
// what can't be got back (the `ui` skill): red, and last; alone, outlined
// in red. `isPending` while one done straight
// away still runs (starting a Draft): the Button, or the Actions menu, shows
// it, so the press is seen to be heard
export type PageAction = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  isPending?: boolean;
} & (
  | { dialog: (state: DialogState) => ReactNode }
  | { href: NonNullable<LinkProps["href"]> }
  | { onAction: () => void }
);

// a page's actions as given: those that apply now, the rest false, null
// or undefined
export type PageActions = (PageAction | false | null | undefined)[];

// One action as a Button, or a ButtonLink when it opens another page; a
// dialog it opens is its own. A Record's one action where the menu would
// be (WEB-9), outlined in red when it's `danger` (the page has no primary
// then), a List's primary, and an empty List's way to fill it
export function ActionButton({
  action,
  variant,
}: {
  action: PageAction;
  variant: "primary" | "secondary";
}) {
  const [isOpen, setOpen] = useState(false);
  const look = action.danger ? "danger-outline" : variant;
  const content = (
    <>
      <action.icon aria-hidden size={18} />
      {action.label}
    </>
  );
  if ("href" in action)
    return (
      <ButtonLink variant={look} href={action.href} className="shrink-0">
        {content}
      </ButtonLink>
    );
  return (
    <>
      <Button
        variant={look}
        className="shrink-0"
        isPending={action.isPending}
        onPress={() => ("dialog" in action ? setOpen(true) : action.onAction())}
      >
        {content}
      </Button>
      {"dialog" in action && action.dialog({ isOpen, onOpenChange: setOpen })}
    </>
  );
}

// One action: a Button, where the menu would be (WEB-9). More: the Actions
// menu, the destructive ones last after a rule. Each dialog is the header's
// to open, so the menu that opened it has closed, and focus comes back to it
export function HeaderActions({ actions }: { actions: PageAction[] }) {
  const words = useUiWords();
  const [open, setOpen] = useState<string | null>(null);
  if (actions.length === 0) return null;
  if (actions.length === 1)
    return (
      <div className="shrink-0 print:hidden">
        <ActionButton action={actions[0]!} variant="secondary" />
      </div>
    );
  const press = (action: PageAction) => () => {
    if ("dialog" in action) setOpen(action.label);
    else if ("onAction" in action) action.onAction();
  };
  const plain = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);
  const item = (action: PageAction) => (
    <MenuItem
      key={action.label}
      icon={action.icon}
      danger={action.danger}
      {...("href" in action
        ? { href: action.href }
        : { onAction: press(action) })}
    >
      {action.label}
    </MenuItem>
  );
  return (
    <div className="shrink-0 print:hidden">
      <MenuButton
        label={words.actions}
        isPending={actions.some((a) => a.isPending)}
      >
        {plain.map(item)}
        {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
        {danger.map(item)}
      </MenuButton>
      {actions.map(
        (action) =>
          "dialog" in action && (
            <Fragment key={action.label}>
              {action.dialog({
                isOpen: open === action.label,
                onOpenChange: (isOpen) => setOpen(isOpen ? action.label : null),
              })}
            </Fragment>
          ),
      )}
    </div>
  );
}

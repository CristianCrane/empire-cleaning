import { Fragment, useState, type ReactNode } from "react";
import type { LinkProps } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs.tsx";
import { Button } from "../Button.tsx";
import { Heading } from "../Heading.tsx";
import { useUiWords } from "../language.ts";
import { ButtonLink } from "../Link.tsx";
import { MenuButton, MenuItem, MenuSeparator } from "../Menu.tsx";

// what opens a dialog from code: whether it's open, and told when it closes
export type DialogState = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

// Something done to the whole page's subject: a dialog it opens (given its
// open state), another page, or a thing done straight away. `danger` undoes
// or removes something: red, and last. `isPending` while one done straight
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

// The page header every screen type that has one shares (docs/ux.md,
// Screen types): the breadcrumbs from the area's nav section down to this
// page, every step, or none on a nav section's own page (a List); the
// title and its status; a subtitle only when it says what nothing else on
// the page does, never the title or a crumb again; and the page's actions
// in one place at the end of the title row, or a List's one primary there
// (New …). Printed, it's the title alone. A layout places it, never a
// screen (ADR-0031)
export function PageHeader({
  trail,
  title,
  inBar = false,
  status,
  subtitle,
  actions = [],
  primary,
  tools,
}: {
  // from the area's nav section to this page, which is last; none on the
  // section's own page
  trail?: Crumb[];
  title: string;
  // a nav section's own page, which a phone's top bar already names: the
  // title hidden there (Heading's inBar)
  inBar?: boolean;
  // its StatusBadge, or two
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: PageActions;
  // a List's one primary, filled: making a new one
  primary?: PageAction;
  // what else the layout keeps on the title row, before the actions (a
  // phone's search icon)
  tools?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      {trail && (
        <div className="print:hidden">
          <Breadcrumbs trail={trail} />
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Heading level={1} inBar={inBar}>
              {title}
            </Heading>
            {status}
          </div>
          {subtitle && <p className="text-lg text-fg-muted">{subtitle}</p>}
        </div>
        {tools && <div className="shrink-0 print:hidden">{tools}</div>}
        {primary ? (
          <div className="shrink-0 print:hidden">
            <ActionButton action={primary} variant="primary" />
          </div>
        ) : (
          <HeaderActions actions={actions.filter((a) => !!a)} />
        )}
      </div>
    </header>
  );
}

// One action as a Button, or a ButtonLink when it opens another page; a
// dialog it opens is its own. A Record's one action where the menu would
// be (WEB-9), a List's primary, and an empty List's way to fill it
export function ActionButton({
  action,
  variant,
}: {
  action: PageAction;
  variant: "primary" | "secondary";
}) {
  const [isOpen, setOpen] = useState(false);
  const look = action.danger ? "danger-text" : variant;
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
function HeaderActions({ actions }: { actions: PageAction[] }) {
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

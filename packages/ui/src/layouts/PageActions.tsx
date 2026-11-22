import { Fragment, useState, type ReactNode } from "react";
import { DialogTrigger, type LinkProps } from "react-aria-components";
import {
  ChevronDown,
  ChevronUp,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { ActionSheet } from "../ActionSheet.tsx";
import { Button } from "../Button.tsx";
import type { DialogState } from "../Dialog.tsx";
import { useUiWords } from "../language.ts";
import { ButtonLink } from "../Link.tsx";
import { Menu, MenuItem, MenuSeparator } from "../Menu.tsx";

// Something done to the whole page's subject: a dialog it opens (given its
// open state), another page, or a thing done straight away. `danger` loses
// what can't be got back (the `ui` skill): red, and last; alone, outlined
// in red. `isPending` while one done straight away still runs (starting a
// Draft): its Button, or what holds it (the split button's arrow, the ⋯),
// shows it, so the press is seen to be heard
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

// the dialogs of the actions one control holds, one open at a time, each
// drawn here rather than in the menu or sheet: so they outlive it as it
// closes, and focus comes back to the control as they close
function useDialogs(actions: PageAction[]) {
  const [open, setOpen] = useState<string | null>(null);
  const press = (action: PageAction) => () => {
    if ("dialog" in action) setOpen(action.label);
    else if ("onAction" in action) action.onAction();
  };
  const dialogs = actions.map(
    (action) =>
      "dialog" in action && (
        <Fragment key={action.label}>
          {action.dialog({
            isOpen: open === action.label,
            onOpenChange: (isOpen) => setOpen(isOpen ? action.label : null),
          })}
        </Fragment>
      ),
  );
  return { press, dialogs };
}

// One action as a Button, or a ButtonLink when it opens another page; a
// dialog it opens is its own. A page's one action when nothing is next
// (WEB-9), outlined in red when it's `danger` (the page has no primary
// then), a List's primary, an empty List's way to fill it, and the split
// button's main half. A `danger` one is outlined in red wherever it is:
// a page's next step never destroys, as the step a page leads to is done
// in the primary's colour (the `ui` skill)
export function ActionButton({
  action,
  variant,
  className = "shrink-0",
}: {
  action: PageAction;
  variant: "primary" | "secondary";
  className?: string;
}) {
  const { press, dialogs } = useDialogs([action]);
  const look = action.danger ? "danger-outline" : variant;
  const content = (
    <>
      <action.icon aria-hidden size={18} />
      {action.label}
    </>
  );
  if ("href" in action)
    return (
      <ButtonLink variant={look} href={action.href} className={className}>
        {content}
      </ButtonLink>
    );
  return (
    <>
      <Button
        variant={look}
        className={className}
        isPending={action.isPending}
        onPress={press(action)}
      >
        {content}
      </Button>
      {dialogs}
    </>
  );
}

// the actions as a menu's items, the destructive last after a rule; large
// in a phone's sheet
function items(
  actions: PageAction[],
  press: (action: PageAction) => () => void,
  large = false,
) {
  const plain = actions.filter((a) => !a.danger);
  const danger = actions.filter((a) => a.danger);
  const item = (action: PageAction) => (
    <MenuItem
      key={action.label}
      icon={action.icon}
      danger={action.danger}
      large={large}
      {...("href" in action
        ? { href: action.href }
        : { onAction: press(action) })}
    >
      {action.label}
    </MenuItem>
  );
  return (
    <>
      {plain.map(item)}
      {plain.length > 0 && danger.length > 0 && <MenuSeparator />}
      {danger.map(item)}
    </>
  );
}

// A page's one action control when something is next (docs/ux.md, Page
// structure): the next step, the primary, pressed straight away, and an
// arrow named "More actions" opening the rest, the destructive last after
// a rule: a menu under it at the top of a wider screen, a sheet from a
// phone's foot. With nothing more, the primary alone. Its dialogs are its
// own, so each place it's drawn (the title row, the header that sticks, a
// phone's foot) stands alone. In a header it's named "What to do", as a
// phone's foot holding it is, so a page with a next step says so at any
// width, and one with nothing next has no such group
export function SplitButton({
  next,
  more,
  opens,
}: {
  next: PageAction;
  more: PageAction[];
  opens: "menu" | "sheet";
}) {
  const words = useUiWords();
  const { press, dialogs } = useDialogs(more);
  const joined = more.length > 0 ? "rounded-r-none" : "";
  const Chevron = opens === "menu" ? ChevronDown : ChevronUp;
  const arrow = (
    <Button
      aria-label={words.moreActions}
      isPending={more.some((a) => a.isPending)}
      className="shrink-0 rounded-l-none border-l border-primary-fg/40 px-3"
    >
      <Chevron aria-hidden size={20} />
    </Button>
  );
  return (
    <div
      role={opens === "menu" ? "group" : undefined}
      aria-label={opens === "menu" ? words.whatToDo : undefined}
      className="flex w-full md:w-auto"
    >
      <ActionButton
        action={next}
        variant="primary"
        className={`flex-1 ${joined}`}
      />
      {more.length > 0 &&
        (opens === "sheet" ? (
          <DialogTrigger>
            {arrow}
            <ActionSheet label={words.moreActions}>
              {items(more, press, true)}
            </ActionSheet>
          </DialogTrigger>
        ) : (
          <Menu trigger={arrow}>{items(more, press)}</Menu>
        ))}
      {dialogs}
    </div>
  );
}

// A page's actions when nothing is next (docs/ux.md, Page structure): one
// stays a Button, as a menu of one would hide the page's only action
// (outlined in red when it destroys: the page has no primary then); more
// wait behind a quiet ⋯ named "More actions", the destructive last after a
// rule, so nothing stands in the primary's place
export function RareActions({ actions }: { actions: PageAction[] }) {
  const words = useUiWords();
  const { press, dialogs } = useDialogs(actions);
  if (actions.length === 0) return null;
  if (actions.length === 1)
    return <ActionButton action={actions[0]!} variant="secondary" />;
  return (
    <>
      <Menu
        trigger={
          <Button
            variant="quiet"
            size="icon"
            aria-label={words.moreActions}
            isPending={actions.some((a) => a.isPending)}
          >
            <Ellipsis aria-hidden size={22} />
          </Button>
        }
      >
        {items(actions, press)}
      </Menu>
      {dialogs}
    </>
  );
}

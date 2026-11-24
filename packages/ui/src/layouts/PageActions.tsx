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
import { ButtonLink, ExternalButtonLink, opensATab } from "../Link.tsx";
import { Menu, MenuItem, MenuSeparator } from "../Menu.tsx";

// Something done to the whole page's subject: a dialog it opens (given its
// open state), another page, somewhere outside the app (`externalHref`: a
// phone number to call, a map's directions, opened in a new tab), or a thing
// done straight away. `danger` loses what can't be got back (the `ui`
// skill): red, and last; alone, outlined in red. `isPending` while one done
// straight away still runs (starting a Draft): its Button, or what holds it
// (the split button's arrow, the ⋯), shows it, so the press is seen to be
// heard. `isDisabled` while the page's goal needs it but it can't be done
// yet: greyed, with why beside it (the `ui` skill): the page's alert says
// why, and `why` says it again in short under the item in a menu, which
// may cover the alert as it opens
export type PageAction = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  isPending?: boolean;
  isDisabled?: boolean;
  why?: string;
} & (
  | { dialog: (state: DialogState) => ReactNode }
  | { href: NonNullable<LinkProps["href"]> }
  | { externalHref: string }
  | { onAction: () => void }
);

// a page's actions as given: those that apply now, the rest false, null
// or undefined
export type PageActions = (PageAction | false | null | undefined)[];

// A page's next step, its primary, which may be more than an action behind
// an arrow can be: a form's submit button (New quote's Draft a quote, sent
// by the form, so its required fields are checked and Enter sends it); and
// named more fully to a screen reader where its label leans on the page
// (Send, to whom). Greyed while it can't be done yet as any action is
// (`isDisabled`: Send with no email)
export type NextAction = (
  | PageAction
  | (Omit<PageAction, "dialog" | "href" | "externalHref" | "onAction"> & {
      submit: true;
    })
) & { srLabel?: string };

// the dialogs of the actions one control holds, one open at a time, each
// drawn here rather than in the menu or sheet: so they outlive it as it
// closes, and focus comes back to the control as they close
function useDialogs(actions: PageAction[]) {
  const [open, setOpen] = useState<string | null>(null);
  const press = (action: PageAction) => () => {
    if ("dialog" in action) setOpen(action.label);
    else if ("onAction" in action) action.onAction();
    // a menu's item, which can't be a plain link: the app's router reads
    // every link a menu holds
    else if ("externalHref" in action)
      window.open(
        action.externalHref,
        opensATab(action.externalHref) ? "_blank" : "_self",
        "noopener",
      );
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
  action: PageAction | NextAction;
  variant: "primary" | "secondary";
  className?: string;
}) {
  const { press, dialogs } = useDialogs("submit" in action ? [] : [action]);
  const look = action.danger ? "danger-outline" : variant;
  const srLabel = "srLabel" in action && action.srLabel;
  const content = (
    <>
      <action.icon aria-hidden size={18} />
      {action.label}
      {srLabel && <span className="sr-only"> {srLabel}</span>}
    </>
  );
  if ("href" in action)
    return (
      <ButtonLink variant={look} href={action.href} className={className}>
        {content}
      </ButtonLink>
    );
  if ("externalHref" in action)
    return (
      <ExternalButtonLink
        variant={look}
        href={action.externalHref}
        className={className}
      >
        {content}
      </ExternalButtonLink>
    );
  return (
    <>
      <Button
        variant={look}
        className={className}
        isPending={action.isPending}
        isDisabled={action.isDisabled}
        {...("submit" in action
          ? { type: "submit" as const }
          : { onPress: press(action) })}
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
      isDisabled={action.isDisabled}
      description={action.isDisabled ? action.why : undefined}
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
  next: NextAction;
  more: PageAction[];
  opens: "menu" | "sheet";
}) {
  const words = useUiWords();
  const { press, dialogs } = useDialogs(more);
  const joined = more.length > 0 ? "rounded-r-none" : "";
  const Chevron = opens === "menu" ? ChevronDown : ChevronUp;
  // outlined while the primary can't be pressed, so the one control
  // doesn't show two ranks at once
  const arrow = (
    <Button
      aria-label={words.moreActions}
      variant={next.isDisabled ? "secondary" : "primary"}
      isPending={more.some((a) => a.isPending)}
      className={`shrink-0 rounded-l-none px-3 ${next.isDisabled ? "" : "border-l border-primary-fg/40"}`}
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

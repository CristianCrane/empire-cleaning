import {
  Dialog as AriaDialog,
  Link,
  Tooltip,
  TooltipTrigger,
  type LinkProps,
} from "react-aria-components";
import { Menu, CircleUserRound, type LucideIcon } from "lucide-react";
import {
  createContext,
  Fragment,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "../Button.tsx";
import { DialogTrigger } from "../Dialog.tsx";
import { Drawer } from "../Drawer.tsx";
import { Logo } from "../Logo.tsx";
import { Popover } from "../Popover.tsx";
import { staleFade } from "../stale.ts";
import { ThemeToggle } from "../theme.tsx";
import { useUiWords } from "../language.ts";
import { focusRing } from "../utils.ts";
import { LoadingBar, useLoadingShown } from "./LoadingBar.tsx";

// true inside AppLayout, which already gives a page its frame: a layout
// in it (MessagePage) leaves out a frame of its own
export const InAppLayout = createContext(false);

export type NavItem = {
  // whatever link type the app's router declares (see RouterProvider)
  href: NonNullable<LinkProps["href"]>;
  label: string;
  icon: LucideIcon;
  isCurrent?: boolean;
  // on a phone, not a shortcut in the tab bar, only in the ☰ menu (which
  // lists every section): for an area with more sections than the bar holds
  inMenu?: boolean;
  // the heading over related sections, e.g. "People" over Clients and Staff:
  // items next to each other with the same group sit under one heading. The
  // sidebar and the ☰ menu show it, the rail draws a rule between groups;
  // the tab bar doesn't
  group?: string;
  // how many wait there (the Cleaner's Offers), which the label says too:
  // the rail, with no room for the label, marks it on the icon
  count?: number;
};

// where the account's parts are drawn: "list", every part, at the foot of
// the sidebar and of the ☰ menu; from md to lg, "rail", only what must stay
// one press away (the other language), on the rail itself, and "popover",
// the rest, behind the rail's Account
export type FootPlace = "list" | "rail" | "popover";

export type AppLayoutProps = {
  // which part of the app this is, e.g. "Office" or "Cleaner"
  area: string;
  nav: NavItem[];
  // who is signed in and what they can do (switch area, sign out), one
  // plain item each, at the foot of the sidebar and of a phone's ☰ menu,
  // under a divider, the theme after it; on the rail, by `place`. Given
  // `close` to close the ☰ menu or the rail's Account it's in (the
  // sidebar's does nothing)
  foot: (opts: { close: () => void; place: FootPlace }) => ReactNode;
  // something pressed in the account's parts is under way (switching area):
  // the ☰ menu or the rail's Account holding it stays open
  menuBusy?: boolean;
  // the next page is loading, after a press that leaves this one: this page
  // can't be pressed from then until the next one shows, so a press meant
  // for the next page never lands on this one. Once it has gone on a
  // moment, a bar runs across the top and this page fades; a screen reader
  // hears "Loading…" once (#454)
  loading?: boolean;
  children: ReactNode;
};

// the frame around every screen. On a phone: a top bar holding only a ☰
// and the section's name, a bottom tab bar within thumb reach of five
// shortcuts at most (the items not inMenu), and the drawer the ☰ opens,
// the full menu: every section as the sidebar lists them, then the
// account's parts and the theme at its foot (#200, #305). From lg (1024)
// a sidebar, with the same foot. Between them, from md (768), the sidebar
// folds to a rail of icons, so a narrow laptop window keeps a laptop's
// ways and its room for the page: each section's name its tooltip, the
// current one highlighted, and at its foot the other language, named in its
// own words, and an Account holding the rest of the foot (#493).
//
// The logo is never shrunk to fit: the phone's top bar is too short for it,
// so the bar names the section you're in and the logo heads the ☰ menu
// instead, and the rail's Account; the sidebar has room for it (UX pass,
// #96)
export function AppLayout({
  area,
  nav,
  foot,
  menuBusy = false,
  loading = false,
  children,
}: AppLayoutProps) {
  const section = nav.find((item) => item.isCurrent)?.label ?? area;
  const tabs = nav.filter((item) => !item.inMenu);
  const words = useUiWords();
  const shown = useLoadingShown(loading);
  return (
    <div className="min-h-dvh md:flex">
      <LoadingBar shown={shown} />
      {/* said once as a load shows, and emptied, silently, as it ends */}
      <div role="status" className="sr-only">
        {shown ? words.loading : ""}
      </div>
      <a
        href="#main"
        className="sr-only z-50 rounded-md print:hidden bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="hidden w-side print:hidden shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-border bg-surface py-4 md:sticky md:top-0 md:flex md:h-dvh lg:hidden">
        <nav aria-label={area} className="flex flex-col items-center gap-2">
          <RailGroups items={nav} />
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2 border-t border-border pt-4">
          {foot({ close: () => {}, place: "rail" })}
          <RailAccount area={area} foot={foot} isBusy={menuBusy} />
        </div>
      </aside>

      <aside className="hidden w-side print:hidden shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <Head area={area} className="pt-2" />
        <nav aria-label={area} className="flex flex-1 flex-col gap-4">
          <NavGroups items={nav} />
        </nav>
        <Foot>{foot({ close: () => {}, place: "list" })}</Foot>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:hidden print:hidden">
        <div className="flex min-w-0 items-center gap-1">
          <DialogTrigger>
            <Button
              variant="quiet"
              size="icon"
              aria-label={words.menu}
              className="-ml-2 shrink-0"
            >
              <Menu aria-hidden size={22} />
            </Button>
            <Drawer aria-label={words.menu} isBusy={menuBusy}>
              {({ close }) => (
                <>
                  <Head area={area} className="pt-8" />
                  <nav aria-label={area} className="flex flex-col gap-4">
                    <NavGroups items={nav} onPress={close} />
                  </nav>
                  <Foot>{foot({ close, place: "list" })}</Foot>
                </>
              )}
            </Drawer>
          </DialogTrigger>
          <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
            {section}
          </span>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-4 pb-28 outline-none md:px-8 md:py-8 print:max-w-none print:p-0"
      >
        {/* the page on show, until the next one is ready; the navigation
            stays live, so another section can still be pressed. Out of
            reach at once, faded only after the hold */}
        <div aria-busy={shown} inert={loading} className={staleFade(shown)}>
          <InAppLayout value>{children}</InAppLayout>
        </div>
      </main>

      <nav
        aria-label={area}
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {tabs.map((item) => (
          <TabLink key={item.label} item={item} />
        ))}
      </nav>
    </div>
  );
}

// the logo and the area, at the head of the sidebar, the ☰ menu or the
// rail's Account
function Head({ area, className }: { area: string; className: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-2 ${className}`}>
      <Logo className="w-44" />
      <span className="text-sm text-fg-muted">{area}</span>
    </div>
  );
}

// the account's parts and the theme, at the foot of the sidebar or the ☰
// menu, and in the rail's Account
function Foot({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      {children}
      <ThemeToggle />
    </div>
  );
}

// each run of items next to each other with the same group (NavItem.group),
// in order; items with none make a run with no name
const runs = (items: NavItem[]) => {
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups;
};

// the rail's links, a rule between runs of groups, each named run a group
// for a screen reader, as the sidebar's are
function RailGroups({ items }: { items: NavItem[] }) {
  return runs(items).map((group, i) => (
    <Fragment key={group.items[0]!.label}>
      {i > 0 && <hr aria-hidden className="w-8 border-border" />}
      <div
        role={group.name ? "group" : undefined}
        aria-label={group.name}
        className="flex flex-col items-center gap-2"
      >
        {group.items.map((item) => (
          <RailLink key={item.label} item={item} />
        ))}
      </div>
    </Fragment>
  ));
}

// a section on the rail: its icon, its name the tooltip, and its text for a
// screen reader (and the tours, which find a link by its text); a count,
// such as the Offers waiting, marked on the icon
function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <RailTip label={item.label}>
      <Link
        href={item.href}
        aria-current={item.isCurrent ? "page" : undefined}
        className={(renderProps) =>
          `${focusRing(renderProps)} relative flex size-touch items-center justify-center rounded-md text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong`
        }
      >
        <Icon aria-hidden size={20} />
        <span className="sr-only">{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-fg tabular-nums"
          >
            {item.count}
          </span>
        )}
      </Link>
    </RailTip>
  );
}

// the account's parts the rail has no room for, behind one Account at its
// foot: the logo and the area at their head, as the ☰ menu's, then the
// sidebar's foot. It opens beside the rail, toward the page, and stays
// open while a switch of area is under way
function RailAccount({
  area,
  foot,
  isBusy,
}: {
  area: string;
  foot: AppLayoutProps["foot"];
  isBusy: boolean;
}) {
  const words = useUiWords();
  return (
    <DialogTrigger>
      <RailTip label={words.account}>
        <Button variant="quiet" size="icon" aria-label={words.account}>
          <CircleUserRound aria-hidden size={20} />
        </Button>
      </RailTip>
      <Popover
        placement="end bottom"
        offset={8}
        isKeyboardDismissDisabled={isBusy}
        shouldCloseOnInteractOutside={() => !isBusy}
        className="w-72 max-w-[calc(100vw-6rem)]"
      >
        <AriaDialog
          aria-label={words.account}
          className="flex flex-col gap-6 p-4 outline-none"
        >
          {({ close }) => (
            <>
              <Head area={area} className="" />
              <Foot>{foot({ close, place: "popover" })}</Foot>
            </>
          )}
        </AriaDialog>
      </Popover>
    </DialogTrigger>
  );
}

// a rail item's name, beside it on hover or keyboard focus
function RailTip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <TooltipTrigger delay={300}>
      {children}
      <Tooltip
        placement="end"
        offset={8}
        className="rounded-md bg-fg px-2 py-1 text-sm font-semibold text-bg shadow-overlay"
      >
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}

// the sidebar's or the menu's links, each run of items with the same group
// under its heading; items with none sit under the logo without one
function NavGroups({
  items,
  onPress,
}: {
  items: NavItem[];
  onPress?: () => void;
}) {
  return runs(items).map((group) => (
    <NavGroup key={group.items[0]!.label} name={group.name}>
      {group.items.map((item) => (
        <SidebarLink key={item.label} item={item} onPress={onPress} />
      ))}
    </NavGroup>
  ));
}

function NavGroup({ name, children }: { name?: string; children: ReactNode }) {
  const headingId = useId();
  if (!name) return <div className="flex flex-col gap-1">{children}</div>;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-1"
    >
      <span
        id={headingId}
        className="px-3 pt-1 text-xs font-semibold tracking-wide text-fg-muted uppercase"
      >
        {name}
      </span>
      {children}
    </div>
  );
}

function SidebarLink({
  item,
  onPress,
}: {
  item: NavItem;
  // e.g. closing the menu it sits in
  onPress?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={item.isCurrent ? "page" : undefined}
      onPress={onPress}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong`
      }
    >
      <Icon aria-hidden size={20} />
      {item.label}
    </Link>
  );
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={item.isCurrent ? "page" : undefined}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-fg-muted no-underline -outline-offset-2 current:text-primary`
      }
    >
      <Icon aria-hidden size={22} />
      {item.label}
    </Link>
  );
}

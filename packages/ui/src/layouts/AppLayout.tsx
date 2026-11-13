import { Link, type LinkProps } from "react-aria-components";
import { Menu, type LucideIcon } from "lucide-react";
import { createContext, useId, type ReactNode } from "react";
import { Button } from "../Button.tsx";
import { DialogTrigger } from "../Dialog.tsx";
import { Drawer } from "../Drawer.tsx";
import { Logo } from "../Logo.tsx";
import { ThemeToggle } from "../theme.tsx";
import { useUiWords } from "../language.ts";
import { focusRing } from "../utils.ts";

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
  // sidebar and the ☰ menu show it; the tab bar doesn't
  group?: string;
};

export type AppLayoutProps = {
  // which part of the app this is, e.g. "Office" or "Cleaner"
  area: string;
  nav: NavItem[];
  // who is signed in and what they can do (switch area, sign out), one
  // plain item each, at the foot of the sidebar and of a phone's ☰ menu,
  // under a divider, the theme after it. Given `close` to close the ☰
  // menu it's in (the sidebar's does nothing)
  foot: (opts: { close: () => void }) => ReactNode;
  // something pressed in the ☰ menu's foot is under way: it stays open
  menuBusy?: boolean;
  children: ReactNode;
};

// the frame around every screen. On a phone: a top bar holding only a ☰
// and the section's name, a bottom tab bar within thumb reach of five
// shortcuts at most (the items not inMenu), and the drawer the ☰ opens,
// the full menu: every section as the sidebar lists them, then the
// account's parts and the theme at its foot (#200, #305). From tablet width
// up: a sidebar, with the same foot.
//
// The logo is never shrunk to fit: the phone's top bar is too short for it,
// so the bar names the section you're in and the logo heads the ☰ menu
// instead; the sidebar has room for it (UX pass, #96)
export function AppLayout({
  area,
  nav,
  foot,
  menuBusy = false,
  children,
}: AppLayoutProps) {
  const section = nav.find((item) => item.isCurrent)?.label ?? area;
  const tabs = nav.filter((item) => !item.inMenu);
  const words = useUiWords();
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-md print:hidden bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 print:hidden shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="flex flex-col items-center gap-3 px-2 pt-2">
          <Logo className="w-44" />
          <span className="text-sm text-fg-muted">{area}</span>
        </div>
        <nav aria-label={area} className="flex flex-1 flex-col gap-4">
          <NavGroups items={nav} />
        </nav>
        <Foot>{foot({ close: () => {} })}</Foot>
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
                  <div className="flex flex-col items-center gap-3 px-2 pt-8">
                    <Logo className="w-44" />
                    <span className="text-sm text-fg-muted">{area}</span>
                  </div>
                  <nav aria-label={area} className="flex flex-col gap-4">
                    <NavGroups items={nav} onPress={close} />
                  </nav>
                  <Foot>{foot({ close })}</Foot>
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
        <InAppLayout value>{children}</InAppLayout>
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

// the account's parts and the theme, at the foot of the sidebar or the ☰
// menu
function Foot({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      {children}
      <ThemeToggle />
    </div>
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
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups.map((group) => (
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

import { Link } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme.tsx";
import { focusRing } from "./utils.ts";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isCurrent?: boolean;
};

export type AppLayoutProps = {
  // which part of the app this is, e.g. "Office" or "Cleaner"
  area: string;
  nav: NavItem[];
  children: ReactNode;
};

export function Wordmark() {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-display text-2xl font-bold tracking-wider text-fg uppercase">
        Empire
      </span>
      <span className="text-xs font-semibold tracking-widest text-primary uppercase">
        Cleaning &amp; Pro Services
      </span>
    </span>
  );
}

// the frame around every screen. On a phone: a top bar and a bottom tab bar
// within thumb reach (keep nav to five items or fewer). From tablet width up:
// a sidebar.
export function AppLayout({ area, nav, children }: AppLayoutProps) {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="flex flex-col gap-1 px-2 pt-2">
          <Wordmark />
          <span className="text-sm text-fg-muted">{area}</span>
        </div>
        <nav aria-label={area} className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </nav>
        <ThemeToggle />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 outline-none md:px-8 md:py-8"
      >
        {children}
      </main>

      <nav
        aria-label={area}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav.map((item) => (
          <TabLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={item.isCurrent ? "page" : undefined}
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
        `${focusRing(renderProps)} flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-fg-muted no-underline -outline-offset-2 current:text-primary`
      }
    >
      <Icon aria-hidden size={22} />
      {item.label}
    </Link>
  );
}

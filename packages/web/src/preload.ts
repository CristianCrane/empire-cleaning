import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

// how long a pointer rests on a link before its page starts loading, as
// TanStack's own Link waits
const HOVER_MS = 50;

// The page a link leads to starts loading as the person shows they'll press
// it: resting the pointer on it, focusing it, or pressing down. TanStack's
// `defaultPreload: "intent"` does this only for its own <Link>, and every
// link here is the design system's (react-aria's, through RouterProvider),
// so this does it once, for every link on every page: the sidebar, the tab
// bar, the ☰ menu (in a portal), crumbs, tiles. Listened for on the document
// as events start (capture), before a press handler can stop them. A press
// then reuses the load under way, or what it loaded (#454)
export function usePreloadOnIntent() {
  const router = useRouter();
  useEffect(() => {
    // the app's own page a link leads to, if it's one
    const hrefOf = (event: Event) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      const href = link?.getAttribute("href");
      if (!href?.startsWith("/") || href.startsWith("//")) return undefined;
      if (link!.hasAttribute("target") || link!.hasAttribute("download")) {
        return undefined;
      }
      return href;
    };
    // a preload's failure is the router's to log; the press, if it comes,
    // loads the page again and shows what went wrong
    const preload = (href: string) =>
      // an href as the link has it, which the router's typed `to` can't
      // check, as it isn't written here
      void router.preloadRoute({ href } as Parameters<
        typeof router.preloadRoute
      >[0]);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const rest = (event: PointerEvent) => {
      const href = hrefOf(event);
      // a touch presses down at once, which preloads
      if (!href || event.pointerType === "touch") return;
      clearTimeout(timer);
      timer = setTimeout(() => preload(href), HOVER_MS);
    };
    const leave = (event: PointerEvent) => {
      if (hrefOf(event)) clearTimeout(timer);
    };
    const now = (event: Event) => {
      const href = hrefOf(event);
      if (href) preload(href);
    };

    const listening: [string, (event: never) => void][] = [
      ["pointerover", rest],
      ["pointerout", leave],
      ["focusin", now],
      ["pointerdown", now],
    ];
    for (const [type, listener] of listening) {
      document.addEventListener(type, listener as EventListener, true);
    }
    return () => {
      clearTimeout(timer);
      for (const [type, listener] of listening) {
        document.removeEventListener(type, listener as EventListener, true);
      }
    };
  }, [router]);
}

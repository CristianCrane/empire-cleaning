import { useEffect, useEffectEvent } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { Me } from "@empire-cleaning/models";
import { startTour } from "@empire-cleaning/ui";
import { seeTour, type AreaId } from "../session.ts";
import { toursFor, type Target } from "./tours.ts";

const shown = (el: Element) => el.getClientRects().length > 0;

// the first of these that's there to be seen and whose words start so
const first = (
  within: Element | null,
  selector: string,
  wordsOf: (el: Element) => string | null | undefined,
  words: string,
) =>
  [...(within?.querySelectorAll(selector) ?? [])].find(
    (el) => shown(el) && wordsOf(el)?.trim().startsWith(words),
  );

// what a part is called: its label, or the text its label points at
const nameOf = (el: Element) =>
  el.getAttribute("aria-label") ??
  document.getElementById(el.getAttribute("aria-labelledby") ?? "")
    ?.textContent;

// a step's target on the screen now, if it's there to be seen. What's
// pressed is looked for on the screen before the area's navigation, which
// comes before it in the page on a wider screen
const find = (target: Target): Element | undefined => {
  const main = document.querySelector("main");
  if ("press" in target) {
    const text = (el: Element) => el.textContent;
    return (
      first(main, "a, button", text, target.press) ??
      first(document.body, "nav a", text, target.press)
    );
  }
  return first(main, "[aria-label], [aria-labelledby]", nameOf, target.named);
};

// Runs an area's first-time help (tours.ts) on each screen once it's drawn:
// the first tour for that screen the Account hasn't seen, and whose every
// step is on the screen. Closing it, done or partway, marks it seen. Looked
// at on each move to a screen, so after Show tips again a screen's tour shows
// on its next visit; the Account being asked for again (a return to the tab)
// leaves an open tour be.
export function useTours(area: AreaId, account: Me) {
  const router = useRouter();
  // where the router has finished drawing, not where it's headed: its
  // location changes before the next screen's data has loaded
  const drawn = useRouterState({ select: (s) => s.resolvedLocation?.href });

  // the tour for the screen drawn now, started; how to end it early
  const start = useEffectEvent(() => {
    const forArea = toursFor[area];
    const route = router.state.matches.at(-1)?.fullPath;
    for (const tour of forArea.tours) {
      if (tour.route !== route || account.seenTours.includes(tour.id)) {
        continue;
      }
      const elements = tour.steps.map((step) => find(step.target));
      if (!elements.every(Boolean)) continue;
      const steps = tour.steps.map((step, i) => ({
        element: elements[i],
        title: step.title,
        text: step.text,
      }));
      // the first of this area's tours they meet: an Account in two areas
      // meets each one's line
      if (!forArea.tours.some((t) => account.seenTours.includes(t.id))) {
        steps.unshift({
          element: undefined,
          title: "Welcome",
          text: forArea.welcome,
        });
      }
      return startTour(steps, () => seeTour(tour.id));
    }
    return undefined;
  });

  useEffect(() => {
    if (drawn === undefined) return;
    let stop: (() => void) | undefined;
    // a moment for the screen to settle (fonts, images) before pointing at it
    const timer = setTimeout(() => (stop = start()), 300);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [drawn]);
}

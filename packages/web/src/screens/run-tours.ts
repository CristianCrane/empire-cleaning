import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { Me } from "@empire-cleaning/models";
import { startTour } from "@empire-cleaning/ui";
import { seeTour, type AreaId } from "../session.ts";
import { toursFor, type Target } from "./tours.ts";

const shown = (el: Element) => el.getClientRects().length > 0;

// a step's target on the screen now, if it's there to be seen
const find = (target: Target): Element | undefined => {
  const main = document.querySelector("main");
  if (!main) return undefined;
  if ("link" in target) {
    return [...main.querySelectorAll("a")].find(
      (a) => shown(a) && a.textContent?.trim().startsWith(target.link),
    );
  }
  return [...main.querySelectorAll("section")].find(
    (s) =>
      shown(s) &&
      s.querySelector("h2, h3")?.textContent?.trim() === target.section,
  );
};

// Runs an area's first-time help (tours.ts) on each screen once it's drawn:
// the first tour for that screen the Account hasn't seen, and whose every
// step is on the screen. Closing it, done or partway, marks it seen. Looked
// at again after each move to a screen, and when the remembered Account is
// asked for again (Show tips again forgets the tours seen).
export function useTours(area: AreaId, account: Me) {
  const router = useRouter();
  // where the router has finished drawing, not where it's headed: its
  // location changes before the next screen's data has loaded
  const drawn = useRouterState({ select: (s) => s.resolvedLocation?.href });

  useEffect(() => {
    const forArea = toursFor[area];
    if (!forArea || drawn === undefined) return;
    const route = router.state.matches.at(-1)?.fullPath;
    let stop: (() => void) | undefined;
    // a moment for the screen to settle (fonts, images) before pointing at it
    const timer = setTimeout(() => {
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
        // the first tour they meet
        if (account.seenTours.length === 0) {
          steps.unshift({
            element: undefined,
            title: "Welcome",
            text: forArea.welcome,
          });
        }
        stop = startTour(steps, () => seeTour(account, tour.id));
        return;
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [area, account, drawn, router]);
}

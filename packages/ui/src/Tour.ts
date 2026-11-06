import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";

export type TourStep = {
  // what it points at; none for a word about the whole screen, in the middle
  element?: Element;
  title: string;
  text: string;
};

// driver.js sets a step's words as HTML: ours are always plain text
const asText = (words: string) =>
  words.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

const popupAttributes = ["aria-haspopup", "aria-expanded", "aria-controls"];

// A short spotlight tour of a screen: it dims the page and points at its
// parts in turn, each step's popover beside what it points at, so nothing on
// the page moves. onClose is called however it ends: done, or closed partway
// (Escape, ×, or a press outside). Only one runs at a time; the function
// returned ends it early, e.g. when the person leaves the screen.
export const startTour = (steps: TourStep[], onClose: () => void) => {
  const tour = driver({
    steps: steps.map((step, i) => ({
      element: step.element,
      popover: {
        title: asText(step.title),
        description: asText(step.text),
        // no Back on the first step, rather than one that can't be pressed
        showButtons:
          i === 0 ? ["next", "close"] : ["next", "previous", "close"],
      },
    })),
    showProgress: steps.length > 1,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    popoverClass: "ec-tour",
    overlayColor: "var(--ec-backdrop)",
    // the backdrop token is already see-through
    overlayOpacity: 1,
    stagePadding: 6,
    stageRadius: 12,
    onNextClick: () => {
      tour.moveNext();
      unmark();
    },
    onPrevClick: () => {
      tour.movePrevious();
      unmark();
    },
    onDestroyed: onClose,
  });
  // driver.js marks what a step points at as opening the popover, which it
  // doesn't, and which a section or a plain box mayn't say (axe). It does so
  // as each step starts, and puts back what was there when it moves on.
  const unmark = () =>
    popupAttributes.forEach((name) =>
      tour.getActiveElement()?.removeAttribute(name),
    );
  tour.drive();
  unmark();
  return () => tour.destroy();
};

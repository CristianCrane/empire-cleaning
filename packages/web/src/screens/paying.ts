import { useEffect, useEffectEvent, useRef } from "react";
import { reportUnexpected } from "../monitoring.ts";

// how often a page looks again while its Client pays (#534), so the Office,
// or the Client on another tab, sees it done, or free again, within seconds
const PAYING_LOOK_MS = 15_000;

// While the Client pays online and the one rule holds what else moves money
// (#534), `look` again every PAYING_LOOK_MS while the page is shown, and once
// the wait ends, as then what was held is free again: the one rule's alert
// gone, its action live. A second after `until`, as the server's clock may
// run behind ours, and the looks go on till its answer comes; past it, while
// their bank finishes it, every PAYING_LOOK_MS alone, as nothing says when
// that ends. A look that fails says nothing on the page: the next tries
// again. One at a time, as two at once would both tell of what they found,
// twice
export function useWhilePaying(
  paying: { until: string; finishing?: boolean } | null | undefined,
  look: () => Promise<unknown>,
) {
  const until = paying?.until;
  const finishing = paying?.finishing ?? false;
  const looking = useRef(false);
  const lookNow = useEffectEvent(() => {
    if (looking.current) return;
    looking.current = true;
    void look()
      .catch(reportUnexpected)
      .finally(() => {
        looking.current = false;
      });
  });
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") lookNow();
    }, PAYING_LOOK_MS);
    const end =
      !finishing &&
      setTimeout(lookNow, Math.max(0, Date.parse(until) - Date.now()) + 1000);
    return () => {
      clearInterval(timer);
      if (end) clearTimeout(end);
    };
  }, [until, finishing]);
}

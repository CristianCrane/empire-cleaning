import { useEffect, useState } from "react";

// how long the next page may take before anything shows: one that's ready
// sooner shows nothing, so a quick move doesn't flash (#454)
const HOLD_MS = 200;
// how long the bar takes to run to its end and fade, once the page shows
const FINISH_MS = 450;

// whether `loading` has gone on for HOLD_MS
export function useLoadingShown(loading: boolean) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setShown(true), HOLD_MS);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [loading]);
  return shown;
}

// A thin bar in the brand colour across the very top while the next page
// loads: it creeps towards the end, never reaching it, then runs to the end
// and fades as the page shows. With reduced motion every step is instant
// (tokens.css), so it's a still bar, there or not
export function LoadingBar({ shown }: { shown: boolean }) {
  const [phase, setPhase] = useState<"idle" | "start" | "grow" | "done">(
    "idle",
  );
  useEffect(() => {
    if (shown) {
      setPhase("start");
      // drawn empty first, so the creep has somewhere to start from
      const timer = setTimeout(() => setPhase("grow"), 20);
      return () => clearTimeout(timer);
    }
    setPhase((p) => (p === "idle" ? "idle" : "done"));
  }, [shown]);
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), FINISH_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  if (phase === "idle") return null;
  return (
    <div
      aria-hidden
      data-loading-bar={phase === "done" ? "done" : "loading"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden"
    >
      <div
        className={`h-full bg-primary ${
          phase === "start"
            ? "w-0"
            : phase === "grow"
              ? "w-[85%] transition-[width] duration-[8s] ease-[cubic-bezier(0.08,0.7,0.2,1)]"
              : "w-full opacity-0 [transition:width_150ms_ease-out,opacity_250ms_150ms]"
        }`}
      />
    </div>
  );
}

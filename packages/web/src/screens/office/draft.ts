import { useState } from "react";

// A form's draft of something kept in versions (the Price List, a Service),
// started from `initial`. It starts afresh when a newer version loads under
// it: a save made from an older one is refused and the page reloads to show
// the newer (#447), so what's on screen is what someone saved, never a
// figure nobody saw. The form stays, with why its save was refused.
export const useDraftOf = <T>(
  version: number | undefined,
  initial: () => T,
) => {
  const [draft, setDraft] = useState(initial);
  const [from, setFrom] = useState(version);
  if (from !== version) {
    setFrom(version);
    setDraft(initial());
  }
  return [draft, setDraft] as const;
};

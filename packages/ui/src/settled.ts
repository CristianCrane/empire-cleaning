import { useEffect, useState } from "react";

// how long typing pauses before a search follows it
const PAUSE_MS = 250;

// a search box's words, trimmed, once typing pauses: what a search runs on,
// so it doesn't run on every key
export function useSettled(text: string) {
  const [settled, setSettled] = useState(text.trim());
  useEffect(() => {
    const wanted = text.trim();
    const timer = setTimeout(() => setSettled(wanted), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  return settled;
}

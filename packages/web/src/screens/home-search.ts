import { useNavigate, useSearch } from "@tanstack/react-router";

// A Home's URL (docs/ux.md, Screen types, Home): which of its tiles is open
// in place, so Back from a row comes back to it open
export type HomeUrl<T extends string> = { open?: T };

// a Home route's validateSearch, given the ids of its tiles that open in
// place
export const homeUrl =
  <T extends string>(tiles: readonly T[]) =>
  (search: Record<string, unknown>): HomeUrl<T> => ({
    open: tiles.find((t) => t === search.open),
  });

// a Home's open tile and the way to change it, for HomePage's `open` and
// `onOpen`: in place, so the page stays where it was (as a List's Tab,
// list-search.ts); its route's validateSearch keeps only its own tiles
export function useHomeUrl() {
  const { open } = useSearch({ strict: false }) as HomeUrl<string>;
  const navigate = useNavigate();
  return {
    open,
    onOpen: (id: string | null) =>
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, open: id ?? undefined }) as typeof prev,
        replace: true,
        resetScroll: false,
      }),
  };
}

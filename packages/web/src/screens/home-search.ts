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

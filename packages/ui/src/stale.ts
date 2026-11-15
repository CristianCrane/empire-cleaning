// what's on screen while its next version loads (a page being left, prices
// being worked out again) fades until the new one shows, the one fade for
// both; mark it aria-busy beside this
export const staleFade = (stale: boolean) =>
  `transition-opacity ${stale ? "opacity-60" : ""}`;

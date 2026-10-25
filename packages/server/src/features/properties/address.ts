// One address is one home (per Client). People type the same place many ways
// ("41-12 Austin Street, Apt 4B" / "41 12 austin st. #4b"), so homes are
// compared by a normalised key rather than the text as typed.
//
// The key is only ever compared with other keys made here, except the one-off
// backfill in the migration that introduced it, which approximates this.

const streetWords: Record<string, string> = {
  street: "st",
  avenue: "ave",
  av: "ave",
  boulevard: "blvd",
  road: "rd",
  drive: "dr",
  place: "pl",
  lane: "ln",
  court: "ct",
  terrace: "ter",
  parkway: "pkwy",
  highway: "hwy",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

// how a unit is introduced, which says nothing about which unit it is
const unitDesignators = new Set([
  "apt",
  "apartment",
  "unit",
  "suite",
  "ste",
  "no",
]);

const words = (text: string) =>
  text
    .toLowerCase()
    // 71st -> 71, so "71st Ave" and "71 Ave" match
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    // punctuation and hyphens separate words; "41-12" is "41 12"
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

export const addressKey = (address: {
  street: string;
  unit?: string | null;
  postcode: string;
}) => {
  const street = words(address.street)
    .map((word) => streetWords[word] ?? word)
    .join(" ");
  const unit = words(address.unit ?? "")
    .filter((word) => !unitDesignators.has(word))
    .map((word) => (word === "floor" ? "fl" : word))
    .join(" ");
  return `${street}|${unit}|${address.postcode.trim()}`;
};

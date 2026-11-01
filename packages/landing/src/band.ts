// a page's bands alternate, plain then raised, whatever their order: every
// second <section> straight under <main> is raised, the hero being the
// first, plain. A card takes the other colour from its band, so it stands
// out from it wherever it sits
export const raisedBand =
  "[main>&:nth-of-type(even)]:border-y [main>&:nth-of-type(even)]:border-border [main>&:nth-of-type(even)]:bg-surface";
export const card = "bg-surface in-[main>section:nth-of-type(even)]:bg-bg";

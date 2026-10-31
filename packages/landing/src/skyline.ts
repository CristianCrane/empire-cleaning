// the hero's skyline, west to east across the area we serve: Long Island
// houses and trees, Queens row houses with water towers on their roofs, then
// Manhattan's towers. Drawn once at build time from a seeded random, so it's
// the same on every build
export const width = 1600;
export const height = 260;

let seed = 7;
const rand = (min: number, max: number) => {
  seed = (seed * 16807) % 2147483647;
  return min + ((seed - 1) / 2147483646) * (max - min);
};

const shapes: string[] = [];
const rect = (x: number, w: number, h: number) =>
  shapes.push(`M${x} ${height}V${height - h}H${x + w}V${height}Z`);

// Long Island: houses with pitched roofs, and trees
for (let x = 0; x < 520;) {
  const w = rand(60, 86);
  const h = rand(34, 52);
  const roof = rand(20, 32);
  shapes.push(
    `M${x} ${height}V${height - h}L${x + w / 2} ${height - h - roof}L${x + w} ${height - h}V${height}Z`,
  );
  x += w + rand(10, 22);
  if (rand(0, 1) > 0.45 && x < 500) {
    const r = rand(14, 22);
    const trunk = rand(18, 26);
    shapes.push(
      `M${x + r - 2} ${height}V${height - trunk}h4V${height}Z`,
      `M${x} ${height - trunk - r}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`,
    );
    x += 2 * r + rand(8, 16);
  }
}

// Queens: row houses shoulder to shoulder, some with a water tower
for (let x = 540; x < 1080;) {
  const w = rand(34, 54);
  const h = rand(56, 120);
  // a cornice
  rect(x - 2, w + 4, h - rand(4, 8));
  rect(x, w, h);
  if (rand(0, 1) > 0.6) {
    const tx = x + w / 2 - 9;
    const top = height - h;
    shapes.push(
      `M${tx + 2} ${top}V${top - 10}h2V${top}Z`,
      `M${tx + 14} ${top}V${top - 10}h2V${top}Z`,
      `M${tx} ${top - 10}V${top - 32}H${tx + 18}V${top - 10}Z`,
      `M${tx - 1} ${top - 32}L${tx + 9} ${top - 42}L${tx + 19} ${top - 32}Z`,
    );
  }
  x += w + (rand(0, 1) > 0.75 ? rand(8, 16) : 0);
}

// Manhattan: towers, setbacks and the odd spire
for (let x = 1110; x < width;) {
  const w = rand(30, 58);
  const h = rand(110, 200);
  rect(x, w, h);
  // a set-back storey, and sometimes a spire on whichever is the top
  const rise = rand(0, 1) > 0.5 ? rand(14, 26) : 0;
  if (rise) rect(x + w * 0.2, w * 0.6, h + rise);
  if (rand(0, 1) > 0.8) {
    const top = height - h - rise;
    shapes.push(`M${x + w / 2 - 1} ${top}V${top - 30}h2V${top}Z`);
  }
  x += w + rand(2, 10);
}

export const skyline = shapes.join("");

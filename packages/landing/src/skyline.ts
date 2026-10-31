// the hero's skyline: outlined towers in the logo's manner (flat, stepped,
// set-back and slanted tops), a back row behind a front row. Drawn once at
// build time from a seeded random, so it's the same on every build. Each
// tower is an open outline, no line along the ground
// wider than any screen's strip (12:1), so a strip is only ever cropped at
// its sides, never across the tops
export const width = 2400;
export const height = 200;

let seed = 11;
const rand = (min: number, max: number) => {
  seed = (seed * 16807) % 2147483647;
  return min + ((seed - 1) / 2147483646) * (max - min);
};

const tower = (x: number, w: number, h: number) => {
  const top = height - h;
  const right = x + w;
  let d = `M${x} ${height}V${top}`;
  const kind = rand(0, 1);
  if (kind < 0.3) {
    d += `H${right}`;
  } else if (kind < 0.55) {
    // set back: a narrower storey on top
    const inset = w * rand(0.2, 0.3);
    const rise = rand(12, 24);
    d += `H${x + inset}V${top - rise}H${right - inset}V${top}H${right}`;
  } else if (kind < 0.8) {
    // stepped: the right half lower
    d += `H${x + w * rand(0.45, 0.6)}V${top + rand(12, 22)}H${right}`;
  } else {
    // slanted, rising to the right
    d += `L${right} ${top - rand(14, 26)}`;
  }
  return d + `V${height}`;
};

const row = (
  minH: number,
  maxH: number,
  minW: number,
  maxW: number,
  gap: [number, number],
) => {
  const towers: string[] = [];
  for (let x = rand(-30, 0); x < width; ) {
    const w = rand(minW, maxW);
    towers.push(tower(x, w, rand(minH, maxH)));
    x += w + rand(...gap);
  }
  return towers;
};

// back first, so the front row covers it
export const back = row(110, 175, 40, 64, [20, 90]);
export const front = row(40, 130, 36, 60, [-12, 8]);

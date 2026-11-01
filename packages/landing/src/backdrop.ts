// the hero's background, after the owner's banner: drawn once at build time

// a cluster of towers behind the logo, as in the banner: [x, width, height,
// spire]
const towers: [number, number, number, number][] = [
  [0, 46, 150, 0],
  [40, 38, 210, 0],
  [74, 54, 175, 0],
  [122, 40, 300, 34],
  [158, 58, 250, 0],
  [210, 34, 340, 60],
  [240, 62, 230, 0],
  [296, 44, 280, 0],
  [334, 70, 190, 0],
  [398, 40, 240, 22],
  [432, 56, 160, 0],
  [482, 44, 205, 0],
  [520, 64, 130, 0],
  [578, 40, 170, 0],
  [612, 58, 110, 0],
];
export const skyline = { width: 670, height: 420 };
export const towersPath = towers
  .map(([x, w, h, spire]) => {
    const top = skyline.height - h;
    const body = `M${x} ${skyline.height}V${top}H${x + w}V${skyline.height}Z`;
    const mid = x + w / 2;
    return spire ? `${body}M${mid - 3} ${top}V${top - spire}h6V${top}Z` : body;
  })
  .join("");

// the silk ripples in the band under the buttons, in a 1440 by 160 box
export const ripples = Array.from({ length: 9 }, (_, i) => {
  const y = 30 + i * 13;
  return `M-40 ${y + 30}C260 ${y - 40} 520 ${y + 50} 820 ${y + 5}S1260 ${y - 35} 1480 ${y + 15}`;
});

// a four-point glint, centred on (cx, cy)
export const glint = (cx: number, cy: number, r: number) => {
  const k = r * 0.14;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
};

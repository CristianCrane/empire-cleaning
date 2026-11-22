// component tests render with the real styles, so they see what people see
import "./tokens.css";

// and the real fonts, loaded before any test measures: a font loads only
// once text first asks for it, so a test measuring right after it renders
// could read a fallback's widths (Field.test's Price ran 126 px in a
// 118 px box, a fallback's width, on a loaded machine)
await Promise.all(
  [
    "16px Barlow",
    "500 16px Barlow",
    "600 16px Barlow",
    "600 16px 'Barlow Condensed'",
    "700 16px 'Barlow Condensed'",
  ].map((font) => document.fonts.load(font)),
);

// the font files a first screen draws with, for a page to preload so its text
// doesn't reflow from a fallback font when they arrive: Barlow Condensed for
// headings, Barlow for text and its semibold for labels and buttons. Latin
// only; the rest load as they're needed (tokens.css).
import headings from "@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url";
import text from "@fontsource/barlow/files/barlow-latin-400-normal.woff2?url";
import strong from "@fontsource/barlow/files/barlow-latin-600-normal.woff2?url";

export const firstScreenFonts = [headings, text, strong];

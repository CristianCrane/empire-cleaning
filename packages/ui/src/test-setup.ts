// component tests render with the real styles, so they see what people see
import "./tokens.css";

// and in the real fonts, loaded before any test measures text: a web font
// loads only once text uses it, so a test measuring right after its render
// saw the fallback's widths on a cold run ($100,000.00 126px wide in
// system-ui against 118 in Barlow; docs/testing-log.md). Every face the
// styles declare, so a weight added to tokens.css is loaded too
await Promise.all([...document.fonts].map((face) => face.load()));

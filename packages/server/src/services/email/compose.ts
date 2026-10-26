// the pieces every notification email is written from: paragraphs of plain
// text, and a link at the end, sent as both text and HTML

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
// cents to "$391.04"
export const formatMoney = (cents: number) => money.format(cents / 100);

const when = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
// "Monday, January 12 at 9:00 AM", in New York
export const formatWhen = (instant: Date) => when.format(instant);

const weekday = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "America/New_York",
});
// "Monday", in New York
export const weekdayName = (instant: Date) => weekday.format(instant);

const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
// "9:00 AM", in New York
export const formatTime = (instant: Date) => time.format(instant);

// each line a paragraph (a "\n" inside one is a line break), then the link
export const compose = (
  lines: string[],
  link: { href: string; label: string },
) => ({
  text: [...lines, link.href].join("\n\n"),
  html: [
    ...lines.map(
      (line) => `<p>${escapeHtml(line).replaceAll("\n", "<br>")}</p>`,
    ),
    `<p><a href="${link.href}">${escapeHtml(link.label)}</a></p>`,
  ].join(""),
});

export const firstNameOf = (name: string) => name.split(" ")[0]!;

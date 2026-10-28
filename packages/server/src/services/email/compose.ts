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

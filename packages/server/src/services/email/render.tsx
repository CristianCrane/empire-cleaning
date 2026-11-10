import type { Language } from "@empire-cleaning/models";
import { render } from "react-email";
import { greetingText, type Block, type Email, type Row } from "./blocks.ts";
import { EmailLayout, footerLine } from "./layout.tsx";

const lines = (rows: Row[]) =>
  rows.map((row) => `${row.label}: ${row.value}`).join("\n");

const textOf = (block: Block, lang: Language) => {
  switch (block.kind) {
    case "greeting":
      return greetingText(lang, block.name);
    case "paragraph":
      return block.text;
    case "details":
      return lines(block.rows);
    case "amounts":
      return lines([...block.rows, block.total]);
    case "button":
      return block.href;
  }
};

// the text part: one paragraph per block, the button as its raw URL, and the
// footer after the usual "-- " signature line
const emailText = (email: Email) =>
  [
    ...email.blocks.map((block) => textOf(block, email.lang ?? "en")),
    `-- \n${footerLine}`,
  ].join("\n\n");

// logoUrl: where the logo PNG is served (logoUrlOn the landing site)
export const renderEmail = async (email: Email, logoUrl: string) => ({
  subject: email.subject,
  html: await render(<EmailLayout email={email} logoUrl={logoUrl} />),
  text: emailText(email),
});

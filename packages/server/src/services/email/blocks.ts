import { catalog, type Language, formats } from "@empire-cleaning/models";

// what every email is written from: a builder next to its feature returns
// blocks, and the shared layout (layout.tsx) turns them into the HTML and the
// text part. Pure, so the preview server can import builders without the
// server's environment.

// a "Label: value" line, e.g. When: Monday, January 12 at 9:00 AM
export type Row = { label: string; value: string };

export type Block =
  // "Hi Ana,"
  | { kind: "greeting"; name: string }
  // a "\n" inside one is a line break
  | { kind: "paragraph"; text: string }
  // the facts of a clean: when, where, which Service
  | { kind: "details"; rows: Row[] }
  // money, with the total last and in bold
  | { kind: "amounts"; rows: Row[]; total: Row }
  // the one thing to do; the text part prints its raw URL. A path, like
  // "/portal", is in the web app
  | { kind: "button"; label: string; href: string };

export type Email = {
  // the language it's written in, for its `lang`, greeting and footer: a
  // Client's or Staff member's Preferred Language (ADR-0025); English to the
  // Office, through `messages.en` and `formats.en`
  lang: Language;
  subject: string;
  // the inbox preview line; by default the first paragraph
  preview?: string;
  blocks: Block[];
};

export const greeting = (name: string): Block => ({ kind: "greeting", name });

// a greeting block's words, in the HTML and the text part alike
const greetings = catalog({
  en: (name: string) => `Hi ${name},`,
  es: (name: string) => `Hola, ${name}:`,
});
export const greetingText = (lang: Language, name: string) =>
  greetings[lang](name);

export const paragraph = (text: string): Block => ({ kind: "paragraph", text });

export const details = (rows: Row[]): Block => ({ kind: "details", rows });

// amounts in cents, as `lang` writes money, e.g. amounts("en", [["Clean",
// 12000]], ["Total", 12000])
export const amounts = (
  lang: Language,
  rows: [label: string, cents: number][],
  [totalLabel, totalCents]: [label: string, cents: number],
): Block => {
  const { formatMoney } = formats[lang];
  return {
    kind: "amounts",
    rows: rows.map(([label, cents]) => ({ label, value: formatMoney(cents) })),
    total: { label: totalLabel, value: formatMoney(totalCents) },
  };
};

export const button = (label: string, href: string): Block => ({
  kind: "button",
  label,
  href,
});

// the buttons many emails end on, into a Client's Job (`label` when it says
// more than "See your clean") or all their cleans, and the Office's Job
const buttonWords = catalog({
  en: { SEE_CLEAN: "See your clean", SEE_CLEANS: "See your cleans" },
  es: { SEE_CLEAN: "Ver su limpieza", SEE_CLEANS: "Ver sus limpiezas" },
});
export const cleanButton = (lang: Language, jobId: string, label?: string) =>
  button(label ?? buttonWords[lang].SEE_CLEAN, `/portal/jobs/${jobId}`);
export const cleansButton = (lang: Language) =>
  button(buttonWords[lang].SEE_CLEANS, "/portal");
export const officeJobButton = (jobId: string) =>
  button("See the job", `/office/jobs/${jobId}`);

// a Job or Site Visit, as the details of an email about it
export type Clean = { service: string; address: string; startsAt: Date };

// the labels of a clean's or a visit's details, in each language
export const detailWords = catalog({
  en: { WHEN: "When", WAS: "Was", WHERE: "Where", SERVICE: "Service" },
  es: {
    WHEN: "Cuándo",
    WAS: "Antes",
    WHERE: "Dónde",
    SERVICE: "Servicio",
  },
});

// When, Where and Service; `was` is the time a move took it from
export const cleanDetails = (
  lang: Language,
  { service, address, startsAt }: Clean,
  was?: Date,
): Block => {
  const w = detailWords[lang];
  const { formatWhen } = formats[lang];
  return details([
    { label: w.WHEN, value: formatWhen(startsAt) },
    ...(was ? [{ label: w.WAS, value: formatWhen(was) }] : []),
    { label: w.WHERE, value: address },
    { label: w.SERVICE, value: service },
  ]);
};

// a button's path made a full URL in the web app at `appUrl`, saying the
// email's language (`lang`), so the page it opens is in it before sign-in
// too, as the landing site's links say theirs
export const withAppUrl = (email: Email, appUrl: string): Email => ({
  ...email,
  blocks: email.blocks.map((block) => {
    if (block.kind !== "button" || !block.href.startsWith("/")) return block;
    const url = new URL(`${appUrl.replace(/\/$/, "")}${block.href}`);
    url.searchParams.set("lang", email.lang);
    return { ...block, href: url.toString() };
  }),
});

export const previewOf = (email: Email) =>
  email.preview ??
  email.blocks.find((block) => block.kind === "paragraph")?.text ??
  "";

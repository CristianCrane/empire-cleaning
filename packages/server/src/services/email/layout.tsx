import { business } from "@empire-cleaning/models";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";
import type { CSSProperties } from "react";
import { previewOf, type Block, type Email, type Row } from "./blocks.ts";

// the brand, as hex: email clients don't know CSS variables. Keep in step with
// packages/ui/src/tokens.css (light theme). One light design only: Gmail and
// Outlook darken it themselves, so there are no dark styles to fight them.
const colour = {
  green: "#06682F",
  charcoal: "#434345",
  ink: "#101923",
  muted: "#55585c",
  surface: "#ffffff",
  page: "#f0f0f0",
  border: "#d9dbdd",
};

const font = "Barlow, Arial, Helvetica, sans-serif";

const text: CSSProperties = {
  fontFamily: font,
  fontSize: "16px",
  lineHeight: "24px",
  color: colour.ink,
  margin: "0 0 16px",
};

// a paragraph's own line breaks, kept
const Lines = ({ text }: { text: string }) =>
  text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ));

// one table, so every row's columns line up (React Email's Row is a table
// of its own)
const LabelledRows = ({ rows, total }: { rows: Row[]; total?: Row }) => (
  <table
    role="presentation"
    width="100%"
    border={0}
    cellPadding={0}
    cellSpacing={0}
    style={{
      margin: "0 0 16px",
      border: `1px solid ${colour.border}`,
      borderRadius: "6px",
      borderCollapse: "separate",
    }}
  >
    <tbody>
      {[...rows, ...(total ? [total] : [])].map((row, i) => {
        const isTotal = total !== undefined && i === rows.length;
        const cell: CSSProperties = {
          ...text,
          margin: 0,
          padding: "8px 12px",
          borderTop: i > 0 ? `1px solid ${colour.border}` : undefined,
          fontWeight: isTotal ? 700 : 400,
          verticalAlign: "top",
        };
        return (
          <tr key={i}>
            <td
              style={{
                ...cell,
                color: isTotal ? colour.ink : colour.muted,
                // details' labels only as wide as the longest one
                ...(total ? {} : { width: "1%", whiteSpace: "nowrap" }),
              }}
            >
              {row.label}
            </td>
            <td style={{ ...cell, textAlign: total ? "right" : "left" }}>
              {row.value}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// bulletproof: the cell's background shows in Outlook, which ignores the
// link's padding; React Email's Button pads the link for Outlook too. A bare
// table, as wide as the button, where React Email's would fill the row.
const ActionButton = ({ label, href }: { label: string; href: string }) => (
  <table
    role="presentation"
    border={0}
    cellPadding={0}
    cellSpacing={0}
    style={{ margin: "8px 0 24px" }}
  >
    <tbody>
      <tr>
        <td
          // an old attribute React doesn't type, but Outlook reads
          {...{ bgcolor: colour.green }}
          style={{ backgroundColor: colour.green, borderRadius: "6px" }}
        >
          <Button
            href={href}
            style={{
              fontFamily: font,
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: "24px",
              color: "#ffffff",
              backgroundColor: colour.green,
              borderRadius: "6px",
              padding: "12px 24px",
            }}
          >
            {label}
          </Button>
        </td>
      </tr>
    </tbody>
  </table>
);

const BlockView = ({ block }: { block: Block }) => {
  switch (block.kind) {
    case "greeting":
      return <Text style={text}>Hi {block.name},</Text>;
    case "paragraph":
      return (
        <Text style={text}>
          <Lines text={block.text} />
        </Text>
      );
    case "details":
      return <LabelledRows rows={block.rows} />;
    case "amounts":
      return <LabelledRows rows={block.rows} total={block.total} />;
    case "button":
      return <ActionButton label={block.label} href={block.href} />;
  }
};

// the logo, as a PNG on the landing site: email clients drop SVG and inline
// images. Drawn at 3x for sharp screens
const logoWidth = 160;

const Logo = ({ src }: { src: string }) => (
  <Section style={{ padding: "24px 24px 0" }}>
    <Img
      src={src}
      width={logoWidth}
      height={Math.round((logoWidth * 220) / 210)}
      alt={business.name}
    />
  </Section>
);

const footer = [
  business.name,
  business.area,
  business.phone.display,
  business.site,
];

export const footerLine = footer.join(" · ");

// logoUrl: the logo PNG on the landing site (see logoUrlOn)
export const EmailLayout = ({
  email,
  logoUrl,
}: {
  email: Email;
  logoUrl: string;
}) => (
  <Html lang="en">
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&display=swap"
      />
    </Head>
    <Preview>{previewOf(email)}</Preview>
    <Body
      style={{ backgroundColor: colour.page, margin: 0, padding: "24px 0" }}
    >
      <Container
        style={{
          maxWidth: "560px",
          backgroundColor: colour.surface,
          border: `1px solid ${colour.border}`,
          borderTop: `4px solid ${colour.green}`,
          borderRadius: "6px",
        }}
      >
        <Logo src={logoUrl} />
        <Section style={{ padding: "24px 24px 8px" }}>
          {email.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </Section>
      </Container>
      <Container style={{ maxWidth: "560px", padding: "16px 24px" }}>
        <Text
          style={{
            ...text,
            fontSize: "13px",
            lineHeight: "20px",
            color: colour.charcoal,
            textAlign: "center",
            margin: 0,
          }}
        >
          {footer.map((part, i) => (
            <span key={part}>
              {i > 0 && " · "}
              {/* wraps between the parts, never inside one */}
              <span style={{ whiteSpace: "nowrap" }}>{part}</span>
            </span>
          ))}
        </Text>
      </Container>
    </Body>
  </Html>
);

// where a site serves the email logo (packages/landing/public)
export const logoUrlOn = (landingOrigin: string) =>
  new URL("email-logo.png", landingOrigin).href;

import { Resend } from "resend";
import env from "../../env.ts";
import { withAppUrl, type Email } from "./blocks.ts";
import { logoUrlOn } from "./layout.tsx";
import { renderEmail } from "./render.tsx";
import { routeEmail } from "./routing.ts";

export type EmailMessage = {
  to: string;
  // copied, unseen by `to`
  bcc?: string;
  // where replies go: the Office's shared inbox
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage) {
    const { error } = await this.resend.emails.send({
      from: this.from,
      ...message,
    });

    if (error) {
      throw new Error(`email to ${message.to} failed: ${error.message}`);
    }
  }
}

let current: EmailSender = new ResendEmailSender(
  env.RESEND_API_KEY,
  env.EMAIL_FROM,
);

// Every email comes from a builder (e.g. signInEmail) and is rendered through
// the shared layout, then routed for the test site. A message to nobody is not sent: a Client the Office
// entered without an email gets no emails until one is added (#34).
export const email = {
  send: async (message: { to: string | null; bcc?: string } & Email) => {
    if (message.to === null) return;
    const { subject, html, text } = await renderEmail(
      withAppUrl(message, env.CORS_ORIGIN_URL),
      logoUrlOn(env.LANDING_ORIGIN_URL),
    );
    await current.send(
      routeEmail(
        {
          to: message.to,
          ...(message.bcc ? { bcc: message.bcc } : {}),
          replyTo: env.OFFICE_EMAIL,
          subject,
          html,
          text,
        },
        {
          mode: env.APP_MODE,
          allowed: env.EMAIL_ALLOWED,
          office: env.OFFICE_EMAIL,
        },
      ),
    );
  },
};

export const setEmailSender = (next: EmailSender) => {
  current = next;
};

export * from "./blocks.ts";
export * from "./format.ts";

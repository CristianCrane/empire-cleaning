import { Resend } from "resend";
import { monitoring, SignalledError } from "#services/monitoring";
import env from "../../env.ts";
import { withAppUrl, type Email } from "./blocks.ts";
import { logoUrlOn } from "./layout.tsx";
import { renderEmail } from "./render.tsx";
import { routeEmail } from "./routing.ts";

export type EmailMessage = {
  to: string;
  // where replies go: the Office's shared inbox
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class ResendEmailSender implements EmailSender {
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
  send: async (message: { to: string | null } & Email) => {
    if (message.to === null) return;
    const { subject, html, text } = await renderEmail(
      withAppUrl(message, env.CORS_ORIGIN_URL),
      logoUrlOn(env.LANDING_ORIGIN_URL),
    );
    const routed = routeEmail(
      {
        to: message.to,
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
    );
    // the email service refused it or couldn't be reached: the
    // email_send_failed signal, raised here once for every caller, who only
    // logs what wasn't sent
    try {
      await current.send(routed);
    } catch (error) {
      // the service's reason, never the subject: it can hold an address
      monitoring.signal("email_send_failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
      throw new SignalledError("email_send_failed", "email not sent", {
        cause: error,
      });
    }
  },
};

// Emails go out after the change is saved; one that fails is logged, and the
// change stands
export const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    monitoring.error(error, { what: `${what} not sent` });
  }
};

export const setEmailSender = (next: EmailSender) => {
  current = next;
};

export * from "./blocks.ts";
export * from "./format.ts";

import { Resend } from "resend";
import env from "../../env.ts";

export type EmailMessage = {
  to: string;
  // copied, unseen by `to`
  bcc?: string;
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

// A message to nobody is not sent: a Client the Office entered without an
// email gets no emails until one is added (#34)
export const email = {
  send: async (message: Omit<EmailMessage, "to"> & { to: string | null }) => {
    if (message.to === null) return;
    await current.send({ ...message, to: message.to });
  },
};

export const setEmailSender = (next: EmailSender) => {
  current = next;
};

export * from "./compose.ts";

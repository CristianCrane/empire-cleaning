import { Resend } from "resend";
import env from "../../env.ts";

export type EmailMessage = {
  to: string;
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

// without a Resend key (local development) emails are printed instead of sent
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    console.log(
      `[email] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}

let current: EmailSender = env.RESEND_API_KEY
  ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM)
  : new ConsoleEmailSender();

export const email: EmailSender = {
  send: (message) => current.send(message),
};

export const setEmailSender = (next: EmailSender) => {
  current = next;
};

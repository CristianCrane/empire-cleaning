import type { EmailMessage, EmailSender } from "#services/email";

export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.sent.push(message);
  }

  to(address: string) {
    return this.sent.filter((m) => m.to === address);
  }

  // the most recent email to `address`; fails loudly so tests read clearly
  lastTo(address: string) {
    const messages = this.to(address);
    const last = messages.at(-1);
    if (!last) {
      throw new Error(`no email was sent to ${address}`);
    }
    return last;
  }
}

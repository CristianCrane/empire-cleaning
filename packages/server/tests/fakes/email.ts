import type { EmailMessage, EmailSender } from "#services/email";

export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  private failing = false;

  async send(message: EmailMessage) {
    if (this.failing) throw new Error("the email service is down");
    this.sent.push(message);
  }

  // sends fail from now on, as when the email service is down, until
  // sendNormally()
  failSending() {
    this.failing = true;
  }

  sendNormally() {
    this.failing = false;
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

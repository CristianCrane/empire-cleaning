import type { EmailMessage, EmailSender } from "#services/email";

export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  private failing = false;
  private refused = new Set<string>();

  async send(message: EmailMessage) {
    if (this.failing) throw new Error("the email service is down");
    if (this.refused.has(message.to)) throw new Error("mailbox unavailable");
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

  // sends to `address` fail, as when its mailbox refuses them
  failSendingTo(address: string) {
    this.refused.add(address);
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

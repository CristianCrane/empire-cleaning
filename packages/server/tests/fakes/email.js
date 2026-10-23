export class FakeEmailSender {
    sent = [];
    async send(message) {
        this.sent.push(message);
    }
    to(address) {
        return this.sent.filter((m) => m.to === address);
    }
    // the most recent email to `address`; fails loudly so tests read clearly
    lastTo(address) {
        const messages = this.to(address);
        const last = messages.at(-1);
        if (!last) {
            throw new Error(`no email was sent to ${address}`);
        }
        return last;
    }
}

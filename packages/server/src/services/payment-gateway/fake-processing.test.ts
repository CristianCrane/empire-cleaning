import { expect, test } from "vitest";
import { FakePaymentGateway } from "../../../tests/fakes/payment-gateway.ts";

// critical review C18: the fake has two ways to leave a card payment made
// with the Client there processing, finishCards() and (since 371dd730)
// failCharges("processing"). As Stripe saves a typed Deposit's card when
// its PaymentIntent succeeds, however long it processed, both should come
// back with the card saved once it's through
const typedDepositLeftProcessing = async (
  leave: (fake: FakePaymentGateway) => void,
  finish: (fake: FakePaymentGateway) => void,
) => {
  const fake = new FakePaymentGateway();
  const { payerId } = await fake.createPayer({
    clientId: "client-1",
    language: "en",
  });
  leave(fake);
  const first = await fake.takeDeposit({
    payerId,
    source: { token: fake.paymentToken() },
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit-1",
  });
  expect(first.status).toBe("finishing");
  finish(fake);
  return fake.paymentOutcome((first as { ref: string }).ref);
};

test("a typed Deposit left processing saves its card once through, either way it's left", async () => {
  const byFinishCards = await typedDepositLeftProcessing(
    (fake) => fake.finishCards(),
    (fake) => fake.finishCards(false),
  );
  const byFailCharges = await typedDepositLeftProcessing(
    (fake) => fake.failCharges("processing"),
    (fake) => fake.clearCharges(),
  );

  expect(byFinishCards).toMatchObject({
    status: "taken",
    saved: expect.anything(),
  });
  expect(byFailCharges).toMatchObject({
    status: "taken",
    saved: expect.anything(),
  });
});

// critical review C20: a card that asks the Client to approve asks before
// anything is processing, as Stripe does, so one left processing by
// failCharges("processing") waits on them, and never reads processing
// first and then waiting on them
test("a typed card that asks for approval asks first, even left processing", async () => {
  const fake = new FakePaymentGateway();
  const { payerId } = await fake.createPayer({
    clientId: "client-1",
    language: "en",
  });
  fake.failCharges("processing");
  const first = await fake.takeDeposit({
    payerId,
    source: { token: fake.paymentToken("alwaysApproval") },
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit-1",
  });

  expect(first.status).toBe("approving");
});

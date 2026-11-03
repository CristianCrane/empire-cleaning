import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { describe, expect, test, vi } from "vitest";
import { testMonitoring } from "../../../tests/harness.ts";
import { StripePaymentGateway } from "./stripe.ts";

const WEBHOOK_SECRET = "whsec_fake";

// the real adapter, with Stripe's client answering as told
const gateway = () => {
  const stripe = new StripePaymentGateway({
    secretKey: "sk_test_fake",
    publishableKey: "pk_test_fake",
    webhookSecret: WEBHOOK_SECRET,
  });
  return { stripe, client: stripe["stripe"] };
};

// what Stripe really sent, recorded in a sandbox (pnpm stripe:record, in
// tests/contract/record-stripe.ts)
const recorded = <T = Record<string, unknown>>(name: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`../../../tests/stripe-recordings/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as T;

const charge = (stripe: StripePaymentGateway) =>
  stripe.charge({
    payerId: "cus_1",
    paymentMethodId: "pm_1",
    amount: 4200,
    description: "Balance",
    idempotencyKey: "balance:1",
  });

// which signal what Stripe refuses is (ADR-0007)
describe("Stripe's refusals", () => {
  test("a declined card is charge_declined, counted", async () => {
    const { stripe, client } = gateway();
    const declined = recorded<{ decline_code: string }>(
      "declined-charge-error",
    );
    vi.spyOn(client.paymentIntents, "create").mockRejectedValue(
      Stripe.errors.StripeError.generate(declined as never),
    );

    expect(await charge(stripe)).toEqual({
      ok: false,
      reason: declined.decline_code,
    });
    expect(testMonitoring().signals).toEqual([
      expect.objectContaining({ name: "charge_declined", urgency: "counted" }),
    ]);
  });

  test("one of our requests is payment_gateway_error, urgent", async () => {
    const { stripe, client } = gateway();
    vi.spyOn(client.refunds, "create").mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        message: "No such payment_intent: 'pi_1'",
        code: "resource_missing",
      }),
    );

    const refunded = await stripe.refund({
      chargeId: "pi_1",
      amount: 1000,
      idempotencyKey: "refund:1",
    });

    expect(refunded).toEqual({ ok: false, reason: "resource_missing" });
    expect(testMonitoring().signals).toEqual([
      expect.objectContaining({
        name: "payment_gateway_error",
        urgency: "urgent",
        context: expect.objectContaining({ what: "a refund" }),
      }),
    ]);
  });

  // made by the SDK, not sent by Stripe, so not recorded. It may have been
  // done all the same, so it isn't a refusal: the caller asks again (ADR-0022)
  test.each([
    [
      "the connection failed",
      new Stripe.errors.StripeConnectionError({
        type: "api_error",
        message: "An error occurred with our connection to Stripe.",
      }),
    ],
    [
      "Stripe erred",
      new Stripe.errors.StripeAPIError({
        type: "api_error",
        message: "Something went wrong on Stripe's end.",
      }),
    ],
  ])("when %s, it throws", async (_, error) => {
    const { stripe, client } = gateway();
    vi.spyOn(client.paymentIntents, "create").mockRejectedValue(error);
    vi.spyOn(client.refunds, "create").mockRejectedValue(error);

    await expect(charge(stripe)).rejects.toBe(error);
    await expect(
      stripe.refund({ chargeId: "pi_1", amount: 1000, idempotencyKey: "r" }),
    ).rejects.toBe(error);
  });
});

// #241, finding 3: no test card does this off-session, so a bank debit's
// PaymentIntent, as recorded processing, stands in for one
describe("an off-session Charge still processing", () => {
  test("isn't a decline: it says which payment to ask after", async () => {
    const { stripe, client } = gateway();
    const processing = recorded<{ id: string }>("processing-payment-intent");
    vi.spyOn(client.paymentIntents, "create").mockResolvedValue(
      processing as never,
    );

    expect(await charge(stripe)).toEqual({
      ok: false,
      reason: "processing",
      chargeId: processing.id,
    });
  });
});

// telling a refund made in Stripe's dashboard from ours (ADR-0021)
describe("refunds made elsewhere", () => {
  test("ours are marked as made here", async () => {
    const { stripe, client } = gateway();
    const refund = recorded<{ id: string }>("refund");
    const create = vi
      .spyOn(client.refunds, "create")
      .mockResolvedValue(refund as never);

    expect(
      await stripe.refund({
        chargeId: "pi_1",
        amount: 1000,
        idempotencyKey: "refund:1",
      }),
    ).toEqual({ ok: true, refundId: refund.id });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { made_by: "app", idempotency_key: "refund:1" },
      }),
      { idempotencyKey: "refund:1" },
    );
  });

  test("are a Charge's refunds not made here, as far as they've gone through or are on their way", async () => {
    const { stripe, client } = gateway();
    type Refund = {
      id: string;
      status: string;
      amount: number;
      created: number;
      metadata: Record<string, string>;
    };
    const refunds = recorded<Refund[]>("refunds-list");
    const list = vi.spyOn(client.refunds, "list").mockReturnValue({
      autoPagingToArray: async () => refunds,
    } as never);
    const by = (status: string, ours = false) =>
      refunds.find(
        (r) => r.status === status && (r.metadata.made_by === "app") === ours,
      )!;
    const elsewhere = (r: Refund) => ({
      refundId: r.id,
      amount: r.amount,
      at: new Date(r.created * 1000),
    });

    const found = await stripe.refundsElsewhere("pi_1");

    expect(found).toEqual(
      expect.arrayContaining([
        elsewhere(by("succeeded")),
        elsewhere(by("pending")),
      ]),
    );
    expect(found).toHaveLength(2);
    // ours and the failed one aren't
    expect(by("succeeded", true)).toBeDefined();
    expect(by("failed")).toBeDefined();
    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 100 });
  });
});

// what each webhook Stripe sends means, as recorded
describe("Stripe's webhooks", () => {
  const parsed = (name: string) => {
    const { stripe } = gateway();
    const event = recorded<{ data: { object: Record<string, unknown> } }>(name);
    const payload = JSON.stringify(event);
    return {
      object: event.data.object,
      event: stripe.parseEvent(Buffer.from(payload), {
        "stripe-signature": Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: WEBHOOK_SECRET,
        }),
      }),
    };
  };
  const idOf = (ref: unknown) =>
    typeof ref === "string" ? ref : (ref as { id: string }).id;

  test("a Deposit that succeeded, by PaymentIntent or SetupIntent", () => {
    for (const name of [
      "event-deposit-succeeded",
      "event-setup-deposit-succeeded",
    ]) {
      const { object, event } = parsed(name);
      expect(event).toEqual({ kind: "deposit_succeeded", ref: object.id });
    }
  });

  test("a Bill payment that succeeded or failed, with what it's for", () => {
    for (const [name, kind] of [
      ["event-bill-payment-succeeded", "bill_payment_succeeded"],
      ["event-bill-payment-failed", "bill_payment_failed"],
    ]) {
      const { object, event } = parsed(name!);
      expect(event).toEqual({
        kind,
        ref: object.id,
        reference: (object.metadata as { reference: string }).reference,
      });
    }
  });

  test("a Charge refunded, or a refund on its way that went through", () => {
    for (const name of ["event-charge-refunded", "event-refund-went-through"]) {
      const { object, event } = parsed(name);
      expect(event).toEqual({
        kind: "charge_refunded",
        chargeId: idOf(object.payment_intent),
      });
    }
  });

  test("a refund that failed after it was made", () => {
    const { object, event } = parsed("event-refund-failed");

    expect(event).toEqual({
      kind: "refund_failed",
      chargeId: idOf(object.payment_intent),
      refundId: object.id,
    });
  });

  test("a dispute", () => {
    const { object, event } = parsed("event-dispute-created");

    expect(event).toEqual({
      kind: "dispute_opened",
      chargeId: idOf(object.payment_intent),
    });
  });

  test("anything else is nothing we act on", () => {
    expect(parsed("event-customer-created").event).toBeNull();
  });
});

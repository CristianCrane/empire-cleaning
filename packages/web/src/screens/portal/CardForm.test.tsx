import { beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { loadStripe, type Stripe, type StripeError } from "@stripe/stripe-js";
import { report } from "@empire-cleaning/browser-monitoring";
import { LanguageProvider } from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { CardProblem, usePaymentForm } from "./CardForm.tsx";

vi.mock(import("@stripe/stripe-js"), async (original) => ({
  ...(await original()),
  loadStripe: vi.fn(),
}));
vi.mock(import("../../api.ts"), async (original) => ({
  ...(await original()),
  getJson: vi.fn(),
}));
vi.mock(import("@empire-cleaning/browser-monitoring"), async (original) => ({
  ...(await original()),
  report: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete document.body.dataset.said;
});

// the Deposit's form, with what pressing Pay says
function PayForm({ showCard = true }: { showCard?: boolean }) {
  const payment = usePaymentForm({ amountCents: 4872, showCard });
  return (
    <>
      {payment.field}
      <button
        type="button"
        onClick={() =>
          void payment.token().catch((e: unknown) => {
            if (e instanceof CardProblem) {
              document.body.dataset.said = e.message;
            }
          })
        }
      >
        Pay
      </button>
    </>
  );
}

test("Stripe.js that can't load is said, and reported, not loading for good", async () => {
  vi.mocked(getJson).mockResolvedValue({
    form: "stripe",
    publishableKey: "pk_test_123",
  });
  const blocked = new Error("Failed to load Stripe.js");
  vi.mocked(loadStripe).mockRejectedValue(blocked);
  const screen = await render(<PayForm />);

  await expect
    .element(screen.getByText("The form didn't load. Please refresh the page."))
    .toBeVisible();
  await screen.getByRole("button", { name: "Pay" }).click();

  await vi.waitFor(() =>
    expect(document.body.dataset.said).toBe(
      "The form didn't load. Please refresh the page.",
    ),
  );
  expect(report).toHaveBeenCalledWith(blocked);
});

test("the card box is mounted once, though it's hidden and shown while Stripe.js loads", async () => {
  vi.mocked(getJson).mockResolvedValue({
    form: "stripe",
    publishableKey: "pk_test_123",
  });
  const mount = vi.fn();
  const stripe = {
    elements: () => ({
      create: () => ({ on: () => {}, mount, destroy: () => {} }),
      update: () => {},
    }),
  } as unknown as Stripe;
  let loaded!: (stripe: Stripe) => void;
  const loading = new Promise<Stripe>((resolve) => (loaded = resolve));
  vi.mocked(loadStripe).mockReturnValue(loading);
  const screen = await render(<PayForm />);
  await vi.waitFor(() => expect(loadStripe).toHaveBeenCalledOnce());

  // a saved card chosen, then a new one again (PortalQuote's newCard)
  await screen.rerender(<PayForm showCard={false} />);
  await screen.rerender(<PayForm />);
  await vi.waitFor(() => expect(loadStripe).toHaveBeenCalledTimes(2));
  loaded(stripe);
  await loading;
  await new Promise((resolve) => setTimeout(resolve));

  expect(mount).toHaveBeenCalledOnce();
});

test("the card form follows a change of language, Stripe's own words too, without starting afresh", async () => {
  vi.mocked(getJson).mockResolvedValue({
    form: "stripe",
    publishableKey: "pk_test_123",
  });
  const mount = vi.fn();
  const update = vi.fn();
  const elements = vi.fn(() => ({
    create: () => ({ on: () => {}, mount, destroy: () => {} }),
    update,
  }));
  vi.mocked(loadStripe).mockResolvedValue({ elements } as unknown as Stripe);
  const screen = await render(
    <LanguageProvider lang="en">
      <PayForm />
    </LanguageProvider>,
  );
  await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());
  expect(elements).toHaveBeenCalledWith(
    expect.objectContaining({ locale: "en" }),
  );

  // the person presses Español (AreaLayout's OtherLanguage)
  await screen.rerender(
    <LanguageProvider lang="es">
      <PayForm />
    </LanguageProvider>,
  );

  await vi.waitFor(() =>
    expect(update).toHaveBeenCalledWith({ locale: "es-419" }),
  );
  expect(elements).toHaveBeenCalledOnce();
  expect(mount).toHaveBeenCalledOnce();
});

describe("paying, when Stripe says no", () => {
  // presses Pay on a loaded card form, where Stripe answers with `error`
  const pay = async (error: Partial<StripeError>) => {
    vi.mocked(getJson).mockResolvedValue({
      form: "stripe",
      publishableKey: "pk_test_123",
    });
    const mount = vi.fn();
    vi.mocked(loadStripe).mockResolvedValue({
      elements: () => ({
        create: () => ({ on: () => {}, mount, destroy: () => {} }),
        update: () => {},
        submit: async () => ({}),
      }),
      createConfirmationToken: async () => ({ error }),
    } as unknown as Stripe);
    const screen = await render(<PayForm />);
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());
    await screen.getByRole("button", { name: "Pay" }).click();
    await vi.waitFor(() => expect(document.body.dataset.said).toBeDefined());
  };

  test("about something of ours is reported, and the Client sees Stripe's words", async () => {
    await pay({
      type: "invalid_request_error",
      code: "resource_missing",
      message: "No such payment_intent.",
    });

    expect(document.body.dataset.said).toBe("No such payment_intent.");
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Stripe invalid_request_error (resource_missing): No such payment_intent.",
      }),
    );
  });

  test.each([
    {
      type: "card_error",
      code: "card_declined",
      message: "Your card was declined.",
    },
    // what Stripe's test mode answers when the 3D Secure check is failed
    // or closed (card 4000 0027 6000 3184), paying and saving a card
    ...(["payment_intent", "setup_intent"] as const).map((intent) => ({
      type: "invalid_request_error" as const,
      code: `${intent}_authentication_failure`,
      message:
        "We are unable to authenticate your payment method. Please choose a different payment method and try again.",
    })),
  ] as const)(
    "about the Client's card ($code) isn't reported",
    async (error) => {
      await pay(error);

      expect(document.body.dataset.said).toBe(error.message);
      expect(report).not.toHaveBeenCalled();
    },
  );
});

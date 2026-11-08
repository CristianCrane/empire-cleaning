import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { report } from "@empire-cleaning/browser-monitoring";
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

beforeEach(() => vi.clearAllMocks());

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

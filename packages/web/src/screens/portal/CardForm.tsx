import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
} from "@stripe/stripe-js";
import type { CardForm, PaymentMethodView } from "@empire-cleaning/models";
import { EmbeddedField, Notice } from "@empire-cleaning/ui";
import { postJson, putJson } from "../../api.ts";

// the card couldn't be set up; the message is for the Client
export class CardProblem extends Error {}

// the provider's card box takes our colours and type, read from the tokens
const tokenStyle = () => {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    base: {
      color: token("--color-fg"),
      fontFamily: token("--font-sans"),
      fontSize: "16px",
      "::placeholder": { color: token("--color-fg-muted") },
    },
    invalid: { color: token("--color-danger-strong") },
  };
};

/**
 * The payment provider's own card form, so card numbers never reach our
 * server (ADR-0004). Gives the form to show and `save()`, which sets the card
 * up with the provider and saves it as the Client's Payment Method. After a
 * card is refused, `reset()` starts a fresh form.
 *
 * With the test provider (end-to-end tests) there is no card to type: the
 * form says so and saving just works.
 */
export function useCardForm({ enabled = true }: { enabled?: boolean } = {}) {
  const [form, setForm] = useState<CardForm>();
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string>();
  const [isFocused, setFocused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stripe = useRef<{ stripe: Stripe; card: StripeCardElement }>(null);

  // a form is started only when it's shown: each is a setup with the provider
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setForm(undefined);
    postJson<CardForm>("/api/payment-methods/mine/card-form")
      .then((next) => current && setForm(next))
      .catch(
        () =>
          current &&
          setProblem("The card form didn't load. Please refresh the page."),
      );
    return () => {
      current = false;
    };
  }, [attempt, enabled]);

  useEffect(() => {
    if (form?.form !== "stripe" || !box.current) return;
    let card: StripeCardElement | undefined;
    void loadStripe(form.publishableKey).then((loaded) => {
      if (!loaded || !box.current) return;
      card = loaded.elements().create("card", { style: tokenStyle() });
      card.on("focus", () => setFocused(true));
      card.on("blur", () => setFocused(false));
      card.on("change", (e) => setProblem(e.error?.message));
      card.mount(box.current);
      stripe.current = { stripe: loaded, card };
    });
    return () => {
      card?.destroy();
      stripe.current = null;
    };
  }, [form]);

  // sets the card up with the provider, then saves it as theirs
  const save = useCallback(async () => {
    if (!form) throw new CardProblem("The card form is still loading.");
    let token = form.secret;
    if (form.form === "stripe") {
      if (!stripe.current) {
        throw new CardProblem("The card form is still loading.");
      }
      const { stripe: loaded, card } = stripe.current;
      const result = await loaded.confirmCardSetup(form.secret, {
        payment_method: { card },
      });
      if (result.error) {
        throw new CardProblem(
          result.error.message ?? "Your card couldn't be set up.",
        );
      }
      token = result.setupIntent.id;
    }
    return putJson<PaymentMethodView>("/api/payment-methods/mine", { token });
  }, [form]);

  const reset = useCallback(() => {
    setProblem(undefined);
    setAttempt((n) => n + 1);
  }, []);

  const field: ReactNode =
    form?.form === "test" ? (
      <Notice>
        Test payments: no card is needed. Saving uses a test card ending 4242.
      </Notice>
    ) : (
      <EmbeddedField
        label="Card"
        description="Entered straight into our payment provider's secure form: we never see your card number."
        errorMessage={problem}
        isFocused={isFocused}
      >
        <div ref={box} className="min-h-6" />
      </EmbeddedField>
    );

  return { field, save, reset, isReady: Boolean(form) };
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  loadStripe,
  type Appearance,
  type Stripe,
  type StripeElements,
} from "@stripe/stripe-js";
import type {
  CardForm,
  PaymentForm,
  PaymentMethodView,
} from "@empire-cleaning/models";
import { EmbeddedField, Notice } from "@empire-cleaning/ui";
import { getJson, postJson, putJson } from "../../api.ts";

// The payment provider's own form, so card numbers never reach our server
// (ADR-0004): Stripe's Payment Element, for cards and Link only (ADR-0008).
// With the test provider (end-to-end tests) there is no card to type: the
// form says so, and paying or saving just works.

// the card couldn't be used; the message is for the Client
export class CardProblem extends Error {}

// what saving a card agrees to, shown beside every form that saves one
export function ConsentNote({ action }: { action: "paying" | "saving" }) {
  return (
    <p className="text-sm text-fg-muted">
      By {action === "paying" ? "paying" : "saving your card"}, you authorise
      Empire Cleaning to charge this card for the Balance when each clean is
      Completed, and the Deposit amount for a late cancellation or No Access.
    </p>
  );
}

// the provider's form takes our colours and type, read from the tokens
const appearance = (): Appearance => {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    theme: "stripe",
    variables: {
      colorPrimary: token("--color-primary"),
      colorBackground: token("--color-surface"),
      colorText: token("--color-fg"),
      colorTextSecondary: token("--color-fg-muted"),
      colorDanger: token("--color-danger-strong"),
      fontFamily: token("--font-sans"),
      fontSizeBase: "16px",
      borderRadius: token("--radius-md"),
    },
  };
};

// card and Link only: both settle at once, as a Deposit must (ADR-0008)
const ALLOWED_PAYMENT_METHOD_TYPES = ["card", "link"];

// Mounts the Payment Element into a box once Stripe has loaded, and tears it
// down when the form changes or goes away
const useStripeElement = (
  form: PaymentForm | undefined,
  options: (stripe: Stripe) => StripeElements | null,
  setProblem: (problem: string | undefined) => void,
) => {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useRef<{ stripe: Stripe; elements: StripeElements }>(null);

  useEffect(() => {
    if (form?.form !== "stripe" || !box.current) return;
    let destroy: (() => void) | undefined;
    void loadStripe(form.publishableKey).then((stripe) => {
      if (!stripe || !box.current) return;
      const elements = options(stripe);
      if (!elements) return;
      const element = elements.create("payment", { layout: "tabs" });
      element.on("change", () => setProblem(undefined));
      element.mount(box.current);
      mounted.current = { stripe, elements };
      destroy = () => element.destroy();
    });
    return () => {
      destroy?.();
      mounted.current = null;
    };
    // the options are read once per form
  }, [form]);

  return { box, mounted };
};

const formField = (
  form: PaymentForm | undefined,
  box: RefObject<HTMLDivElement | null>,
  problem: string | undefined,
): ReactNode =>
  form?.form === "test" ? (
    <Notice>
      Test payments: no card is needed. Paying uses a test card ending 4242.
    </Notice>
  ) : (
    <EmbeddedField
      label="Payment"
      description="Entered straight into our payment provider's secure form: we never see your card number."
      errorMessage={problem}
      framed={false}
    >
      <div ref={box} className="min-h-24" />
    </EmbeddedField>
  );

/**
 * The form a Deposit is paid with: a card entered here is saved by the same
 * payment, for later Charges. `token()` hands what was entered to our server
 * (which takes the Deposit); if the Client's bank then wants them to approve
 * it, `approve(secret)` runs that approval (e.g. 3D Secure) here. That can
 * happen paying with a saved card too, so the card box is only shown with
 * `showCard`, but approval always works.
 */
export function usePaymentForm({
  amountCents,
  showCard = true,
}: {
  amountCents: number;
  showCard?: boolean;
}) {
  const [form, setForm] = useState<PaymentForm>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    getJson<PaymentForm>("/api/payment-methods/form")
      .then((next) => current && setForm(next))
      .catch(
        () =>
          current &&
          setProblem("The payment form didn't load. Please refresh the page."),
      );
    return () => {
      current = false;
    };
  }, []);

  // a 0 Deposit only saves the card
  const modeFor = (cents: number) =>
    cents > 0
      ? ({ mode: "payment", amount: cents } as const)
      : ({ mode: "setup" } as const);

  const { box, mounted } = useStripeElement(
    showCard ? form : undefined,
    (stripe) =>
      stripe.elements({
        ...modeFor(amountCents),
        currency: "usd",
        setupFutureUsage: "off_session",
        allowedPaymentMethodTypes: ALLOWED_PAYMENT_METHOD_TYPES,
        appearance: appearance(),
      }),
    setProblem,
  );

  // the amount follows the Clean Type chosen
  useEffect(() => {
    mounted.current?.elements.update(modeFor(amountCents));
  }, [amountCents, mounted]);

  const token = useCallback(async () => {
    if (!form) throw new CardProblem("The payment form is still loading.");
    // a card "entered" in the test form; each is used once
    if (form.form === "test") return `tok_test_${crypto.randomUUID()}`;
    if (!mounted.current) {
      throw new CardProblem("The payment form is still loading.");
    }
    const { stripe, elements } = mounted.current;
    const submitted = await elements.submit();
    if (submitted.error) {
      setProblem(submitted.error.message);
      throw new CardProblem(
        submitted.error.message ?? "Please check your card details.",
      );
    }
    const result = await stripe.createConfirmationToken({
      elements,
      params: { return_url: window.location.href },
    });
    if (result.error) {
      throw new CardProblem(
        result.error.message ?? "Your card couldn't be used.",
      );
    }
    return result.confirmationToken.id;
  }, [form, mounted]);

  const approve = useCallback(
    async (secret: string) => {
      // the test provider's bank needs nothing from the Client
      if (form?.form !== "stripe") return;
      const stripe =
        mounted.current?.stripe ?? (await loadStripe(form.publishableKey));
      if (!stripe) throw new CardProblem("The payment form didn't load.");
      const result = await stripe.handleNextAction({ clientSecret: secret });
      if (result.error) {
        throw new CardProblem(
          result.error.message ?? "Your bank didn't approve the payment.",
        );
      }
    },
    [form, mounted],
  );

  return {
    field: formField(form, box, problem),
    token,
    approve,
    isReady: Boolean(form),
  };
}

/**
 * The form for saving a card without paying (the Office's add-a-card link).
 * `save()` sets the card up with the provider, then saves it as the
 * Client's Payment Method. After a card is refused, `reset()` starts afresh.
 */
export function useCardForm({ enabled = true }: { enabled?: boolean } = {}) {
  const [form, setForm] = useState<CardForm>();
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string>();

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

  const { box, mounted } = useStripeElement(
    form,
    (stripe) =>
      form?.form === "stripe"
        ? stripe.elements({
            clientSecret: form.secret,
            appearance: appearance(),
          })
        : null,
    setProblem,
  );

  const save = useCallback(async () => {
    if (!form) throw new CardProblem("The card form is still loading.");
    let token = form.secret;
    if (form.form === "stripe") {
      if (!mounted.current) {
        throw new CardProblem("The card form is still loading.");
      }
      const { stripe, elements } = mounted.current;
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (result.error) {
        setProblem(result.error.message);
        throw new CardProblem(
          result.error.message ?? "Your card couldn't be set up.",
        );
      }
      token = result.setupIntent.id;
    }
    return putJson<PaymentMethodView>("/api/payment-methods/mine", { token });
  }, [form, mounted]);

  const reset = useCallback(() => {
    setProblem(undefined);
    setAttempt((n) => n + 1);
  }, []);

  return {
    field:
      form?.form === "test" ? (
        <Notice>
          Test payments: no card is needed. Saving uses a test card ending 4242.
        </Notice>
      ) : (
        formField(form, box, problem)
      ),
    save,
    reset,
    isReady: Boolean(form),
  };
}

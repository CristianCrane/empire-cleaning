import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
// this import loads Stripe.js at once, and the main bundle has it
// (monitoring.ts), so it's on every screen: Stripe asks for that, for its
// fraud signals as Clients browse, not just where they pay
import {
  loadStripe,
  type Appearance,
  type Stripe,
  type StripeElements,
} from "@stripe/stripe-js";
import {
  NEVER_SEE_CARD,
  type BillPaymentForm,
  type CardForm,
  type PaymentForm,
  type PaymentMethodView,
} from "@empire-cleaning/models";
import { EmbeddedField, Notice } from "@empire-cleaning/ui";
import { getJson, postJson, putJson } from "../../api.ts";
import { reportUnexpected } from "../../monitoring.ts";
import { useLoaded } from "../load.ts";

// The payment provider's own form, so card numbers never reach our server
// (ADR-0004): Stripe's Payment Element, for cards only (ADR-0008), except a
// Bill paid on its page, by card or bank debit (ADR-0016).
// With the test provider (end-to-end tests) there is no card to type: the
// form says so, and paying or saving just works.

// the card couldn't be used; the message is for the Client
export class CardProblem extends Error {}

// what saving a card agrees to, shown beside every form that saves one
export function ConsentNote({ action }: { action: "paying" | "saving" }) {
  return (
    <p className="text-sm text-fg-muted">
      By {action === "paying" ? "paying" : "saving your card"}, you agree that
      Empire Cleaning can charge this card for the balance when each clean is
      done, the deposit amount for a late cancellation or if we couldn't get in,
      and any weekly bill set to be charged to it.
    </p>
  );
}

// Stripe's form runs in its own frame and only takes plain colours, while our
// tokens are light-dark() pairs: each is resolved to the rgb() the page shows
// now, in whichever theme is on
const tokenColour = (name: string) => {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
};

const isDark = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

// The provider's form drawn like our own fields (Field.tsx's fieldStyles):
// our colours and type, a tinted box with a strong line along its bottom,
// and our focus ring
const appearance = (): Appearance => {
  const c = {
    surface: tokenColour("--ec-surface"),
    surfaceSunken: tokenColour("--ec-surface-sunken"),
    fg: tokenColour("--ec-fg"),
    fgMuted: tokenColour("--ec-fg-muted"),
    borderStrong: tokenColour("--ec-border-strong"),
    primary: tokenColour("--ec-primary"),
    focus: tokenColour("--ec-focus"),
    danger: tokenColour("--ec-danger"),
    dangerStrong: tokenColour("--ec-danger-strong"),
  };
  const focusRing = {
    outline: `2px solid ${c.focus}`,
    outlineOffset: "-1px",
    boxShadow: "none",
  };
  return {
    // Stripe's own dark base keeps the colours it works out itself readable
    theme: isDark() ? "night" : "stripe",
    labels: "above",
    variables: {
      colorPrimary: c.primary,
      colorBackground: c.surface,
      colorText: c.fg,
      colorTextSecondary: c.fgMuted,
      colorTextPlaceholder: c.fgMuted,
      colorIcon: c.fgMuted,
      colorDanger: c.dangerStrong,
      fontFamily: "Barlow, system-ui, sans-serif",
      // 16px keeps phones from zooming in on focus, as in our own fields
      fontSizeBase: "16px",
      borderRadius: "8px",
    },
    rules: {
      ".Label": { fontSize: "14px", fontWeight: "600", color: c.fg },
      ".Input": {
        backgroundColor: c.surfaceSunken,
        border: "1px solid transparent",
        borderBottom: `1px solid ${c.borderStrong}`,
        borderBottomLeftRadius: "0",
        borderBottomRightRadius: "0",
        boxShadow: "none",
      },
      ".Input:focus": focusRing,
      ".Input--invalid": { borderColor: c.danger, boxShadow: "none" },
      ".Error": { fontSize: "14px", fontWeight: "500", color: c.dangerStrong },
      ".Tab": {
        backgroundColor: c.surface,
        border: `1px solid ${c.borderStrong}`,
        boxShadow: "none",
      },
      ".Tab:focus": focusRing,
      ".Tab--selected": { borderColor: c.primary, color: c.fg },
    },
  };
};

// Barlow, for the frame: our own copy of the font can't reach inside it.
// Stripe.js fetches this from our page, so the CSP allows it (vite.config.ts)
const FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&display=swap",
  },
];

// cards only: they settle at once, as a Deposit must (ADR-0008). Not Link,
// which also offers bank payments.
const ALLOWED_PAYMENT_METHOD_TYPES = ["card"];

// Mounts the Payment Element into a box once Stripe has loaded, and tears it
// down when the form changes or goes away. `ready()` is what's mounted, to
// pay or save with, or says why there's nothing: still loading, or Stripe.js
// couldn't load (blocked, or no connection), which is reported
const useStripeElement = (
  form: PaymentForm | undefined,
  options: (stripe: Stripe) => StripeElements | null,
  setProblem: (problem: string | undefined) => void,
) => {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useRef<{ stripe: Stripe; elements: StripeElements }>(null);
  // the options are read once per form, as it mounts
  const elementsFor = useEffectEvent(options);
  const clearProblem = useEffectEvent(() => setProblem(undefined));
  const failed = useRef(false);
  const notLoaded = useEffectEvent((e: unknown) => {
    reportUnexpected(e);
    failed.current = true;
    setProblem(NOT_LOADED);
  });

  useEffect(() => {
    if (form?.form !== "stripe" || !box.current) return;
    let destroy: (() => void) | undefined;
    failed.current = false;
    loadStripe(form.publishableKey).then((stripe) => {
      if (!stripe || !box.current) return;
      const elements = elementsFor(stripe);
      if (!elements) return;
      // Stripe adds Link (and its bank payments) beside cards unless told
      // not to, whatever the intent allows
      const element = elements.create("payment", {
        layout: "tabs",
        wallets: { link: "never" },
      });
      element.on("change", () => clearProblem());
      element.mount(box.current);
      mounted.current = { stripe, elements };

      // switching theme (theme.tsx sets data-theme) redraws the form to match
      const themeWatch = new MutationObserver(() =>
        elements.update({ appearance: appearance() }),
      );
      themeWatch.observe(document.documentElement, {
        attributeFilter: ["data-theme"],
      });

      destroy = () => {
        themeWatch.disconnect();
        element.destroy();
      };
    }, notLoaded);
    return () => {
      destroy?.();
      mounted.current = null;
    };
  }, [form]);

  const ready = useCallback(() => {
    if (mounted.current) return mounted.current;
    throw new CardProblem(failed.current ? NOT_LOADED : LOADING);
  }, []);

  return { box, mounted, ready };
};

// what the form says while the payment provider's part of it isn't ready
const NOT_LOADED = "The form didn't load. Please refresh the page.";
const LOADING = "The form is still loading.";

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
      label="Card"
      description={NEVER_SEE_CARD}
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
  const { value: form, failed } = useLoaded("payment-form", () =>
    getJson<PaymentForm>("/api/payment-methods/form"),
  );
  const [problem, setProblem] = useState<string>();

  // a 0 Deposit only saves the card
  const modeFor = (cents: number) =>
    cents > 0
      ? ({ mode: "payment", amount: cents } as const)
      : ({ mode: "setup" } as const);

  const { box, mounted, ready } = useStripeElement(
    showCard ? form : undefined,
    (stripe) =>
      stripe.elements({
        ...modeFor(amountCents),
        currency: "usd",
        setupFutureUsage: "off_session",
        allowedPaymentMethodTypes: ALLOWED_PAYMENT_METHOD_TYPES,
        appearance: appearance(),
        fonts: FONTS,
      }),
    setProblem,
  );

  // the amount follows the Service chosen
  useEffect(() => {
    void mounted.current?.elements.update(modeFor(amountCents));
  }, [amountCents, mounted]);

  const token = useCallback(async () => {
    if (!form) throw new CardProblem(LOADING);
    // a card "entered" in the test form; each is used once
    if (form.form === "test") return `tok_test_${crypto.randomUUID()}`;
    const { stripe, elements } = ready();
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
  }, [form, ready]);

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
    field: formField(form, box, failed ? NOT_LOADED : problem),
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
export function useCardForm() {
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string>();

  // a form is started only when it's shown, and again on each attempt: each
  // is a setup with the provider
  const { value: form, failed } = useLoaded(String(attempt), () =>
    postJson<CardForm>("/api/payment-methods/mine/card-form"),
  );

  const { box, ready } = useStripeElement(
    form,
    (stripe) =>
      form?.form === "stripe"
        ? stripe.elements({
            clientSecret: form.secret,
            appearance: appearance(),
            fonts: FONTS,
          })
        : null,
    setProblem,
  );

  const save = useCallback(async () => {
    if (!form) throw new CardProblem(LOADING);
    let token = form.secret;
    if (form.form === "stripe") {
      const { stripe, elements } = ready();
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
  }, [form, ready]);

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
        formField(form, box, failed ? NOT_LOADED : problem)
      ),
    save,
    reset,
    isReady: Boolean(form),
  };
}

/**
 * The form a Bill is paid with on its page (ADR-0016), by card or by ACH
 * Direct Debit from a US bank account: nothing is saved for later. Each form
 * is a payment started with the provider, so one is only started when it's
 * shown. `pay()` completes it there and hands back what our server then asks
 * the provider about. After a payment is refused, `reset()` starts afresh.
 */
export function useBillPaymentForm(billId: string) {
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<string>();

  const { value: form, failed } = useLoaded(`${billId}:${attempt}`, () =>
    postJson<BillPaymentForm>(`/api/bills/mine/${billId}/payment-form`),
  );

  const { box, ready } = useStripeElement(
    form,
    (stripe) =>
      form?.form === "stripe"
        ? stripe.elements({
            clientSecret: form.secret,
            appearance: appearance(),
            fonts: FONTS,
          })
        : null,
    setProblem,
  );

  const pay = useCallback(async () => {
    if (!form) throw new CardProblem(LOADING);
    if (form.form === "stripe") {
      const { stripe, elements } = ready();
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (result.error) {
        setProblem(result.error.message);
        throw new CardProblem(
          result.error.message ?? "Your payment didn't go through.",
        );
      }
    }
    return form.ref;
  }, [form, ready]);

  const reset = useCallback(() => {
    setProblem(undefined);
    setAttempt((n) => n + 1);
  }, []);

  return {
    field:
      form?.form === "test" ? (
        <Notice>
          Test payments: no card or bank account is needed. Paying uses a test
          one.
        </Notice>
      ) : (
        <EmbeddedField
          label="Payment"
          description="Pay by card or straight from your US bank account. It goes straight into our payment service's secure form, so we never see your card or account number."
          errorMessage={failed ? NOT_LOADED : problem}
          framed={false}
        >
          <div ref={box} className="min-h-24" />
        </EmbeddedField>
      ),
    pay,
    reset,
    isReady: Boolean(form),
  };
}

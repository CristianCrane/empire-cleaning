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
  type StripeElementLocale,
  type StripeElements,
  type StripeError,
} from "@stripe/stripe-js";
import {
  type CardForm,
  type PaymentForm,
  type PaymentMethodView,
  catalog,
  stripeLocales,
} from "@empire-cleaning/models";
import { EmbeddedField, Notice, useLanguage } from "@empire-cleaning/ui";
import { getJson, postJson, putJson } from "../../api.ts";
import { reportUnexpected } from "../../monitoring.ts";
import { useLoaded } from "../load.ts";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025), as Stripe's own form is
const words = catalog({
  en: {
    // while the payment provider's part of the form isn't ready
    NOT_LOADED: "The form didn't load. Please refresh the page.",
    LOADING: "The form is still loading.",
    testPay:
      "Test payments: no card is needed. Paying uses a test card ending 4242.",
    testSave:
      "Test payments: no card is needed. Saving uses a test card ending 4242.",
    testBill:
      "Test payments: no card or bank account is needed. Paying uses a test one.",
    card: "Card",
    payment: "Payment",
    cardOrBank:
      "Pay by card or straight from your US bank account. It goes straight into our payment service's secure form, so we never see your card or account number.",
    checkCard: "Please check your card details.",
    cardNotUsed: "Your card couldn't be used.",
    formNotLoaded: "The payment form didn't load.",
    bankDidnt: "Your bank didn't approve the payment.",
    notSetUp: "Your card couldn't be set up.",
  },
  es: {
    NOT_LOADED: "No se cargó el formulario. Vuelva a cargar la página.",
    LOADING: "El formulario todavía se está cargando.",
    testPay:
      "Pagos de prueba: no hace falta tarjeta. Se paga con una tarjeta de prueba que termina en 4242.",
    testSave:
      "Pagos de prueba: no hace falta tarjeta. Se guarda una tarjeta de prueba que termina en 4242.",
    testBill:
      "Pagos de prueba: no hace falta tarjeta ni cuenta bancaria. Se paga con una de prueba.",
    card: "Tarjeta",
    payment: "Pago",
    cardOrBank:
      "Pague con tarjeta o directamente desde su cuenta bancaria de EE. UU. Va directo al formulario seguro de nuestro servicio de pagos, así que nunca vemos su número de tarjeta ni de cuenta.",
    checkCard: "Revise los datos de su tarjeta.",
    cardNotUsed: "No se pudo usar su tarjeta.",
    formNotLoaded: "No se cargó el formulario de pago.",
    bankDidnt: "Su banco no aprobó el pago.",
    notSetUp: "No se pudo guardar su tarjeta.",
  },
});

// The payment provider's own form, so card numbers never reach our server
// (ADR-0004): Stripe's Payment Element, for cards only (ADR-0008), except a
// Bill paid on its page, by card or bank debit (ADR-0016).
// With the test provider (end-to-end tests) there is no card to type: the
// form says so, and paying or saving just works.

// the card couldn't be used; the message is for the Client
export class CardProblem extends Error {}

// What Stripe said, as a CardProblem with its message for the Client. A card
// or bank that said no, details to check, a dropped connection, or the Client
// failing or closing the 3D Secure check (an invalid_request_error, with
// code payment_intent_ or setup_intent_authentication_failure, as Stripe's
// test mode gives both) is theirs to fix; anything else (a wrong key, a bad request, Stripe failing) is ours,
// so it's reported
const theirs = new Set([
  "card_error",
  "validation_error",
  "api_connection_error",
]);
const cardProblem = (error: StripeError, fallback: string) => {
  if (
    !theirs.has(error.type) &&
    !error.code?.endsWith("_authentication_failure")
  ) {
    reportUnexpected(
      new Error(
        `Stripe ${error.type}${error.code ? ` (${error.code})` : ""}: ${error.message ?? ""}`,
      ),
    );
  }
  return new CardProblem(error.message ?? fallback);
};

// what saving a card agrees to, shown beside every form that saves one
export function ConsentNote({ action }: { action: "paying" | "saving" }) {
  const { cardConsent } = useSaid(words);
  return (
    <p className="text-sm text-fg-muted">{cardConsent(action === "paying")}</p>
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

// what the form takes. Cards only: they settle at once, as a Deposit must
// (ADR-0008). Or, for a Bill paid on its page, a US bank account too, linked
// at once by signing in to the bank in the form, never by microdeposits,
// whose code step takes days and runs a weekly bill past its due date
// (ADR-0016; https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment).
// Not Link, which also offers bank payments (useStripeElement)
type Methods = "card" | "cardOrBank";
const methodsOf = (methods: Methods) =>
  methods === "card"
    ? { allowedPaymentMethodTypes: ["card"] }
    : {
        allowedPaymentMethodTypes: ["card", "us_bank_account"],
        paymentMethodOptions: {
          us_bank_account: { verification_method: "instant" as const },
        },
      };

// what a payment the server started waits on: the Client's bank approving
// it here (e.g. 3D Secure)
type NeedsApproval = { status: "needs_approval"; secret: string };
const needsApproval = (outcome: unknown): outcome is NeedsApproval =>
  (outcome as { status?: unknown }).status === "needs_approval";

// Mounts the Payment Element into a box once Stripe has loaded, and tears it
// down when the form changes or goes away. It follows the screen's language
// (`locale`) as it changes, Stripe's own words too (its terms line), without
// starting the form afresh. `ready()` is what's mounted, to
// pay or save with, or says why there's nothing: still loading, or Stripe.js
// couldn't load (blocked, or no connection), which is reported
const useStripeElement = (
  form: PaymentForm | undefined,
  options: (stripe: Stripe) => StripeElements | null,
  setProblem: (problem: string | undefined) => void,
  locale: StripeElementLocale,
) => {
  const { NOT_LOADED, LOADING } = useSaid(words).w;
  const box = useRef<HTMLDivElement>(null);
  const mounted = useRef<{ stripe: Stripe; elements: StripeElements }>(null);
  // the options are read once per form, as it mounts
  const elementsFor = useEffectEvent(options);
  const clearProblem = useEffectEvent(() => setProblem(undefined));
  const failed = useRef(false);
  const notLoaded = useEffectEvent(() => {
    failed.current = true;
    setProblem(NOT_LOADED);
  });

  useEffect(() => {
    if (form?.form !== "stripe" || !box.current) return;
    let destroy: (() => void) | undefined;
    // Stripe.js loaded for a form since gone (hidden, or another) mounts
    // nothing: the next one's load mounts it
    let current = true;
    failed.current = false;
    loadStripe(form.publishableKey).then(
      (stripe) => {
        if (!current || !stripe || !box.current) return;
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
      },
      // reported even for a form since gone: it would fail for the next too
      (e: unknown) => {
        reportUnexpected(e);
        if (current) notLoaded();
      },
    );
    return () => {
      current = false;
      destroy?.();
      mounted.current = null;
    };
  }, [form]);

  // the options were read as it mounted, in that language: a change of
  // language since is Stripe's to redraw (#305)
  useEffect(() => {
    void mounted.current?.elements.update({ locale });
  }, [locale]);

  const ready = useCallback(() => {
    if (mounted.current) return mounted.current;
    throw new CardProblem(failed.current ? NOT_LOADED : LOADING);
  }, [NOT_LOADED, LOADING]);

  return { box, mounted, ready };
};

const formField = (
  t: ReturnType<typeof useCardWords>,
  form: PaymentForm | undefined,
  box: RefObject<HTMLDivElement | null>,
  problem: string | undefined,
  methods: Methods = "card",
): ReactNode =>
  form?.form === "test" ? (
    <Notice>{methods === "card" ? t.w.testPay : t.w.testBill}</Notice>
  ) : (
    <EmbeddedField
      label={methods === "card" ? t.w.card : t.w.payment}
      description={methods === "card" ? t.NEVER_SEE_CARD : t.w.cardOrBank}
      errorMessage={problem}
      framed={false}
    >
      <div ref={box} className="min-h-24" />
    </EmbeddedField>
  );

/**
 * The form a payment is made with: a Deposit's, a card entered here saved by
 * the same payment for later Charges (`saves`), or a Bill's on its page, by
 * card or bank account (`methods`), nothing saved. Our server takes the
 * payment, from what was entered (`token()`); if the Client's bank then
 * wants them to approve it, `approve(secret)` runs that approval (e.g. 3D
 * Secure) here. That can happen paying with a saved card too, so the card
 * box is only shown with `showCard`, but approval always works. `pay` runs
 * the whole of it, the one way each payment goes.
 */
export function usePaymentForm({
  amountCents,
  showCard = true,
  methods = "card",
  saves = true,
}: {
  amountCents: number;
  showCard?: boolean;
  methods?: Methods;
  saves?: boolean;
}) {
  const t = useCardWords();
  const { w, locale } = t;
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
        // the server's PaymentIntent says the same, or Stripe refuses it
        ...(saves && { setupFutureUsage: "off_session" as const }),
        ...methodsOf(methods),
        appearance: appearance(),
        fonts: FONTS,
        locale,
      }),
    setProblem,
    locale,
  );

  // the amount follows the Service chosen
  useEffect(() => {
    void mounted.current?.elements.update(modeFor(amountCents));
  }, [amountCents, mounted]);

  const token = useCallback(async () => {
    if (!form) throw new CardProblem(w.LOADING);
    // a card "entered" in the test form; each is used once
    if (form.form === "test") return `tok_test_${crypto.randomUUID()}`;
    const { stripe, elements } = ready();
    const submitted = await elements.submit();
    if (submitted.error) {
      setProblem(submitted.error.message);
      throw cardProblem(submitted.error, w.checkCard);
    }
    const result = await stripe.createConfirmationToken({
      elements,
      params: { return_url: window.location.href },
    });
    if (result.error) {
      throw cardProblem(result.error, w.cardNotUsed);
    }
    return result.confirmationToken.id;
  }, [form, ready, w]);

  const approve = useCallback(
    async (secret: string) => {
      // the test provider's bank needs nothing from the Client
      if (form?.form !== "stripe") return;
      const stripe =
        mounted.current?.stripe ?? (await loadStripe(form.publishableKey));
      if (!stripe) throw new CardProblem(w.formNotLoaded);
      const result = await stripe.handleNextAction({ clientSecret: secret });
      if (result.error) {
        throw cardProblem(result.error, w.bankDidnt);
      }
    },
    [form, mounted, w],
  );

  // A payment, start to end: what was entered (none paying with a saved
  // card) goes to our server, which takes it (`start`); if the Client's bank
  // wants them to approve it, they do, here, and `finish` tells the server
  // how that went: given the CardProblem when it wasn't approved, which it
  // may throw, its own refusal (the server's words for it), or a payment the
  // server finds was taken all the same. What `finish` gives back, or
  // `start` when nothing needed approving, is how the payment ended
  const pay = useCallback(
    async <T,>({
      start,
      finish,
    }: {
      start: (token: string | undefined) => Promise<T | NeedsApproval>;
      finish: (refused?: CardProblem) => Promise<T>;
    }): Promise<T> => {
      const outcome = await start(showCard ? await token() : undefined);
      if (!needsApproval(outcome)) return outcome;
      try {
        await approve(outcome.secret);
      } catch (e) {
        if (e instanceof CardProblem) return finish(e);
        throw e;
      }
      return finish();
    },
    [showCard, token, approve],
  );

  return {
    field: formField(t, form, box, failed ? w.NOT_LOADED : problem, methods),
    token,
    approve,
    pay,
    isReady: Boolean(form),
  };
}

/**
 * The form for saving a card without paying (the Office's add-a-card link).
 * `save()` sets the card up with the provider, then saves it as the
 * Client's Payment Method. After a card is refused, `reset()` starts afresh.
 */
export function useCardForm() {
  const t = useCardWords();
  const { w, locale } = t;
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
            locale,
          })
        : null,
    setProblem,
    locale,
  );

  const save = useCallback(async () => {
    if (!form) throw new CardProblem(w.LOADING);
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
        throw cardProblem(result.error, w.notSetUp);
      }
      token = result.setupIntent.id;
    }
    return putJson<PaymentMethodView>("/api/payment-methods/mine", { token });
  }, [form, ready, w]);

  const reset = useCallback(() => {
    setProblem(undefined);
    setAttempt((n) => n + 1);
  }, []);

  return {
    field:
      form?.form === "test" ? (
        <Notice>{w.testSave}</Notice>
      ) : (
        formField(t, form, box, failed ? w.NOT_LOADED : problem)
      ),
    save,
    reset,
    isReady: Boolean(form),
  };
}

// the form's words, and Stripe's locale, so its own words and the errors
// it gives follow the screen's language (ADR-0025)
const useCardWords = () => {
  const t = useSaid(words);
  return { ...t, locale: stripeLocales[useLanguage()] };
};

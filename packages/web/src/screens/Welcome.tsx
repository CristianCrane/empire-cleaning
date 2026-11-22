import { catalog } from "@empire-cleaning/models";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import { Button, FormPage, showToast, useLanguage } from "@empire-cleaning/ui";
import { forgetAccount, signOut } from "../session.ts";
import { quoteRequested } from "./QuoteParts.tsx";
import { useSaid } from "./words.ts";

const words = catalog({
  en: {
    signedInAs: (email: string) => `Signed in as ${email}`,
    otherEmail:
      "Asked us for a quote with a different email? Sign out and sign in with that one.",
  },
  es: {
    signedInAs: (email: string) => `Sesión iniciada como ${email}`,
    otherEmail:
      "¿Nos pidió una cotización con otro correo electrónico? Cierre sesión e inicie sesión con ese.",
  },
});

// for an Account connected to nothing yet (ADR-0006): someone who signed up
// before asking for a Quote, or with a different email from their Quote
// Request. Asking for a Quote here makes them a Client. A Form page of its
// own: the form in its steps, what happens next said once, in the line
// under the title (UX pass, #96; #434; #493 G5.3)
export function Welcome() {
  const { account } = useRouteContext({ from: "/welcome" });
  const navigate = useNavigate();
  const lang = useLanguage();
  const t = useSaid(words);
  const { w, ASK_US } = t;

  return (
    <FormPage
      title={t.welcome}
      subtitle={ASK_US}
      account={
        <span className="flex items-center gap-2 text-sm text-fg-muted">
          {w.signedInAs(account.email)}
          <Button
            variant="text"
            size="sm"
            onPress={async () => {
              await signOut();
              void navigate({ to: "/sign-in" });
            }}
          >
            {t.signOut}
          </Button>
        </span>
      }
      alerts={[{ key: "other-email", tone: "info", children: w.otherEmail }]}
    >
      <QuoteRequestForm
        headingLevel={2}
        // signed up but not yet a Client, so no Preferred Language: the
        // app's, the signed-out language
        asker={{ kind: "account" }}
        onSubmitted={async (receipt) => {
          // now a Client: the API connected this Account straight away
          forgetAccount();
          showToast(quoteRequested(lang, receipt.emailedTo));
          await navigate({ to: "/portal" });
        }}
      />
    </FormPage>
  );
}

import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { CircleCheck, CreditCard, Receipt } from "lucide-react";
import { catalog, type ClientPayment } from "@empire-cleaning/models";
import {
  Button,
  byMonth,
  Heading,
  HomePage,
  List,
  ListItem,
  Notice,
  StatusBadge,
  useUiWords,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { useHomeUrl } from "../home-search.ts";
import { HeroCard, whyAlert } from "./HeroCard.tsx";
import {
  moneyNow,
  owedAnswer,
  paymentRow,
  signedMoney,
  yourCardTile,
} from "./payments.ts";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    allPaid: "You're all paid up",
    nothingOwed: "Nothing owed",
    bankOnWay: (amount: string, bill: string) =>
      `Your bank payment of ${amount} for bill ${bill} is on its way.`,
    yourPayments: "Your payments",
    allPayments: "All payments",
    nothingPaid: "Nothing paid yet",
    paymentsIn: (month: string) => `All payments, ${month}`,
  },
  es: {
    allPaid: "Está al día",
    nothingOwed: "No debe nada",
    bankOnWay: (amount: string, bill: string) =>
      `Su pago bancario de ${amount} de la factura ${bill} está en camino.`,
    yourPayments: "Sus pagos",
    allPayments: "Todos los pagos",
    nothingPaid: "Aún no hay pagos",
    paymentsIn: (month: string) => `Todos los pagos, ${month}`,
  },
});

// The Client's Payments, a Home (docs/ux.md, Screen types): what they owe
// now, or that it's nothing, in one card with its one Button; then every
// payment behind a tile, opened in place. Their card has a fixed way in, in
// the header, and a tile. (UX pass, #96; #435)

// its tiles that open in place, as its URL names them
export const paymentsTiles = ["history"] as const;

// payments shown at a time
const PAGE = 20;

export function PortalPayments() {
  const t = useSaid(words);
  const data = useLoaderData({ from: "/portal/payments" });
  const home = useHomeUrl();
  const money = moneyNow(data, t.lang);
  const { owed, clearing } = money;
  const owing = owed && owedAnswer(owed, t.lang, data.plans);
  const { history } = data;

  return (
    <HomePage
      title={t.p.payments}
      actions={[
        // stands aside while the card asks something of them, as Home's
        // does (docs/ux.md; UX review U18); Your card's tile stays below
        !owed?.asks && {
          label: t.p.yourCard,
          icon: CreditCard,
          href: linkTo({ to: "/portal/payment-method" }),
        },
      ]}
      alerts={[whyAlert(owing?.why)]}
      answer={
        <HeroCard
          hero={
            owing
              ? owing.hero
              : {
                  label: t.w.allPaid,
                  icon: CircleCheck,
                  tone: "success",
                  headline: t.w.nothingOwed,
                  lines: [],
                }
          }
        />
      }
      notices={clearing.map((bill) => (
        <Notice key={bill.id}>
          {t.w.bankOnWay(t.formatMoney(bill.totalCents), bill.number)}{" "}
          {t.BANK_CLEARING}
        </Notice>
      ))}
      tilesLabel={t.w.yourPayments}
      tiles={[
        {
          id: "history",
          icon: Receipt,
          label: t.w.allPayments,
          count: history.length,
          hint: history.length === 0 ? t.w.nothingPaid : undefined,
          panel: <Statement history={history} />,
        },
        yourCardTile(money, t.lang),
      ]}
      {...home}
    />
  );
}

// every payment, by month, each month's total by its name
function Statement({ history }: { history: ClientPayment[] }) {
  const t = useSaid(words);
  const ui = useUiWords();
  const [shown, setShown] = useState(PAGE);
  const months = byMonth(t.lang, history.slice(0, shown), (p) => p.at);

  return (
    <div className="flex flex-col gap-6">
      {months.map(({ month, items: payments }) => (
        <section key={month} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 px-4">
            <Heading level={3} size={4} className="text-fg-muted">
              {month}
            </Heading>
            <span className="text-sm text-fg-muted tabular-nums">
              {signedMoney(
                t.lang,
                payments.reduce((sum, p) => sum + p.amountCents, 0),
              )}
            </span>
          </div>
          <Rows label={t.w.paymentsIn(month)} payments={payments} />
        </section>
      ))}
      {history.length > shown && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => setShown(shown + PAGE)}
        >
          {ui.showMoreLeft(t.formatNumber(history.length - shown))}
        </Button>
      )}
    </div>
  );
}

// one line a payment: its day, what it was for, and the amount
function Rows({
  label,
  payments,
}: {
  label: string;
  payments: ClientPayment[];
}) {
  const t = useSaid(words);
  const navigate = useNavigate();
  const rows = payments.map((p) => ({ p, row: paymentRow(p, t.lang) }));

  return (
    <List
      aria-label={label}
      onAction={(key) => {
        const href = rows.find(({ p }) => p.id === key)?.row.href;
        if (href) void navigate(href);
      }}
    >
      {rows.map(({ p, row }) => (
        <ListItem
          key={p.id}
          id={p.id}
          start={
            <span className="w-12 shrink-0 text-sm text-fg-muted tabular-nums">
              {t.shortDayOf(p.at)}
            </span>
          }
          title={row.title}
          description={row.line}
          end={
            <span className="flex items-center gap-3">
              {p.clearing && (
                <StatusBadge tone="info">{t.paymentPending}</StatusBadge>
              )}
              <span className="font-semibold text-fg tabular-nums">
                {signedMoney(t.lang, p.amountCents)}
              </span>
            </span>
          }
        />
      ))}
    </List>
  );
}

import { useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { CircleCheck, CreditCard, Receipt, TriangleAlert } from "lucide-react";
import { catalog, type ClientPayment } from "@empire-cleaning/models";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { dayOfInstant } from "../format.ts";
import { moneyNow, paymentRow, signedMoney } from "./payments.ts";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    toPay: "To pay",
    allPaid: "You're all paid up",
    nothingOwed: "Nothing owed",
    bankOnWay: (amount: string, bill: string) =>
      `Your bank payment of ${amount} for bill ${bill} is on its way.`,
    history: "History",
    nothingPaid: "Nothing paid yet",
    eachShows: "Each deposit, clean and refund shows here.",
    latest: "Latest payments",
    seeAll: (n: number) => `See all ${n} payments`,
    paymentsIn: (month: string) => `Payments, ${month}`,
    clearing: "Clearing",
  },
  es: {
    toPay: "Por pagar",
    allPaid: "Está al día",
    nothingOwed: "No debe nada",
    bankOnWay: (amount: string, bill: string) =>
      `Su pago bancario de ${amount} de la factura ${bill} está en camino.`,
    history: "Historial",
    nothingPaid: "Aún no hay pagos",
    eachShows: "Cada depósito, limpieza y devolución aparece aquí.",
    latest: "Últimos pagos",
    seeAll: (n: number) => `Ver los ${n} pagos`,
    paymentsIn: (month: string) => `Pagos, ${month}`,
    clearing: "En proceso",
  },
});

// The Client's Payments: what they owe now, or that it's nothing, in one
// card with its one Button; then their latest payments, one line each, and
// all of them a tap away. Their card has a fixed way in, in the header.
// (UX pass, #96)

export type PaymentsSearch = { all?: true };

// payments shown before "See all"
const LATEST = 5;
// and at a time after it
const PAGE = 20;

export function PortalPayments() {
  const t = useSaid(words);
  const data = useLoaderData({ from: "/portal/payments" });
  const { all } = useSearch({ from: "/portal/payments" });
  const { owed, paying, clearing } = moneyNow(data, t.lang);
  const { history } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1} inBar>
          {t.p.payments}
        </Heading>
        <ButtonLink
          variant="secondary"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          <CreditCard aria-hidden size={18} />
          {t.p.yourCard}
        </ButtonLink>
      </div>

      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <IconTile
            icon={owed ? TriangleAlert : CircleCheck}
            tone={owed ? (owed.late ? "danger" : "warning") : "success"}
            size="lg"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Heading level={2} size={4} className="text-fg-muted">
              {owed ? t.w.toPay : t.w.allPaid}
            </Heading>
            <p className="text-2xl font-semibold text-fg sm:text-3xl">
              {owed ? t.formatMoney(owed.cents) : t.w.nothingOwed}
            </p>
            {owed && <p className="text-fg-muted">{owed.text}</p>}
            <p className="text-fg-muted">{paying}</p>
          </div>
          {owed && (
            <ButtonLink
              className="shrink-0 self-start sm:self-center"
              href={owed.action.href}
            >
              {owed.action.label}
            </ButtonLink>
          )}
        </div>
      </Card>

      {clearing.map((bill) => (
        <Notice key={bill.id}>
          {t.w.bankOnWay(t.formatMoney(bill.totalCents), bill.number)}{" "}
          {t.BANK_CLEARING}
        </Notice>
      ))}

      <Section title={t.w.history}>
        {history.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t.w.nothingPaid}
            description={t.w.eachShows}
          />
        ) : all ? (
          <Statement history={history} />
        ) : (
          <div className="flex flex-col gap-3">
            <Rows label={t.w.latest} payments={history.slice(0, LATEST)} />
            {history.length > LATEST && (
              <Link
                className="self-start"
                href={linkTo({ to: "/portal/payments", search: { all: true } })}
              >
                {t.w.seeAll(history.length)}
              </Link>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// every payment, by month, each month's total by its name
function Statement({ history }: { history: ClientPayment[] }) {
  const t = useSaid(words);
  const [shown, setShown] = useState(PAGE);
  const months: { month: string; payments: ClientPayment[] }[] = [];
  for (const p of history.slice(0, shown)) {
    const month = t.formatMonth(dayOfInstant(p.at));
    if (months.at(-1)?.month !== month) months.push({ month, payments: [] });
    months.at(-1)!.payments.push(p);
  }

  return (
    <div className="flex flex-col gap-6">
      {months.map(({ month, payments }) => (
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
          {t.p.showMore}
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
              {t.formatShortDay(dayOfInstant(p.at))}
            </span>
          }
          title={row.title}
          description={row.line}
          end={
            <span className="flex items-center gap-3">
              {p.clearing && (
                <StatusBadge tone="info">{t.w.clearing}</StatusBadge>
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

import { useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { CircleCheck, CreditCard, Receipt, TriangleAlert } from "lucide-react";
import type { ClientPayment } from "@empire-cleaning/models";
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
import { dayOfInstant, formatMoney, formatShortDay } from "../format.ts";
import { moneyNow, paymentRow, signedMoney } from "./payments.ts";

// The Client's Payments: what they owe now, or that it's nothing, in one
// card with its one Button; then their latest payments, one line each, and
// all of them a tap away. Their card has a fixed way in, in the header.
// (UX pass, #96)

export type PaymentsSearch = { all?: true };

// payments shown before "See all"
const LATEST = 5;
// and at a time after it
const PAGE = 20;

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "America/New_York",
});

export function PortalPayments() {
  const data = useLoaderData({ from: "/portal/payments" });
  const { all } = useSearch({ from: "/portal/payments" });
  const { owed, paying, clearing } = moneyNow(data);
  const { history } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>Payments</Heading>
        <ButtonLink
          variant="secondary"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          <CreditCard aria-hidden size={18} />
          Payment Method
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
              {owed ? "To pay" : "You're all paid up"}
            </Heading>
            <p className="text-2xl font-semibold text-fg sm:text-3xl">
              {owed ? formatMoney(owed.cents) : "Nothing owed"}
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
          Your bank payment of {formatMoney(bill.totalCents)} for Bill{" "}
          {bill.number} is on its way. It usually takes a few working days to
          clear.
        </Notice>
      ))}

      <Section title="History">
        {history.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing paid yet"
            description="Each Deposit, clean and refund shows here."
          />
        ) : all ? (
          <Statement history={history} />
        ) : (
          <div className="flex flex-col gap-3">
            <Rows label="Latest payments" payments={history.slice(0, LATEST)} />
            {history.length > LATEST && (
              <Link
                className="self-start"
                href={linkTo({ to: "/portal/payments", search: { all: true } })}
              >
                See all {history.length} payments
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
  const [shown, setShown] = useState(PAGE);
  const months: { month: string; payments: ClientPayment[] }[] = [];
  for (const p of history.slice(0, shown)) {
    const month = monthFormat.format(new Date(p.at));
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
              {signedMoney(payments.reduce((sum, p) => sum + p.amountCents, 0))}
            </span>
          </div>
          <Rows label={`Payments, ${month}`} payments={payments} />
        </section>
      ))}
      {history.length > shown && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => setShown(shown + PAGE)}
        >
          Show more
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
  const navigate = useNavigate();
  const rows = payments.map((p) => ({ p, row: paymentRow(p) }));

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
              {formatShortDay(dayOfInstant(p.at))}
            </span>
          }
          title={row.title}
          description={row.line}
          end={
            <span className="flex items-center gap-3">
              {p.clearing && <StatusBadge tone="info">Clearing</StatusBadge>}
              <span className="font-semibold text-fg tabular-nums">
                {signedMoney(p.amountCents)}
              </span>
            </span>
          }
        />
      ))}
    </List>
  );
}

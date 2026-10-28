import { useLoaderData } from "@tanstack/react-router";
import type { BillView } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Heading,
  Notice,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  PrintBill,
  billWeek,
} from "../BillParts.tsx";
import { formatDay, formatMoney } from "../format.ts";
import { useBillPaymentForm } from "./CardForm.tsx";

// one of the Client's weekly Bills (ADR-0016), where its emails lead: the
// whole Bill, which prints cleanly, and paying it here by card or bank debit
// while it's due
export function PortalBill() {
  const bill = useLoaderData({ from: "/portal/bills/$billId" });

  return (
    <div className="flex flex-col gap-6">
      <BillLetterhead />
      <div className="flex flex-col gap-4">
        <div className="print:hidden">
          <Breadcrumbs
            trail={[
              { label: "Home", href: linkTo({ to: "/portal" }) },
              { label: `Bill ${bill.number}` },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>Bill {bill.number}</Heading>
            <BillStatusBadge bill={bill} />
          </div>
          <div className="print:hidden">
            <PrintBill />
          </div>
        </div>
        <p className="text-fg-muted">{billWeek(bill)}</p>
      </div>

      <Standing bill={bill} />
      {bill.payable && <PayBill bill={bill} />}
      <BillDetail
        bill={bill}
        forClient
        jobHref={(jobId) =>
          linkTo({ to: "/portal/jobs/$jobId", params: { jobId } })
        }
      />
    </div>
  );
}

// what's left to do about it, if anything
function Standing({ bill }: { bill: BillView }) {
  if (bill.status === "processing") {
    return (
      <Notice tone="info">
        Your bank payment of {formatMoney(bill.totalCents)} is on its way. It
        usually takes a few working days to clear, and we'll email you when it
        has.
      </Notice>
    );
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid && bill.payment === "on_page") {
    return (
      <Notice tone="danger">
        This Bill was due by {formatDay(bill.dueOn)} and hasn't been paid.
        Please pay {formatMoney(bill.totalCents)} below. Until it's paid, any
        Service Plan with cleans on it is On Hold: cleans already booked go
        ahead, but we won't book any more.
      </Notice>
    );
  }
  if (bill.unpaid) {
    return (
      <div className="flex flex-col gap-3 print:hidden">
        <Notice tone="danger">
          We couldn't charge {formatMoney(bill.totalCents)} for this Bill to
          your saved Payment Method. Please pay it below, or update your Payment
          Method and we'll try again straight away.
        </Notice>
        <Actions>
          <ButtonLink
            variant="secondary"
            href={linkTo({ to: "/portal/payment-method" })}
          >
            Update Payment Method
          </ButtonLink>
        </Actions>
      </div>
    );
  }
  return bill.payment === "on_page" && bill.totalCents > 0 ? (
    <Notice>
      Please pay {formatMoney(bill.totalCents)} by {formatDay(bill.dueOn)}.
    </Notice>
  ) : null;
}

// paying it here, by card or bank debit: a card pays at once, a bank debit
// is processing until it clears
function PayBill({ bill }: { bill: BillView }) {
  const payment = useBillPaymentForm(bill.id, true);
  const action = useAction("That didn't work. Please try again.");

  const pay = () =>
    action.run(
      async () => {
        const ref = await payment.pay();
        return postJson<BillView>(`/api/bills/mine/${bill.id}/payment`, {
          ref,
        }).catch((e: unknown) => {
          // the payment started is no good now: start afresh
          if (e instanceof ApiError && e.status === 409) payment.reset();
          throw e;
        });
      },
      (paid) =>
        paid.status === "processing"
          ? "Your bank payment is on its way"
          : "Thank you: your Bill is paid",
    );

  return (
    <Card
      title="Pay this Bill"
      description={`${formatMoney(bill.totalCents)}, by card or from your bank account.`}
      className="print:hidden"
    >
      {payment.field}
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button
          onPress={() => void pay()}
          isPending={action.isPending}
          isDisabled={!payment.isReady}
        >
          Pay {formatMoney(bill.totalCents)}
        </Button>
      </Actions>
    </Card>
  );
}

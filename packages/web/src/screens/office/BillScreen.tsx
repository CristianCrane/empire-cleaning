import { useLoaderData } from "@tanstack/react-router";
import { Ban, Banknote } from "lucide-react";
import { officeFix, type BillView, formats } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Notice,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  PrintBill,
  billWeek,
} from "../BillParts.tsx";
import { useAction } from "../action.ts";
import { clientName } from "../format.ts";

const { formatDate, formatDay, formatMoney } = formats.en;

// one weekly Bill for the Office (ADR-0016): the whole Bill as the Client
// sees it, where it stands, and while it's unpaid, voiding it (cancelling, on
// screen) or recording a payment made another way
export function BillScreen() {
  const bill = useLoaderData({ from: "/office/bills/$billId" });

  return (
    <div className="flex flex-col gap-6">
      <BillLetterhead />
      <div className="flex flex-col gap-4">
        <div className="print:hidden">
          <Breadcrumbs
            trail={[
              { label: "Clients", href: linkTo({ to: "/office/clients" }) },
              {
                label: clientName(bill.client),
                href: linkTo({
                  to: "/office/clients/$clientId",
                  params: { clientId: bill.client.id },
                }),
              },
              { label: `Bill ${bill.number}` },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>Bill {bill.number}</Heading>
            <BillStatusBadge bill={bill} />
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {bill.status === "due" && (
              <>
                <RecordPayment bill={bill} />
                <VoidBill bill={bill} />
              </>
            )}
            <PrintBill />
          </div>
        </div>
        <p className="text-fg-muted">
          {clientName(bill.client)} · {billWeek("en", bill)}
        </p>
      </div>

      <Standing bill={bill} />
      <BillDetail
        bill={bill}
        forClient={false}
        jobHref={(jobId) =>
          linkTo({ to: "/office/jobs/$jobId", params: { jobId } })
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
        The client's bank payment of {formatMoney(bill.totalCents)} is on its
        way. It's paid once it clears, usually in a few working days.
      </Notice>
    );
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid) {
    const { kind, why } = bill.unpaid;
    return (
      <Notice tone="danger">
        {kind === "late"
          ? `It wasn't paid by its due date, ${formatDay(bill.dueOn)}.`
          : `Its payment didn't go through on ${formatDate(bill.unpaid.since)}${why ? ` (${why})` : ""}.`}{" "}
        {officeFix[kind]} Until it's paid, the client's cleaning plans with jobs
        on this bill are paused.
      </Notice>
    );
  }
  return bill.payment === "on_page" && bill.totalCents > 0 ? (
    <Notice>
      Waiting for the client to pay it on its page, by {formatDay(bill.dueOn)}.
    </Notice>
  ) : null;
}

// a short note, required, sent with the action; the API's message shown if
// it's turned down
function useBillAction(bill: BillView, path: string, done: string) {
  const action = useAction("That didn't work. Please try again.");
  const run = async (body: Record<string, unknown>, close: () => void) => {
    const ok = await action.run(
      () => postJson<BillView>(`/api/bills/${bill.id}/${path}`, body),
      done,
    );
    if (ok) close();
  };
  return { ...action, run };
}

// a cheque or bank transfer the Client paid, which settles the Bill
function RecordPayment({ bill }: { bill: BillView }) {
  const action = useBillAction(bill, "outside-payment", "Payment recorded");
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <Banknote aria-hidden size={16} />
        Record a payment
      </Button>
      <Dialog title="Record a payment">
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void action.run({ note: form.get("note") }, close);
            }}
          >
            <p>
              For {formatMoney(bill.totalCents)} paid another way. It marks the
              bill paid, and we email the client a receipt.
            </p>
            <TextField
              label="How it was paid"
              name="note"
              description="For example, cheque 1042 or a bank transfer on Jan 14."
              isRequired
              autoFocus
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Record payment
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// a Bill that shouldn't have gone out: what was on it goes on the next one
function VoidBill({ bill }: { bill: BillView }) {
  const action = useBillAction(bill, "void", "Bill cancelled");
  return (
    <DialogTrigger>
      <Button variant="danger-text" size="sm">
        <Ban aria-hidden size={16} />
        Cancel bill
      </Button>
      <Dialog title={`Cancel bill ${bill.number}?`}>
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void action.run({ reason: form.get("reason") }, close);
            }}
          >
            <p>
              There'll be nothing to pay on it, and we tell the client. Anything
              on it still owed goes on their next bill, or is charged per job if
              they're no longer billed weekly.
            </p>
            <TextField
              label="Why it's cancelled"
              name="reason"
              description="The client sees this."
              isRequired
              autoFocus
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Keep it
              </Button>
              <Button
                type="submit"
                variant="danger"
                isPending={action.isPending}
              >
                Cancel bill
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

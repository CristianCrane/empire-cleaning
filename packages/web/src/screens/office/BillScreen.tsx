import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type { BillView } from "@empire-cleaning/models";
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
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  PrintBill,
  billWeek,
} from "../BillParts.tsx";
import { clientName, formatDate, formatDay, formatMoney } from "../format.ts";

// one weekly Bill for the Office (ADR-0016): the whole Bill as the Client
// sees it, where it stands, and while it's unpaid, voiding it or recording a
// payment made another way
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
          {clientName(bill.client)} · {billWeek(bill)}
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
        The Client's bank payment of {formatMoney(bill.totalCents)} is on its
        way. It's paid once it clears, usually in a few working days.
      </Notice>
    );
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid && bill.payment === "on_page") {
    return (
      <Notice tone="danger">
        It wasn't paid by its due date, {formatDay(bill.dueOn)}. The Client's
        Service Plans with Jobs on it are On Hold until it's paid, on its page
        or by a payment you record. They're reminded each week until then.
      </Notice>
    );
  }
  if (bill.unpaid) {
    return (
      <Notice tone="danger">
        Its automatic Charge failed ({bill.unpaid.reason}) on{" "}
        {formatDate(bill.unpaid.since)}. The Client's Service Plans with Jobs on
        it are On Hold until it's paid, on its page, with a new Payment Method,
        or by a payment you record.
      </Notice>
    );
  }
  return bill.payment === "on_page" && bill.totalCents > 0 ? (
    <Notice>
      Waiting for the Client to pay it on its page, by {formatDay(bill.dueOn)}.
    </Notice>
  ) : null;
}

// a short note, required, sent with the action; the API's message shown if
// it's turned down
function useBillAction(bill: BillView, path: string, done: string) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const run = async (body: Record<string, unknown>, close: () => void) => {
    setPending(true);
    setProblem(undefined);
    setFieldErrors({});
    try {
      await postJson<BillView>(`/api/bills/${bill.id}/${path}`, body);
      showToast({ tone: "success", title: done });
      close();
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setProblem(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "That didn't work. Please try again.",
        );
      }
    } finally {
      setPending(false);
    }
  };

  return { fieldErrors, problem, isPending, run };
}

// a cheque or bank transfer the Client paid, which settles the Bill
function RecordPayment({ bill }: { bill: BillView }) {
  const action = useBillAction(bill, "outside-payment", "Payment recorded");
  return (
    <DialogTrigger>
      <Button variant="secondary">Record a payment</Button>
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
              For {formatMoney(bill.totalCents)} paid another way. It settles
              the Bill, and the Client is sent a receipt.
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
              <Button variant="secondary" onPress={close}>
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
  const action = useBillAction(bill, "void", "Bill voided");
  return (
    <DialogTrigger>
      <Button variant="secondary">Void</Button>
      <Dialog title={`Void bill ${bill.number}?`}>
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
              There'll be nothing to pay on it, and the Client is told. Whatever
              on it is still owed goes on their next Bill, or is charged per Job
              if they're no longer billed weekly.
            </p>
            <TextField
              label="Why it's voided"
              name="reason"
              description="The Client sees this."
              isRequired
              autoFocus
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                type="submit"
                variant="danger"
                isPending={action.isPending}
              >
                Void
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

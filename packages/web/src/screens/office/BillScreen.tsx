import { useLoaderData } from "@tanstack/react-router";
import { Ban, Banknote } from "lucide-react";
import { officeFix, type BillView, formats } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Form,
  Notice,
  TextField,
  RecordPage,
  type Alert,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  usePrintBill,
  billWeek,
} from "../BillParts.tsx";
import { useAction } from "../action.ts";
import { clientTrail } from "./trails.ts";

const { formatDate, formatDay, formatMoney } = formats.en;

// one weekly Bill for the Office (ADR-0016), a Record (docs/ux.md): the
// whole Bill as the Client sees it, where it stands, and while it's unpaid,
// voiding it (cancelling, on screen) or recording a payment made another way
export function BillScreen() {
  const bill = useLoaderData({ from: "/office/bills/$billId" });
  const due = bill.status === "due";
  const print = usePrintBill();

  return (
    <>
      <BillLetterhead />
      <RecordPage
        trail={[...clientTrail(bill.client), { label: `Bill ${bill.number}` }]}
        title={`Bill ${bill.number}`}
        status={<BillStatusBadge bill={bill} />}
        // WEB-G: the week, which nothing else above says; not the Client
        subtitle={billWeek("en", bill)}
        actions={[
          due && {
            label: "Record a payment",
            icon: Banknote,
            dialog: (state) => <RecordPayment bill={bill} {...state} />,
          },
          print,
          due && {
            label: "Cancel bill",
            icon: Ban,
            danger: true,
            dialog: (state) => <VoidBill bill={bill} {...state} />,
          },
        ]}
        alerts={[standing(bill)]}
        details={
          <BillDetail
            bill={bill}
            forClient={false}
            jobHref={(jobId) =>
              linkTo({ to: "/office/jobs/$jobId", params: { jobId } })
            }
          />
        }
      />
    </>
  );
}

// what's left to do about it, if anything
function standing(bill: BillView): Alert | null {
  if (bill.status === "processing") {
    return {
      key: "processing",
      children: `The client's bank payment of ${formatMoney(bill.totalCents)} is on its way. It's paid once it clears, usually in a few working days.`,
    };
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid) {
    const { kind, why } = bill.unpaid;
    return {
      key: "unpaid",
      tone: "danger",
      children: `${
        kind === "late"
          ? `It wasn't paid by its due date, ${formatDay(bill.dueOn)}.`
          : `Its payment didn't go through on ${formatDate(bill.unpaid.since)}${why ? ` (${why})` : ""}.`
      } ${officeFix[kind]} Until it's paid, the client's cleaning plans with jobs on this bill are paused.`,
    };
  }
  return bill.payment === "on_page" && bill.totalCents > 0
    ? {
        key: "waiting",
        children: `Waiting for the client to pay it on its page, by ${formatDay(bill.dueOn)}.`,
      }
    : null;
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
function RecordPayment({ bill, ...state }: { bill: BillView } & DialogState) {
  const action = useBillAction(bill, "outside-payment", "Payment recorded");
  return (
    <Dialog title="Record a payment" {...state}>
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
  );
}

// a Bill that shouldn't have gone out: what was on it goes on the next one
function VoidBill({ bill, ...state }: { bill: BillView } & DialogState) {
  const action = useBillAction(bill, "void", "Bill cancelled");
  return (
    <Dialog title={`Cancel bill ${bill.number}?`} {...state}>
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
            <Button type="submit" variant="danger" isPending={action.isPending}>
              Cancel bill
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

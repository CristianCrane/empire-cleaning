import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { Ban, Banknote } from "lucide-react";
import {
  because,
  asksTheClient,
  bankPaymentOnWay,
  clientPayingBill,
  firstNameOf,
  officeFix,
  paymentNotDone,
  type BillView,
  formats,
} from "@empire-cleaning/models";
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
  type PageAction,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { addressOf, dayOfInstant, pausedPlans } from "../format.ts";
import { linkTo } from "../../links.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  usePrintBill,
} from "../BillParts.tsx";
import { useAction } from "../action.ts";
import { useWhilePaying } from "../paying.ts";
import { clientTrail } from "./trails.ts";

const { formatList, formatMoney, formatShortDay, formatTime } = formats.en;

// why Cancel bill and Record a payment are greyed, while they are: the
// Client's bank debit on its way, which takes days; their bank asking them
// to approve their payment on its page; or a payment going through
// (ADR-0022's one rule), each in its own words: the menu's short line, and
// each dialog's
const heldBy = (bill: BillView) => {
  if (bill.status === "processing") return bankPaymentOnWay;
  if (bill.paying?.status === "approving") {
    const first = firstNameOf(bill.client.name);
    const until = formatTime(bill.paying.until);
    return {
      item: clientPayingBill.item(first),
      cancel: clientPayingBill.cancel(first, until),
      record: clientPayingBill.record(first, until),
    };
  }
  return paymentNotDone;
};

// one weekly Bill for the Office (ADR-0016), a Record (docs/ux.md): the
// whole Bill as the Client sees it, where it stands, and while it's due,
// voiding it (cancelling, on screen) or recording a payment made another
// way. Once its payment didn't go through or it's late, recording one is
// the page's next step (the `ui` skill), unless it's a payment we try
// again ourselves (ADR-0022). While a payment on it may still take the
// money, both are greyed, and its alert says why (canCancelOrRecord, the
// server's answer), a bank debit on its way too, as it's due again if it
// fails (#534's UX review U14); while the Client's bank asks them to
// approve theirs, the page looks again, so it frees them once that's over
export function BillScreen() {
  const bill = useLoaderData({ from: "/office/bills/$billId" });
  const router = useRouter();
  const due = bill.status === "due";
  const open = due || bill.status === "processing";
  const print = usePrintBill();
  const held = !bill.canCancelOrRecord;
  const why = heldBy(bill).item;
  useWhilePaying(bill.paying?.status === "approving" ? bill.paying : null, () =>
    router.invalidate(),
  );
  const record: PageAction | false = open && {
    label: "Record a payment",
    icon: Banknote,
    isDisabled: held,
    why,
    dialog: (state) => <RecordPayment bill={bill} {...state} />,
  };
  // one their bank wants them to approve is theirs, as the Office's Job
  // says: nothing next here (#534's UX review U2)
  const next =
    due &&
    ((!!bill.unpaid &&
      asksTheClient(bill.unpaid.kind) &&
      bill.unpaid.kind !== "approve") ||
      bill.paying?.status === "failed");

  return (
    <>
      <BillLetterhead />
      <RecordPage
        trail={[...clientTrail(bill.client), { label: `Bill ${bill.number}` }]}
        title={`Bill ${bill.number}`}
        status={<BillStatusBadge bill={bill} />}
        next={(next && record) || undefined}
        actions={[
          !next && record,
          print,
          open && {
            label: "Cancel bill",
            icon: Ban,
            danger: true,
            isDisabled: held,
            why,
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
      children: `The client's bank payment is on its way. It's paid once it goes through, usually in a few working days.`,
    };
  }
  if (bill.status !== "due") return null;
  // the Client approving their payment with their bank, which waits on
  // them, till `until`
  if (bill.paying?.status === "approving") {
    return {
      key: "approving",
      tone: "warning",
      children: `${clientPayingBill.page(bill.client.name, formatTime(bill.paying.until))}${plansPaused(bill)}`,
    };
  }
  // over why it's unpaid, if it is: it's being tried now, and Office Staff
  // can do nothing about it until then (UX review U7)
  if (!bill.canCancelOrRecord) {
    return {
      key: "paymentNotDone",
      tone: "info",
      children: `${paymentNotDone.page}${plansPaused(bill)}`,
    };
  }
  // the Client's last payment on its page didn't go through, as they were
  // told (when, and why), and what's next: theirs to try again, or, once
  // late, our weekly reminder. Before the due date it pauses no plan of
  // theirs, so no plan line: one another Bill paused is that Bill's to say
  if (bill.paying?.status === "failed") {
    const { at, why } = bill.paying;
    const late = bill.unpaid?.kind === "late";
    return {
      key: "failed",
      tone: "danger",
      children: `The client's payment didn't go through on ${formatShortDay(dayOfInstant(at))}${because(why)}. ${late ? `${officeFix.late}${plansPaused(bill)}` : "They can try again on its page."}`,
    };
  }
  // their last one on its page never approved (by their bank, or they
  // left it), so it took nothing, as the Client's page says (#534's UX review U12); once
  // late, that's the news
  if (bill.paying?.status === "notApproved" && !bill.unpaid) {
    return {
      key: "notApproved",
      tone: "info",
      children: `The client's payment on ${formatShortDay(dayOfInstant(bill.paying.at))} wasn't approved, so nothing was taken. They can try again on its page.`,
    };
  }
  // the Client's bank wants them to approve its payment (#534 Q7): theirs
  // to do on its page, as we've emailed them, and no failure
  // to do on its page, as we've emailed them, and no failure; once they
  // turned it down there, theirs to try again
  if (bill.unpaid?.kind === "approve") {
    const name = firstNameOf(bill.client.name);
    const refused = bill.paying?.status === "notApproved";
    return {
      key: "unpaid",
      tone: "warning",
      children: (
        <p>
          <strong>
            {refused
              ? `${name} turned down this bill's payment at their bank.`
              : `${name}'s bank wants them to approve this bill's payment.`}
          </strong>{" "}
          {refused
            ? "None of it was taken. They can try again on the bill's page."
            : "None of it was taken. We've emailed them to approve it on the bill's page."}
          {plansPaused(bill)}
        </p>
      ),
    };
  }
  if (bill.unpaid) {
    const { kind, why } = bill.unpaid;
    // when is the line under its total's (UX review U5)
    return {
      key: "unpaid",
      tone: asksTheClient(kind) ? "danger" : "info",
      children: `${
        kind === "late"
          ? `It wasn't paid by its due date.`
          : asksTheClient(kind)
            ? `Its payment didn't go through${because(why)}.`
            : `Its payment hasn't gone through yet${because(why)}.`
      } ${officeFix[kind]}${plansPaused(bill)}`,
    };
  }
  // one simply due says when by in its line, and how it's paid in its facts
  return null;
}

// which of the client's cleaning plans it keeps paused, by their homes, as
// the Office's Needs attention names them, by the client's name as the
// alert's lead does; the Bill's own home, its Where fact, once (#534's UX
// review U6); nothing when it holds none
function plansPaused(bill: BillView) {
  const homes = pausedPlans(bill.plans).map((p) => addressOf(p.property));
  if (homes.length === 0) return "";
  const whose = `${firstNameOf(bill.client.name)}'s`;
  if (homes.length > 1)
    return ` Until it's paid, ${whose} cleaning plans at ${formatList(homes)} are paused.`;
  return ` Until it's paid, ${whose} cleaning plan at ${homes[0] === bill.home ? "this home" : homes[0]} is paused.`;
}

// a short note, required, sent with the action; the API's message shown if
// it's turned down, once the page has reloaded: a page opened before our
// card payment started greys the dialog's button then, and says why
function useBillAction(bill: BillView, path: string, done: string) {
  const action = useAction("That didn't work. Please try again.", {
    reloadOnFailure: true,
  });
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
          <WhyNot bill={bill} problem={action.problem} what="record" />
          <Actions>
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              isPending={action.isPending}
              isDisabled={!bill.canCancelOrRecord}
            >
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
    <Dialog title={`Cancel bill ${bill.number}?`} role="alertdialog" {...state}>
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
          <WhyNot bill={bill} problem={action.problem} what="cancel" />
          <Actions>
            <Button variant="quiet" onPress={close}>
              Keep it
            </Button>
            <Button
              type="submit"
              variant="danger"
              isPending={action.isPending}
              isDisabled={!bill.canCancelOrRecord}
            >
              Cancel bill
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

// why a dialog's action can't be done: while a payment may still take the
// money, or the Client's bank asks them to approve theirs, the server's
// words for it, in the tone of the page's alert for the same wait: info
// for one on us (UX review U4), warning for one on the Client (#534's UX
// review U4), whether a press
// was refused or the page caught up first (it reloads when its tab is
// shown again, and looks again while the Client approves theirs); else why
// a press was refused, but not a refusal for what held it once that's
// over, as it's untrue then and the button is back on (design review, a
// dialog left open). What held it is kept as it was said, as the Client's
// approving names a time that's gone once it's over
function WhyNot({
  bill,
  problem,
  what,
}: {
  bill: BillView;
  problem?: string;
  what: "cancel" | "record";
}) {
  const held = heldBy(bill)[what];
  const [said, setSaid] = useState<string>();
  if (!bill.canCancelOrRecord && said !== held) setSaid(held);
  if (!bill.canCancelOrRecord) {
    return (
      <Notice tone={bill.paying?.status === "approving" ? "warning" : "info"}>
        {held}
      </Notice>
    );
  }
  return problem && problem !== held && problem !== said ? (
    <Notice tone="danger">{problem}</Notice>
  ) : null;
}

import { type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarSync,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt as ReceiptIcon,
  CalendarX,
  ClipboardPenLine,
} from "lucide-react";
import type {
  AdjustmentView,
  CancellationTerms,
  ClientJobDetail,
  JobPayment,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  ButtonLink,
  Dialog,
  DialogTrigger,
  IconTile,
  Link,
  Notice,
  StatusBadge,
  Fact,
  RecordPage,
  DetailsCard,
  Facts,
  type Alert,
  type DialogState,
  Card,
  Section,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { linkTo } from "../../links.ts";
import { requestQuoteHref } from "./whats-next.ts";
import { PickAvailableTime } from "../AvailabilityPicker.tsx";
import { ChooseNewTime, costForClient } from "../RescheduleParts.tsx";
import { addressOf, formatHours, wasSkipped } from "../format.ts";
import { type Said, useSaid } from "../words.ts";
import { catalog, oneStop, stopAfter } from "@empire-cleaning/models";
import { JobStatusBadge } from "../JobBadges.tsx";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    details: "Clean details",
    partOfPlan: "Part of your cleaning plan",
    oneOff: "One-off clean",
    price: "Price",
    withDiscount: (percent: number) =>
      `Price with your ${percent}% plan discount, tax included`,
    taxIncluded: "Price, tax included",
    heldThere: "Its deposit is held there",
    offPrice: "Deposit, comes off the price",
    reminder: "We'll email a reminder the day before.",
    notSkipped: "Your clean wasn't skipped. Please try again.",
    notCancelled: "Your clean wasn't cancelled. Please try again.",
    feeOnPlan: (where: string) => `The fee ${where}.`,
    chargedToCard: "is charged to your card",
    refundDeposit: (amount: string) => `We'll refund your ${amount} deposit.`,
    skipped: "Your clean is skipped",
    cancelled: "Your clean is cancelled",
    skipThis: "Skip this clean",
    cancelClean: "Cancel clean",
    skipQ: "Skip this clean?",
    cancelQ: "Cancel your clean?",
    serviceAt: (service: string, address: string, when: string) =>
      `${service} at ${address}, ${when}.`,
    keep: "Keep my clean",
    onlyThis: "Only this clean is skipped. Your cleaning plan carries on.",
    notWithdrawn: "Your request wasn't withdrawn. Please try again.",
    withdrawn: "Request withdrawn",
    withdraw: "Withdraw request",
    askedTo: "You've asked to move it to",
    held: (when: string) =>
      ` That time is held for you while we confirm it. Until then, your clean stays booked for ${when}.`,
    sent: "Request sent",
    couldntMove: (when: string) => `We couldn't move it to ${when}.`,
    refunding: (amount: string, card: string) =>
      `We're refunding ${amount} to your ${card}.`,
    sorry: "We're sorry, we had to cancel this clean.",
    notCharged: "You haven't been charged anything for it.",
    couldntGetIn: "We couldn't get in",
    teamCame: (when: string, reason: string) =>
      `Our team came at ${when}, but couldn't get in: "${reason}".`,
    beforeNext: (carriesOn: string) =>
      `${carriesOn} Before your next clean, please `,
    beforeBooking: "Before booking again, please ",
    checkGetIn: "check how we get in",
    answerNotSaved: "Your answer wasn't saved. Please try again.",
    approved: "Approved",
    declined: "Declined",
    review: "Review",
    pleaseApprove: "Please approve a price change",
    didMore: "Our team did more than was quoted:",
    comesTo: "It comes to",
    onlyIfApprove: (day: string) =>
      `, tax included, and you only pay it if you approve it. If we don't hear from you by ${day}, you won't pay it.`,
    approve: (amount: string) => `Approve ${amount}`,
    pleaseApproveDot: "Please approve a price change.",
    answerBy: (day: string) => `Please answer by ${day}.`,
    // what each kind of charge is called; a deposit is the screens' `deposit`
    charge: { balance: "Paid", fee: "Fee" },
    receipt: "Your receipt",
    doneAt: (when: string) => `Done ${when}.`,
    quoted: "Quoted price",
    depositKept: " (your deposit, kept)",
    refunded: (amount: string) => `, ${amount} refunded`,
    paid: "Paid",
    onWeekly: "On your weekly bills",
    notChargedFor: "Not charged:",
    youDeclined: "you declined it",
    notInTime: "not answered in time",
    chargedTo: (card: string) => `Charged to your ${card}.`,
    restOnBill: (amount: string) =>
      `The rest, ${amount}, goes on your weekly bill.`,
  },
  es: {
    details: "Detalles de la limpieza",
    partOfPlan: "Parte de su plan de limpieza",
    oneOff: "Una sola limpieza",
    price: "Precio",
    withDiscount: (percent: number) =>
      `Precio con su ${percent}% de descuento del plan, impuestos incluidos`,
    taxIncluded: "Precio, impuestos incluidos",
    heldThere: "Su depósito está retenido allí",
    offPrice: "Depósito, se descuenta del precio",
    reminder: "Le enviaremos un recordatorio por correo el día antes.",
    notSkipped: "No se saltó su limpieza. Vuelva a intentarlo.",
    notCancelled: "No se canceló su limpieza. Vuelva a intentarlo.",
    feeOnPlan: (where: string) => `El cargo ${where}.`,
    chargedToCard: "se cobra a su tarjeta",
    refundDeposit: (amount: string) =>
      `Le devolveremos su depósito de ${amount}.`,
    skipped: "Se saltó su limpieza",
    cancelled: "Se canceló su limpieza",
    skipThis: "Saltar esta limpieza",
    cancelClean: "Cancelar limpieza",
    skipQ: "¿Saltar esta limpieza?",
    cancelQ: "¿Cancelar su limpieza?",
    serviceAt: (service: string, address: string, when: string) =>
      oneStop(`${service} en ${address}, ${when}.`),
    keep: "Mantener mi limpieza",
    onlyThis: "Solo se salta esta limpieza. Su plan de limpieza continúa.",
    notWithdrawn: "No se retiró su solicitud. Vuelva a intentarlo.",
    withdrawn: "Solicitud retirada",
    withdraw: "Retirar solicitud",
    askedTo: "Pidió reprogramarla para el",
    held: (when: string) =>
      oneStop(
        ` Le guardamos esa hora mientras la confirmamos. Hasta entonces, su limpieza sigue reservada para el ${when}.`,
      ),
    sent: "Solicitud enviada",
    couldntMove: (when: string) =>
      oneStop(`No pudimos reprogramarla para el ${when}.`),
    refunding: (amount: string, card: string) =>
      `Le estamos devolviendo ${amount} a su ${card}.`,
    sorry: "Lo sentimos, tuvimos que cancelar esta limpieza.",
    notCharged: "No se le cobró nada por ella.",
    couldntGetIn: "No se pudo entrar",
    teamCame: (when: string, reason: string) =>
      `Nuestro equipo llegó el ${when}, pero no pudo entrar: "${reason}".`,
    beforeNext: (carriesOn: string) =>
      `${carriesOn} Antes de su próxima limpieza, por favor `,
    beforeBooking: "Antes de reservar de nuevo, por favor ",
    checkGetIn: "revise cómo entramos",
    answerNotSaved: "No se guardó su respuesta. Vuelva a intentarlo.",
    approved: "Aprobado",
    declined: "Rechazado",
    review: "Revisar",
    pleaseApprove: "Apruebe un cambio de precio",
    didMore: "Nuestro equipo hizo más de lo cotizado:",
    comesTo: "Son",
    onlyIfApprove: (day: string) =>
      `, impuestos incluidos, y solo lo paga si lo aprueba. Si no sabemos de usted antes del ${day}, no lo pagará.`,
    approve: (amount: string) => `Aprobar ${amount}`,
    pleaseApproveDot: "Apruebe un cambio de precio.",
    answerBy: (day: string) => `Responda antes del ${day}.`,
    charge: { balance: "Pagado", fee: "Cargo" },
    receipt: "Su recibo",
    doneAt: (when: string) => oneStop(`Terminada el ${when}.`),
    quoted: "Precio cotizado",
    depositKept: " (su depósito, retenido)",
    refunded: (amount: string) => `, ${amount} devueltos`,
    paid: "Pagado",
    onWeekly: "En sus facturas semanales",
    notChargedFor: "No cobrado:",
    youDeclined: "lo rechazó",
    notInTime: "no se respondió a tiempo",
    chargedTo: (card: string) => `Cobrado a su ${card}.`,
    restOnBill: (amount: string) =>
      `El resto, ${amount}, va en su factura semanal.`,
  },
});

// one of the Client's Jobs, a Record (docs/ux.md), from the links in
// their emails: while it's to come, moving or cancelling it; once
// Completed, its receipt; any price change (an Adjustment) proposed to them
// to approve or decline; if it couldn't be charged, the way to pay; and if
// it was Cancelled (Skipped, on a plan) or No Access, what it cost
export function PortalJob() {
  const t = useSaid(words);
  const job = useLoaderData({ from: "/portal/jobs/$jobId" });
  const { completion } = job;
  const booked = !completion && !job.cancellation && !job.noAccess;
  const onPlan = job.servicePlanId !== null;
  const moving = useMoving(job);

  return (
    <RecordPage
      trail={[
        { label: t.p.yourCleans, href: linkTo({ to: "/portal/cleans" }) },
        { label: t.formatDateTime(job.startsAt) },
      ]}
      title={job.serviceName}
      status={
        completion?.payment.unpaid ? (
          <StatusBadge tone="danger">{t.unpaid}</StatusBadge>
        ) : completion ? (
          <StatusBadge tone="success">{t.jobStatusLabel.completed}</StatusBadge>
        ) : job.cancellation ? (
          <StatusBadge>{t.cancelledLabel(wasSkipped(job))}</StatusBadge>
        ) : job.noAccess ? (
          <JobStatusBadge status="no_access" />
        ) : (
          <JobStatusBadge status="booked" />
        )
      }
      actions={
        booked
          ? [
              job.rescheduleTerms &&
                job.rescheduleRequest?.status !== "pending" && {
                  label: t.pickNewTime,
                  icon: CalendarClock,
                  dialog: (state) => (
                    <ChooseNewTime
                      job={job}
                      terms={job.rescheduleTerms!}
                      base={`/api/jobs/mine/${job.id}`}
                      describeCost={(cost, feeCents) =>
                        costForClient(t.lang, cost, feeCents, job)
                      }
                      done={t.w.sent}
                      Picker={PickAvailableTime}
                      inline
                      {...state}
                    />
                  ),
                },
              job.cancelTerms && {
                label: onPlan ? t.w.skipThis : t.w.cancelClean,
                icon: CalendarX,
                danger: true,
                dialog: (state) => (
                  <Cancel job={job} terms={job.cancelTerms!} {...state} />
                ),
              },
            ]
          : // after a clean that didn't happen: a plan carries on;
            // otherwise, book again
            completion
            ? []
            : [
                onPlan
                  ? {
                      label: t.p.seeYourCleaningPlan,
                      icon: CalendarSync,
                      href: linkTo({
                        to: "/portal/plans/$planId",
                        params: { planId: job.servicePlanId! },
                      }),
                    }
                  : {
                      label: t.REQUEST_A_QUOTE,
                      icon: ClipboardPenLine,
                      href: requestQuoteHref,
                    },
              ]
      }
      // what's needed of them first, before what the clean is
      alerts={[
        job.payment.unpaid && unpaid(t, job.payment),
        ...(completion?.adjustments ?? [])
          .filter((a) => a.status === "proposed")
          .map((a): Alert => ({
            key: a.id,
            tone: "warning",
            action: <Review job={job} adjustment={a} />,
            children: (
              <p>
                <strong>{t.w.pleaseApproveDot}</strong> {t.adjustmentLabel(a)},{" "}
                {t.formatMoney(a.totalCents)}.{" "}
                {t.w.answerBy(t.formatDate(a.lapsesAt!))}
              </p>
            ),
          })),
        booked && moving,
      ]}
      details={<JobDetails job={job} />}
    >
      {job.cancellation ? (
        <Cancelled job={job} />
      ) : job.noAccess ? (
        <NoAccess job={job} />
      ) : (
        completion && <Receipt job={job} />
      )}
    </RecordPage>
  );
}

// The clean as its Client reads it, as their plan's page does: when, large,
// then its facts. (UX pass, #96)
function JobDetails({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const { payment } = job;
  const deposit = payment.charges.find((c) => c.kind === "deposit");
  const booked = !job.completion && !job.cancellation && !job.noAccess;
  return (
    <DetailsCard
      label={t.w.details}
      tile={<IconTile icon={CalendarClock} size="lg" />}
      kicker={job.servicePlanId ? t.w.partOfPlan : t.w.oneOff}
      title={t.formatDateTime(job.startsAt)}
      line={addressOf(job.property)}
    >
      <Facts>
        <Fact
          icon={ReceiptIcon}
          label={t.w.price}
          value={t.formatMoney(payment.totalCents)}
          line={
            job.planDiscountPercent
              ? t.w.withDiscount(job.planDiscountPercent)
              : t.w.taxIncluded
          }
        />
        <Fact
          icon={Clock}
          label={t.onSite}
          value={t.about(formatHours(job.hoursOnSite))}
          line={t.onSiteWith(t.cleaners(job.crewSize))}
        />
        <Fact
          icon={CirclePlus}
          label={t.extras}
          value={job.addOns.length > 0 ? job.addOns.join(", ") : t.none}
        />
        {job.servicePlanId ? (
          <Fact
            icon={CalendarSync}
            label={t.p.cleaningPlan}
            value={
              <Link
                href={linkTo({
                  to: "/portal/plans/$planId",
                  params: { planId: job.servicePlanId },
                })}
              >
                {t.p.seeYourPlan}
              </Link>
            }
            line={t.w.heldThere}
          />
        ) : (
          <Fact
            icon={PiggyBank}
            label={t.deposit}
            value={deposit ? t.formatMoney(deposit.amountCents) : t.none}
            line={deposit ? t.w.offPrice : t.deposit}
          />
        )}
      </Facts>
      {booked && <p className="text-sm text-fg-muted">{t.w.reminder}</p>}
    </DetailsCard>
  );
}

// What happened to it, a part of the page: its title, what it says
function PartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Section title={title} description={description}>
      <Card>{children}</Card>
    </Section>
  );
}

// The Client cancels a clean still to come, seeing first what it costs: free
// until 24 hours before, then a Late Cancellation that keeps the Deposit. A
// plan Job is skipped instead, and the plan carries on; its late fee is the
// plan's Deposit amount, charged or on its week's Bill (ADR-0016), as the
// plan's own Deposit stays held.
function Cancel({
  job,
  terms,
  ...state
}: {
  job: ClientJobDetail;
  terms: CancellationTerms;
} & DialogState) {
  const t = useSaid(words);
  const onPlan = job.servicePlanId !== null;
  // what it costs may have changed since the page loaded
  const action = useAction(onPlan ? t.w.notSkipped : t.w.notCancelled, {
    reloadOnFailure: true,
  });
  const cost = [
    t.cancelCostForClient({
      onPlan,
      late: terms.late,
      feeCents: terms.feeCents,
      fee: t.formatMoney(terms.feeCents),
    }),
    onPlan &&
      terms.feeCents > 0 &&
      t.w.feeOnPlan(job.weeklyBill ? t.ON_WEEKS_BILL : t.w.chargedToCard),
    !onPlan &&
      terms.refundCents > 0 &&
      t.w.refundDeposit(t.formatMoney(terms.refundCents)),
  ]
    .filter(Boolean)
    .join(" ");

  const cancel = async (close: () => void) => {
    const ok = await action.run(
      () =>
        postJson(`/api/jobs/mine/${job.id}/cancel`, {
          feeCents: terms.feeCents,
        }),
      onPlan ? t.w.skipped : t.w.cancelled,
    );
    if (ok) close();
  };

  return (
    <Dialog
      title={onPlan ? t.w.skipQ : t.w.cancelQ}
      role="alertdialog"
      {...state}
    >
      {({ close }) => (
        <>
          <p>
            {t.w.serviceAt(
              job.serviceName,
              addressOf(job.property),
              t.formatDateTime(job.startsAt),
            )}
          </p>
          <p>
            <strong>{cost}</strong>
          </p>
          {onPlan && <p>{t.w.onlyThis}</p>}
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {t.w.keep}
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={() => void cancel(close)}
            >
              {onPlan ? t.w.skipThis : t.w.cancelClean}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

// A move the Client asked for (ADR-0010), as an alert: while it's pending,
// what's held and the way to withdraw it; turned down, why. Asking is the
// page's "Pick a new time"
function useMoving(job: ClientJobDetail): Alert | null {
  const t = useSaid(words);
  const action = useAction(t.w.notWithdrawn, { toast: true });
  const request = job.rescheduleRequest;
  if (request?.status === "pending") {
    const asked = t.formatDateTime(request.startsAt);
    return {
      key: "moving",
      action: (
        <Button
          variant="text"
          isPending={action.isPending}
          onPress={() =>
            void action.run(
              () =>
                postJson(
                  `/api/jobs/mine/${job.id}/reschedule-request/withdraw`,
                ),
              t.w.withdrawn,
            )
          }
        >
          {t.w.withdraw}
        </Button>
      ),
      children: (
        <>
          <p>
            {t.w.askedTo} <strong>{asked}</strong>
            {stopAfter(asked)}
            {t.w.held(t.formatDateTime(job.startsAt))}
          </p>
          <p>{costForClient(t.lang, request.cost, request.feeCents, job)}</p>
        </>
      ),
    };
  }
  if (request?.status === "turned_down") {
    return {
      key: "moving",
      children: `${t.w.couldntMove(t.formatDateTime(request.startsAt))}${request.reason ? ` ${request.reason}` : ""}`,
    };
  }
  return null;
}

// what's been refunded so far, and what's still on its way
function Refund({ payment }: { payment: JobPayment }) {
  const t = useSaid(words);
  const refunded = payment.charges.reduce((sum, c) => sum + c.refundedCents, 0);
  const card = payment.paymentMethod ?? t.p.card;
  return (
    <>
      {refunded > 0 && <p>{t.refundedTo(t.formatMoney(refunded), card)}</p>}
      {payment.owedCents < 0 && (
        <p>{t.w.refunding(t.formatMoney(-payment.owedCents), card)}</p>
      )}
    </>
  );
}

function Cancelled({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const cancellation = job.cancellation!;
  const skipped = wasSkipped(job);
  return (
    <PartCard
      title={t.cancelledLabel(skipped)}
      description={oneStop(
        `${t.cancelledLabel(skipped)} ${t.formatDateTime(cancellation.cancelledAt)}.`,
      )}
    >
      {cancellation.by === "empire" ? (
        <p>
          {t.w.sorry}
          {cancellation.reason && ` ${cancellation.reason}`} {t.w.notCharged}
        </p>
      ) : cancellation.withPlan ? (
        <p>
          {t.cancelledWithPlanForClient(cancellation.withPlan, {
            feeCents: cancellation.feeCents,
            fee: t.formatMoney(cancellation.feeCents),
          })}
        </p>
      ) : (
        <p>
          {t.cancelCostForClient({
            onPlan: skipped,
            late: cancellation.late,
            feeCents: cancellation.feeCents,
            fee: t.formatMoney(cancellation.feeCents),
          })}
        </p>
      )}
      {skipped && <p>{t.PLAN_CARRIES_ON}</p>}
      <Refund payment={cancellation.payment} />
    </PartCard>
  );
}

function NoAccess({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const noAccess = job.noAccess!;
  return (
    <PartCard title={t.w.couldntGetIn}>
      <p>
        {t.w.teamCame(t.formatDateTime(noAccess.recordedAt), noAccess.reason)}
      </p>
      {noAccess.feeCents > 0 && (
        <p>
          {t.noAccessFee({
            onPlan: job.servicePlanId !== null,
            fee: t.formatMoney(noAccess.feeCents),
          })}
        </p>
      )}
      <Refund payment={noAccess.payment} />
      <p>
        {job.servicePlanId
          ? t.w.beforeNext(t.PLAN_CARRIES_ON)
          : t.w.beforeBooking}
        <Link
          href={linkTo({
            to: "/portal/properties/$propertyId",
            params: { propertyId: job.property.id },
          })}
        >
          {t.w.checkGetIn}
        </Link>
        .
      </p>
    </PartCard>
  );
}

// A charge that failed: what it was, and the way to fix it. Saving a card
// tries it again. Red, as it's already late. (UX pass, #96)
const unpaid = (
  t: Said & { w: (typeof words)["en"] },
  payment: JobPayment,
): Alert => {
  const { kind, why } = payment.unpaid!;
  return {
    key: "unpaid",
    tone: "danger",
    action: kind !== "waiting" && (
      <ButtonLink
        variant="danger-text"
        href={linkTo({ to: "/portal/payment-method" })}
      >
        {t.UPDATE_CARD}
      </ButtonLink>
    ),
    children: (
      <p>
        <strong>{t.p.paymentNeeded}</strong>{" "}
        {t.notTaken(
          t.formatMoney(payment.owedCents),
          kind === "no_card" ? null : (payment.paymentMethod ?? t.p.card),
          why,
        )}{" "}
        {t.clientFix[kind]}
      </p>
    ),
  };
};

// A price change (an Adjustment) the Office has proposed, which they only
// pay if they approve: a yellow alert to answer it, this its one action
// opening the answer. (UX pass, #96)
function Review({
  job,
  adjustment,
}: {
  job: ClientJobDetail;
  adjustment: AdjustmentView;
}) {
  const t = useSaid(words);
  const action = useAction(t.w.answerNotSaved);
  const path = `/api/jobs/mine/${job.id}/adjustments/${adjustment.id}`;
  const answer = async (to: "approve" | "decline", close: () => void) => {
    const ok = await action.run(
      () => postJson(`${path}/${to}`),
      to === "approve" ? t.w.approved : t.w.declined,
      to,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">{t.w.review}</Button>
      <Dialog title={t.w.pleaseApprove}>
        {({ close }) => (
          <>
            <p>
              {t.w.didMore} <strong>{t.adjustmentLabel(adjustment)}</strong> ("
              {adjustment.reason}").
              {adjustment.officeReason && ` ${adjustment.officeReason}.`}
            </p>
            <p>
              {t.w.comesTo}{" "}
              <strong>{t.formatMoney(adjustment.totalCents)}</strong>
              {t.w.onlyIfApprove(t.formatDate(adjustment.lapsesAt!))}
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button
                variant="quiet"
                isPending={action.pending === "decline"}
                onPress={() => void answer("decline", close)}
              >
                {t.p.decline}
              </Button>
              <Button
                isPending={action.pending === "approve"}
                onPress={() => void answer("approve", close)}
              >
                {t.w.approve(t.formatMoney(adjustment.totalCents))}
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

function Receipt({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const { payment, adjustments, completedAt } = job.completion!;
  const counted = adjustments.filter(
    (a) => a.status === "applied" || a.status === "approved",
  );
  const notCharged = adjustments.filter(
    (a) => a.status === "declined" || a.status === "lapsed",
  );

  return (
    <PartCard
      title={t.w.receipt}
      description={`${t.w.doneAt(t.formatDateTime(completedAt))} ${t.PRICES_INCLUDE_TAX}`}
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
        <dt>{t.w.quoted}</dt>
        <dd className="text-end">{t.formatMoney(payment.quotedCents)}</dd>
        {counted.map((a) => (
          <div key={a.id} className="contents">
            <dt>{t.adjustmentLabel(a)}</dt>
            <dd className="text-end">{t.formatMoney(a.totalCents)}</dd>
          </div>
        ))}
        <dt className="font-semibold">{t.total}</dt>
        <dd className="text-end font-semibold">
          {t.formatMoney(payment.totalCents)}
        </dd>
        {payment.rescheduleFeeCents > 0 && (
          <>
            <dt>
              {t.LATE_MOVE_FEE}
              {!job.servicePlanId && t.w.depositKept}
            </dt>
            <dd className="text-end">
              {t.formatMoney(payment.rescheduleFeeCents)}
            </dd>
          </>
        )}
        {payment.charges.map((c, i) => (
          <div key={i} className="contents">
            <dt>
              {{ deposit: t.deposit, ...t.w.charge }[c.kind]}{" "}
              {t.formatDate(c.chargedAt)}
              {c.refundedCents > 0 &&
                t.w.refunded(t.formatMoney(c.refundedCents))}
            </dt>
            <dd className="text-end">
              {t.formatMoney(c.amountCents - c.refundedCents)}
            </dd>
          </div>
        ))}
        <dt className="font-semibold">{t.w.paid}</dt>
        <dd className="text-end font-semibold">
          {t.formatMoney(payment.paidCents)}
        </dd>
        {payment.billedCents !== 0 && (
          <>
            <dt className="font-semibold">{t.w.onWeekly}</dt>
            <dd className="text-end font-semibold">
              {t.formatMoney(payment.billedCents)}
            </dd>
          </>
        )}
      </dl>
      {notCharged.length > 0 && (
        <p className="text-sm text-fg-muted">
          {t.w.notChargedFor}{" "}
          {notCharged
            .map(
              (a) =>
                `${t.adjustmentLabel(a)} (${a.status === "declined" ? t.w.youDeclined : t.w.notInTime})`,
            )
            .join("; ")}
          .
        </p>
      )}
      {payment.paymentMethod && payment.charges.length > 0 && (
        <p className="text-sm text-fg-muted">
          {t.w.chargedTo(payment.paymentMethod)}
        </p>
      )}
      {job.weeklyBill && payment.owedCents > 0 && (
        <p className="text-sm text-fg-muted">
          {t.w.restOnBill(t.formatMoney(payment.owedCents))}
        </p>
      )}
    </PartCard>
  );
}

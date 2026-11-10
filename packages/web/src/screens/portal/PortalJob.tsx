import { useId, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarSync,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt as ReceiptIcon,
} from "lucide-react";
import type {
  AdjustmentView,
  CancellationTerms,
  ClientJobDetail,
  JobPayment,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  Link,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { linkTo } from "../../links.ts";
import { requestQuoteHref } from "./whats-next.ts";
import { PickAvailableTime } from "../AvailabilityPicker.tsx";
import { ChooseNewTime, costForClient } from "../RescheduleParts.tsx";
import { addressOf, formatHours, wasSkipped } from "../format.ts";
import { useSaid } from "../words.ts";
import { Fact } from "../Fact.tsx";
import { catalog, oneStop } from "@empire-cleaning/models";
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
    onSite: "On site",
    about: (hours: string) => `About ${hours}`,
    onSiteWith: (cleaners: string) => `On site, ${cleaners}`,
    extras: "Extras",
    none: "None",
    plan: "Cleaning plan",
    heldThere: "Its deposit is held there",
    deposit: "Deposit",
    offPrice: "Deposit, comes off the price",
    reminder: "We'll email a reminder the day before.",
    notSkipped: "Your clean wasn't skipped. Please try again.",
    notCancelled: "Your clean wasn't cancelled. Please try again.",
    feeOnPlan: (where: string) => `The fee ${where}.`,
    chargedToCard: "is charged to your card",
    refundDeposit: (amount: string) => `We'll refund your ${amount} deposit.`,
    skipped: "Your clean is skipped",
    cancelled: "Your clean is cancelled",
    needSkip: "Need to skip this clean?",
    needCancel: "Need to cancel?",
    skipThis: "Skip this clean",
    cancelClean: "Cancel clean",
    skipQ: "Skip this clean?",
    cancelQ: "Cancel your clean?",
    serviceAt: (service: string, address: string, when: string) =>
      `${service} at ${address}, ${when}.`,
    keep: "Keep my clean",
    skipFreeUntil: "You can skip it for free until",
    skipAfter:
      ". After that, it's a late cancellation, with a fee the same as your plan's deposit.",
    cancelFreeUntil: "You can cancel for free until",
    andRefund: (amount: string) => `, and we'll refund your ${amount} deposit`,
    cancelAfter:
      ". After that, it's a late cancellation, and your deposit is kept as the fee.",
    onlyThis: "Only this clean is skipped. Your cleaning plan carries on.",
    notWithdrawn: "Your request wasn't withdrawn. Please try again.",
    moving: "Moving your clean",
    withdrawn: "Request withdrawn",
    withdraw: "Withdraw request",
    askedTo: "You've asked to move it to",
    held: (when: string) =>
      `. That time is held for you while we confirm it. Until then, your clean stays booked for ${when}.`,
    sent: "Request sent",
    couldntMove: (when: string) => `We couldn't move it to ${when}.`,
    moveFreeUntil: "You can move it for free until",
    moveAfter:
      ". After that, it's a late move, and only one per clean is free.",
    refunding: (amount: string, card: string) =>
      `We're refunding ${amount} to your ${card}.`,
    card: "card",
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
    decline: "Decline",
    approve: (amount: string) => `Approve ${amount}`,
    pleaseApproveDot: "Please approve a price change.",
    answerBy: (day: string) => `Please answer by ${day}.`,
    charge: { deposit: "Deposit", balance: "Paid", fee: "Fee" },
    receipt: "Your receipt",
    doneAt: (when: string) => `Done ${when}.`,
    quoted: "Quoted price",
    total: "Total",
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
    onSite: "En el lugar",
    about: (hours: string) => `Unas ${hours}`,
    onSiteWith: (cleaners: string) => `En el lugar, ${cleaners}`,
    extras: "Adicionales",
    none: "Ninguno",
    plan: "Plan de limpieza",
    heldThere: "Su depósito está retenido allí",
    deposit: "Depósito",
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
    needSkip: "¿Necesita saltar esta limpieza?",
    needCancel: "¿Necesita cancelar?",
    skipThis: "Saltar esta limpieza",
    cancelClean: "Cancelar limpieza",
    skipQ: "¿Saltar esta limpieza?",
    cancelQ: "¿Cancelar su limpieza?",
    serviceAt: (service: string, address: string, when: string) =>
      `${service} en ${address}, ${when}.`,
    keep: "Mantener mi limpieza",
    skipFreeUntil: "Puede saltarla sin cargo hasta el",
    skipAfter:
      ". Después, es una cancelación tardía, con un cargo igual al depósito de su plan.",
    cancelFreeUntil: "Puede cancelarla sin cargo hasta el",
    andRefund: (amount: string) =>
      `, y le devolveremos su depósito de ${amount}`,
    cancelAfter:
      ". Después, es una cancelación tardía, y nos quedamos con su depósito como cargo.",
    onlyThis: "Solo se salta esta limpieza. Su plan de limpieza continúa.",
    notWithdrawn: "No se retiró su solicitud. Vuelva a intentarlo.",
    moving: "Reprogramar su limpieza",
    withdrawn: "Solicitud retirada",
    withdraw: "Retirar solicitud",
    askedTo: "Pidió reprogramarla para el",
    held: (when: string) =>
      `. Le guardamos esa hora mientras la confirmamos. Hasta entonces, su limpieza sigue reservada para el ${when}.`,
    sent: "Solicitud enviada",
    couldntMove: (when: string) => `No pudimos reprogramarla para el ${when}.`,
    moveFreeUntil: "Puede reprogramarla sin cargo hasta el",
    moveAfter:
      ". Después, es una reprogramación tardía, y solo una por limpieza es gratis.",
    refunding: (amount: string, card: string) =>
      `Le estamos devolviendo ${amount} a su ${card}.`,
    card: "tarjeta",
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
    decline: "Rechazar",
    approve: (amount: string) => `Aprobar ${amount}`,
    pleaseApproveDot: "Apruebe un cambio de precio.",
    answerBy: (day: string) => `Responda antes del ${day}.`,
    charge: { deposit: "Depósito", balance: "Pagado", fee: "Cargo" },
    receipt: "Su recibo",
    doneAt: (when: string) => `Terminada el ${when}.`,
    quoted: "Precio cotizado",
    total: "Total",
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

// one of the Client's Jobs, from the links in their emails: while it's to come,
// moving or cancelling it; once Completed, its receipt; any price change (an
// Adjustment) proposed to them to approve or decline; if it couldn't be charged, the way to pay; and if
// it was Cancelled (Skipped, on a plan) or No Access, what it cost
export function PortalJob() {
  const t = useSaid(words);
  const job = useLoaderData({ from: "/portal/jobs/$jobId" });
  const { completion } = job;
  const booked = !completion && !job.cancellation && !job.noAccess;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: t.p.yourCleans, href: linkTo({ to: "/portal/cleans" }) },
            { label: t.formatDateTime(job.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{job.serviceName}</Heading>
          {completion?.payment.unpaid ? (
            <StatusBadge tone="danger">{t.unpaid}</StatusBadge>
          ) : completion ? (
            <StatusBadge tone="success">
              {t.jobStatusLabel.completed}
            </StatusBadge>
          ) : job.cancellation ? (
            <StatusBadge>{t.cancelledLabel(wasSkipped(job))}</StatusBadge>
          ) : job.noAccess ? (
            <JobStatusBadge status="no_access" />
          ) : (
            <JobStatusBadge status="booked" />
          )}
        </div>
        <p className="text-fg-muted">{addressOf(job.property)}</p>
      </div>

      {/* what's needed of them first, before what the clean is */}
      {job.payment.unpaid && <Unpaid payment={job.payment} />}
      {completion?.adjustments
        .filter((a) => a.status === "proposed")
        .map((a) => (
          <Proposal key={a.id} job={job} adjustment={a} />
        ))}

      <Section title={t.w.details}>
        <Card className="gap-0">
          <Part>
            <JobDetails job={job} />
          </Part>
          {job.cancellation ? (
            <>
              <Cancelled job={job} />
            </>
          ) : job.noAccess ? (
            <>
              <NoAccess job={job} />
            </>
          ) : completion ? (
            <>
              <Receipt job={job} />
            </>
          ) : null}
        </Card>
      </Section>

      {booked && (
        <>
          <Reschedule job={job} />
          {job.cancelTerms && <Cancel job={job} terms={job.cancelTerms} />}
        </>
      )}
    </div>
  );
}

// The clean as its Client reads it, as their plan's page does: when, large,
// then its facts in even columns across, each an icon, a value and what the
// value is. (UX pass, #96)
function JobDetails({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const { payment } = job;
  const deposit = payment.charges.find((c) => c.kind === "deposit");
  const booked = !job.completion && !job.cancellation && !job.noAccess;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-fg-muted">
            {job.servicePlanId ? t.w.partOfPlan : t.w.oneOff}
          </p>
          <p className="text-xl font-semibold text-fg">
            {t.formatDateTime(job.startsAt)}
          </p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label={t.w.onSite}
          value={t.w.about(formatHours(job.hoursOnSite))}
          line={t.w.onSiteWith(t.cleaners(job.crewSize))}
        />
        <Fact
          icon={CirclePlus}
          label={t.w.extras}
          value={job.addOns.length > 0 ? job.addOns.join(", ") : t.w.none}
        />
        {job.servicePlanId ? (
          <Fact
            icon={CalendarSync}
            label={t.w.plan}
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
            label={t.w.deposit}
            value={deposit ? t.formatMoney(deposit.amountCents) : t.w.none}
            line={deposit ? t.w.offPrice : t.w.deposit}
          />
        )}
      </dl>
      {booked && <p className="text-sm text-fg-muted">{t.w.reminder}</p>}
    </div>
  );
}

// One part of the clean's card, under a rule from the one before: its
// title, what it says, and the Button(s) it leads to, kept right
function Part({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const head = title && (
    <div className="flex flex-col gap-1">
      <Heading level={3} size={4} id={headingId} className="text-fg">
        {title}
      </Heading>
      {description && <p className="text-sm text-fg-muted">{description}</p>}
    </div>
  );
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className="flex flex-col gap-3 border-border py-5 first:pt-0 last:pb-0 not-first:border-t"
    >
      {actions ? (
        <ActionRow actions={actions}>
          {head}
          {children}
        </ActionRow>
      ) : (
        <>
          {head}
          {children}
        </>
      )}
    </section>
  );
}

// An action of its own under the clean's details, as on the plan's page: its
// title outside the card, the card's text and its Button on one row
function ActionCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title}>
      <Card>
        <ActionRow actions={actions}>{children}</ActionRow>
      </Card>
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
}: {
  job: ClientJobDetail;
  terms: CancellationTerms;
}) {
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
    <ActionCard
      title={onPlan ? t.w.needSkip : t.w.needCancel}
      actions={
        <DialogTrigger>
          <Button variant="secondary">
            {onPlan ? t.w.skipThis : t.w.cancelClean}
          </Button>
          <Dialog title={onPlan ? t.w.skipQ : t.w.cancelQ} role="alertdialog">
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
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
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
        </DialogTrigger>
      }
    >
      {terms.late || terms.feeCents > 0 ? (
        <p>{cost}</p>
      ) : onPlan ? (
        <p>
          {t.w.skipFreeUntil}{" "}
          <strong>{t.formatDateTime(terms.freeUntil)}</strong>
          {t.w.skipAfter}
        </p>
      ) : (
        <p>
          {t.w.cancelFreeUntil}{" "}
          <strong>{t.formatDateTime(terms.freeUntil)}</strong>
          {terms.refundCents > 0 &&
            t.w.andRefund(t.formatMoney(terms.refundCents))}
          {t.w.cancelAfter}
        </p>
      )}
      {onPlan && <p>{t.w.onlyThis}</p>}
    </ActionCard>
  );
}

// The Client asks to move a clean still to come, seeing first what it costs
// (ADR-0010); while the request is pending, they can withdraw it
function Reschedule({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const action = useAction(t.w.notWithdrawn);
  const request = job.rescheduleRequest;

  if (request?.status === "pending") {
    return (
      <ActionCard
        title={t.w.moving}
        actions={
          <Button
            variant="secondary"
            isPending={action.pending === "withdraw"}
            onPress={() =>
              void action.run(
                () =>
                  postJson(
                    `/api/jobs/mine/${job.id}/reschedule-request/withdraw`,
                  ),
                t.w.withdrawn,
                "withdraw",
              )
            }
          >
            {t.w.withdraw}
          </Button>
        }
      >
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <p>
          {t.w.askedTo} <strong>{t.formatDateTime(request.startsAt)}</strong>
          {t.w.held(t.formatDateTime(job.startsAt))}
        </p>
        <p>{costForClient(t.lang, request.cost, request.feeCents, job)}</p>
      </ActionCard>
    );
  }

  const terms = job.rescheduleTerms;
  if (!terms) return null;
  return (
    <ActionCard
      title={t.p.anotherTime}
      actions={
        <ChooseNewTime
          job={job}
          terms={terms}
          base={`/api/jobs/mine/${job.id}`}
          label={t.pickNewTime}
          describeCost={(cost, feeCents) =>
            costForClient(t.lang, cost, feeCents, job)
          }
          done={t.w.sent}
          Picker={PickAvailableTime}
          inline
        />
      }
    >
      {request?.status === "turned_down" && (
        <Notice>
          {t.w.couldntMove(t.formatDateTime(request.startsAt))}
          {request.reason && ` ${request.reason}`}
        </Notice>
      )}
      {terms.cost === "free" ? (
        <p>
          {t.w.moveFreeUntil}{" "}
          <strong>{t.formatDateTime(terms.freeUntil)}</strong>
          {t.w.moveAfter}
        </p>
      ) : (
        <p>{costForClient(t.lang, terms.cost, terms.feeCents, job)}</p>
      )}
    </ActionCard>
  );
}

// what's been refunded so far, and what's still on its way
function Refund({ payment }: { payment: JobPayment }) {
  const t = useSaid(words);
  const refunded = payment.charges.reduce((sum, c) => sum + c.refundedCents, 0);
  const card = payment.paymentMethod ?? t.w.card;
  return (
    <>
      {refunded > 0 && <p>{t.refundedTo(t.formatMoney(refunded), card)}</p>}
      {payment.owedCents < 0 && (
        <p>{t.w.refunding(t.formatMoney(-payment.owedCents), card)}</p>
      )}
    </>
  );
}

// after a clean that didn't happen: a plan carries on; otherwise, book again
function WhatNext({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  return job.servicePlanId ? (
    <ButtonLink
      href={linkTo({
        to: "/portal/plans/$planId",
        params: { planId: job.servicePlanId },
      })}
    >
      {t.p.seeYourCleaningPlan}
    </ButtonLink>
  ) : (
    <ButtonLink href={requestQuoteHref}>{t.REQUEST_A_QUOTE}</ButtonLink>
  );
}

function Cancelled({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const cancellation = job.cancellation!;
  const skipped = wasSkipped(job);
  return (
    <Part
      title={t.cancelledLabel(skipped)}
      description={oneStop(
        `${t.cancelledLabel(skipped)} ${t.formatDateTime(cancellation.cancelledAt)}.`,
      )}
      actions={<WhatNext job={job} />}
    >
      {cancellation.by === "empire" ? (
        <p>
          {t.w.sorry}
          {cancellation.reason && ` ${cancellation.reason}`} {t.w.notCharged}
        </p>
      ) : cancellation.withPlan ? (
        <p>
          {t.cancelledWithPlanForClient(cancellation.reason!, {
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
    </Part>
  );
}

function NoAccess({ job }: { job: ClientJobDetail }) {
  const t = useSaid(words);
  const noAccess = job.noAccess!;
  return (
    <Part title={t.w.couldntGetIn} actions={<WhatNext job={job} />}>
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
    </Part>
  );
}

// A charge that failed: what it was, and the way to fix it. Saving a card
// tries it again. Red, as it's already late. (UX pass, #96)
function Unpaid({ payment }: { payment: JobPayment }) {
  const t = useSaid(words);
  const { kind, why } = payment.unpaid!;
  return (
    <Notice
      tone="danger"
      action={
        kind !== "waiting" && (
          <ButtonLink
            variant="danger-text"
            href={linkTo({ to: "/portal/payment-method" })}
          >
            {t.UPDATE_CARD}
          </ButtonLink>
        )
      }
    >
      <p>
        <strong>{t.p.paymentNeeded}</strong>{" "}
        {t.notTaken(
          t.formatMoney(payment.owedCents),
          kind === "no_card" ? null : (payment.paymentMethod ?? t.w.card),
          why,
        )}{" "}
        {t.clientFix[kind]}
      </p>
    </Notice>
  );
}

// A price change (an Adjustment) the Office has proposed, which they only pay if they
// approve: a yellow alert to answer it, its one action opening the answer.
// (UX pass, #96)
function Proposal({
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
    <Notice
      tone="warning"
      action={
        <DialogTrigger>
          <Button variant="text">{t.w.review}</Button>
          <Dialog title={t.w.pleaseApprove}>
            {({ close }) => (
              <>
                <p>
                  {t.w.didMore} <strong>{t.adjustmentLabel(adjustment)}</strong>{" "}
                  ("
                  {adjustment.reason}").
                  {adjustment.officeReason && ` ${adjustment.officeReason}.`}
                </p>
                <p>
                  {t.w.comesTo}{" "}
                  <strong>{t.formatMoney(adjustment.totalCents)}</strong>
                  {t.w.onlyIfApprove(t.formatDate(adjustment.lapsesAt!))}
                </p>
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button
                    variant="quiet"
                    isPending={action.pending === "decline"}
                    onPress={() => void answer("decline", close)}
                  >
                    {t.w.decline}
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
      }
    >
      <p>
        <strong>{t.w.pleaseApproveDot}</strong> {t.adjustmentLabel(adjustment)},{" "}
        {t.formatMoney(adjustment.totalCents)}.{" "}
        {t.w.answerBy(t.formatDate(adjustment.lapsesAt!))}
      </p>
    </Notice>
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
    <Part
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
        <dt className="font-semibold">{t.w.total}</dt>
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
              {t.w.charge[c.kind]} {t.formatDate(c.chargedAt)}
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
    </Part>
  );
}

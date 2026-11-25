import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  CircleStop,
  CreditCard,
  FileText,
  ShieldCheck,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt,
} from "lucide-react";
import {
  CANCELLATION_CUTOFF_HOURS,
  type EndPlanTerms,
  type ServicePlanView,
  type UnpaidKind,
  asksTheClient,
  catalog,
  howLong,
  officeFix,
  oneStop,
  quarterHours,
  onItsPage,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  ButtonLink,
  Dialog,
  IconTile,
  Notice,
  StatusBadge,
  Fact,
  DetailsCard,
  Facts,
  Line,
  type Alert,
  type DialogState,
  type PageAction,
  DialogTrigger,
} from "@empire-cleaning/ui";
import { postJson } from "../api.ts";
import { linkTo, sameHref, type AppHref } from "../links.ts";
import { useAction } from "./action.ts";
import { alike, dayOfInstant, formatHours, planDayOn } from "./format.ts";
import { type Said, useSaid } from "./words.ts";

// what the Client reads, in their language (ADR-0025); what only the
// Office reads stays English, where it's said
const words = catalog({
  en: {
    cleanOn: (when: string, amount: string) =>
      `the clean on ${when} (${amount})`,
    billN: (n: string, amount: string) => `bill ${n} (${amount})`,
    couldntTake: "We couldn't take payment for ",
    // a payment their bank wants them to approve, on its page (#534 Q7)
    toApprove: (what: string) =>
      `Your bank wants you to approve the payment for ${what}. None of it has been taken yet.`,
    // the same, once they turned it down at their bank (#534's review F18)
    refused: (what: string) =>
      `The payment for ${what} wasn't approved. None of it was taken.`,
    // a payment we try again ourselves, still on its way
    notYet: (what: string) => `The payment for ${what} is pending.`,
    cancels: (cleans: number, hours: number, when: string) =>
      `It cancels your ${cleans === 1 ? "clean" : `${cleans} cleans`} booked more than ${hours} hours away, free: ${when}.`,
    goesAhead: (when: string, hours: number) =>
      `Your clean on ${when} is less than ${hours} hours away, so it goes ahead.`,
    comesOff: (deposit: string, final: string) =>
      `Your ${deposit} deposit comes off the price of the clean on ${final}.`,
    refunded: (deposit: string) => `Your ${deposit} deposit is refunded.`,
    goesTowards: (deposit: string, final: string) =>
      `Your ${deposit} deposit goes towards the clean on ${final}, and whatever isn't owed is refunded.`,
    noMore:
      "We won't book any more cleans. You're welcome to start a new plan later.",
    notEnded: "The plan wasn't ended. Please try again.",
    hasEnded: "Your cleaning plan has ended",
    endPlan: "End plan",
    endQ: "End your cleaning plan?",
    cantRestart: "An ended plan can't be started again.",
    keep: "Keep my plan",
    eachWeek: "Each week",
    eachClean: "Each clean",
    taxOff: (each: string, percent: number) =>
      `${each}, tax included, ${percent}% off`,
    towardsLast: "Deposit, put towards the last clean",
    offLast: "Deposit, comes off your last clean",
    started: (day: string) => `Started ${day}`,
    endedAt: (day: string) => `ended ${day}`,
  },
  es: {
    cleanOn: (when: string, amount: string) =>
      `la limpieza del ${when} (${amount})`,
    billN: (n: string, amount: string) => `la factura ${n} (${amount})`,
    couldntTake: "No pudimos cobrar ",
    toApprove: (what: string) =>
      `Su banco quiere que apruebe el pago de ${what}. Aún no se ha cobrado nada de este pago.`,
    refused: (what: string) =>
      `El pago de ${what} no se aprobó. No se cobró nada.`,
    notYet: (what: string) => `El pago de ${what} está pendiente.`,
    cancels: (cleans: number, hours: number, when: string) =>
      oneStop(
        `Cancela, sin cargo, ${cleans === 1 ? "su limpieza reservada" : `sus ${cleans} limpiezas reservadas`} a más de ${hours} horas: ${when}.`,
      ),
    goesAhead: (when: string, hours: number) =>
      `Su limpieza del ${when} es en menos de ${hours} horas, así que se hace igual.`,
    comesOff: (deposit: string, final: string) =>
      oneStop(
        `Su depósito de ${deposit} se descuenta del precio de la limpieza del ${final}.`,
      ),
    refunded: (deposit: string) => `Le devolvemos su depósito de ${deposit}.`,
    goesTowards: (deposit: string, final: string) =>
      `Su depósito de ${deposit} se aplica a la limpieza del ${final}, y le devolvemos lo que no se deba.`,
    noMore:
      "No reservaremos más limpiezas. Puede empezar un plan nuevo más adelante.",
    notEnded: "No se finalizó el plan. Vuelva a intentarlo.",
    hasEnded: "Su plan de limpieza finalizó",
    endPlan: "Finalizar plan",
    endQ: "¿Finalizar su plan de limpieza?",
    cantRestart: "Un plan finalizado no se puede volver a empezar.",
    keep: "Mantener mi plan",
    eachWeek: "Cada semana",
    eachClean: "Cada limpieza",
    taxOff: (each: string, percent: number) =>
      `${each}, impuestos incluidos, ${percent}% de descuento`,
    towardsLast: "Depósito, aplicado a la última limpieza",
    offLast: "Depósito, se descuenta de su última limpieza",
    started: (day: string) => `Empezó el ${day}`,
    endedAt: (day: string) => `finalizó el ${day}`,
  },
});
type T = Said & { w: (typeof words)["en"] };

// a Service Plan's status
export function PlanStatusBadge({
  status,
}: {
  status: ServicePlanView["status"];
}) {
  const t = useSaid(words);
  return (
    <StatusBadge tone={t.planStatus[status].tone}>
      {t.planStatus[status].label}
    </StatusBadge>
  );
}

// Who's looking: the Client, in the portal, or Office Staff, acting for
// them. The words follow; so do where the plan's Jobs open and where Ending
// it posts.
type Viewer = {
  forClient: boolean;
  jobHref: (jobId: string) => AppHref;
  endPath: string;
};

// Why a plan is On Hold, and the way to put it right as the page's next
// step (the `ui` skill: the next step is the primary, the alert says why).
// An alert for each Unpaid Job or Bill, the first saying what the hold
// means: warning, as the plan waits on the Client, in its badge's tone;
// info for a payment we try again ourselves (ADR-0022), which asks
// nothing of the Client. The first that asks something is the next step;
// any other way to one keeps a text link in its alert (the Office's to a
// waiting one too), unless it goes where the next step does
export function useOnHold(
  plan: Omit<ServicePlanView, "upcoming"> | null,
  {
    forClient,
    jobHref,
    billHref,
  }: { billHref: (billId: string) => AppHref } & Omit<Viewer, "endPath">,
): { alerts: Alert[]; next?: PageAction } {
  const t = useSaid(words);
  if (plan?.status !== "on_hold") return { alerts: [] };
  const asks = (u: { kind: UnpaidKind }) => asksTheClient(u.kind);
  // their bank wants them to approve it: on its own page (#534 Q7)
  // approved, or tried again once turned down, on its page
  const approveOn = (href: AppHref, kind: UnpaidKind) => ({
    label: kind === "refused" ? t.tryAgain : t.APPROVE_PAYMENT,
    icon: ShieldCheck,
    href,
  });
  // the ones that ask something first, as money that asks leads: the
  // first alert, which says the pause, then says it of a payment that asks
  const unpaid = [
    ...plan.unpaid.map((u) => ({
      key: u.jobId,
      kind: u.kind,
      what: forClient
        ? t.w.cleanOn(t.formatDateTime(u.startsAt), t.formatMoney(u.owedCents))
        : `the clean on ${t.formatDateTime(u.startsAt)} (${t.formatMoney(u.owedCents)})`,
      // a clean's payment is put right by a card that works, which tries
      // it again; or, their bank wanting them to approve it, on its page
      way: forClient
        ? onItsPage(u.kind)
          ? approveOn(jobHref(u.jobId), u.kind)
          : {
              label: t.UPDATE_CARD,
              icon: CreditCard,
              href: linkTo({ to: "/portal/payment-method" }),
            }
        : {
            label: "See the job",
            icon: BriefcaseBusiness,
            href: jobHref(u.jobId),
          },
    })),
    ...plan.unpaidBills.map((b) => ({
      key: b.billId,
      kind: b.kind,
      what: forClient
        ? t.w.billN(b.number, t.formatMoney(b.totalCents))
        : `bill ${b.number} (${t.formatMoney(b.totalCents)})`,
      way:
        forClient && onItsPage(b.kind)
          ? approveOn(billHref(b.billId), b.kind)
          : {
              label: forClient ? t.payBill(b.number) : t.seeBill(b.number),
              icon: FileText,
              href: billHref(b.billId),
            },
    })),
  ].sort((a, b) => Number(asks(b)) - Number(asks(a)));
  const first = unpaid.find(asks);

  const alerts = unpaid.map((u, i): Alert => ({
    key: u.key,
    tone: asks(u) ? "warning" : "info",
    action: (asks(u) || !forClient) &&
      !sameHref(u.way.href, first?.way.href) && (
        <ButtonLink variant="text" href={u.way.href}>
          {u.way.label}
        </ButtonLink>
      ),
    children: (
      <p>
        {i === 0 && (
          <>
            <strong>
              {forClient ? t.p.planPaused : "Cleaning plan paused."}
            </strong>{" "}
          </>
        )}
        {u.kind === "approve"
          ? forClient
            ? t.w.toApprove(u.what)
            : `The client's bank wants them to approve the payment for ${u.what}. None of it was taken. ${officeFix.approve}`
          : u.kind === "refused"
            ? forClient
              ? t.w.refused(u.what)
              : `The client turned down the payment for ${u.what} at their bank. ${officeFix.refused}`
            : asks(u)
              ? `${forClient ? t.w.couldntTake : "The client's payment didn't go through for "}${u.what}.`
              : forClient
                ? `${t.w.notYet(u.what)} ${t.NOTHING_TO_DO}`
                : `The client's payment for ${u.what} hasn't gone through yet. ${officeFix.waiting}`}
        {i === 0 &&
          (forClient
            ? ` ${t.noMoreCleans(asks(u))}`
            : " No more jobs are booked until it's paid.")}
      </p>
    ),
  }));
  return { alerts, next: first?.way };
}

// what Ending a plan does, as sentences
function endingLines(t: T, terms: EndPlanTerms, forClient: boolean) {
  const final = t.formatDateTime(terms.finalJob.startsAt);
  const deposit = t.formatMoney(terms.depositCents);
  const cancelled = terms.cancelled.map(t.formatDateTime).join("; ");
  const goingAhead = terms.goingAhead.map(t.formatDateTime).join("; ");
  const hours = CANCELLATION_CUTOFF_HOURS;
  if (forClient) {
    return [
      terms.cancelled.length > 0 &&
        t.w.cancels(terms.cancelled.length, hours, cancelled),
      terms.goingAhead.length > 0 && t.w.goesAhead(goingAhead, hours),
      terms.depositCents > 0 &&
        (terms.deposit === "comes_off"
          ? t.w.comesOff(deposit, final)
          : terms.deposit === "refunded"
            ? t.w.refunded(deposit)
            : t.w.goesTowards(deposit, final)),
      t.w.noMore,
    ].filter((line): line is string => typeof line === "string");
  }
  // the Office's, English
  const your = "the client's";
  return [
    terms.cancelled.length > 0 &&
      `It cancels ${your} ${terms.cancelled.length === 1 ? "clean" : `${terms.cancelled.length} cleans`} booked more than ${hours} hours away, free: ${cancelled}.`,
    terms.goingAhead.length > 0 &&
      `The clean on ${goingAhead} is less than ${hours} hours away, so it goes ahead.`,
    terms.depositCents > 0 &&
      (terms.deposit === "comes_off"
        ? `The ${deposit} deposit comes off the price of the clean on ${final}.`
        : terms.deposit === "refunded"
          ? `The ${deposit} deposit is refunded.`
          : `The ${deposit} deposit goes towards the clean on ${final}, and whatever isn't owed is refunded.`),
    "No more jobs are booked. The home can start a new plan later.",
  ].filter((line): line is string => typeof line === "string");
}

// Ending a plan, at any time: what it does now, in the dialog that confirms
// it. On the plan's own page it's one of the page's actions
function EndPlanDialog({
  plan,
  forClient,
  endPath,
  ...state
}: { plan: Omit<ServicePlanView, "upcoming"> } & Omit<Viewer, "jobHref"> &
  Partial<DialogState>) {
  const t = useSaid(words);
  // what Ending does may have changed since the page loaded
  const action = useAction(
    forClient ? t.w.notEnded : "The plan wasn't ended. Please try again.",
    { reloadOnFailure: true },
  );
  const terms = plan.endTerms!;
  const lines = endingLines(t, terms, forClient);

  const end = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(endPath, { goingAhead: terms.goingAhead }),
      forClient ? t.w.hasEnded : "Cleaning plan ended",
    );
    if (ok) close();
  };

  return (
    <Dialog
      title={forClient ? t.w.endQ : "End this cleaning plan?"}
      role="alertdialog"
      {...state}
    >
      {({ close }) => (
        <>
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            <strong>
              {forClient
                ? t.w.cantRestart
                : "An ended plan can't be started again."}
            </strong>
          </p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {forClient ? t.w.keep : "Keep the plan"}
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={() => void end(close)}
            >
              {forClient ? t.w.endPlan : "End plan"}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

// the plan's End plan, as a page action
export function useEndPlanAction(
  plan: Omit<ServicePlanView, "upcoming">,
  viewer: Omit<Viewer, "jobHref">,
): PageAction | false {
  const t = useSaid(words);
  return (
    plan.status !== "ended" && {
      label: viewer.forClient ? t.w.endPlan : "End plan",
      icon: CircleStop,
      danger: true,
      dialog: (state) => <EndPlanDialog plan={plan} {...viewer} {...state} />,
    }
  );
}

// End plan on the plan's card, where the plan is a part of the page (a
// home's): red, on its title line (WEB-J). An ended plan has none
export function EndPlan({
  plan,
  endPath,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  endPath: string;
}) {
  if (plan.status === "ended") return null;
  return (
    <DialogTrigger>
      <Button variant="danger-text" size="sm">
        <CircleStop aria-hidden size={16} />
        End plan
      </Button>
      <EndPlanDialog plan={plan} forClient={false} endPath={endPath} />
    </DialogTrigger>
  );
}

// which of a Client's cleans say their length in the list: none while each
// runs as the card says for its weekday, as a row would repeat it; else, on
// a plan of one length, every row, so the one that differs sits among
// neighbours alike; on a plan of several, only the clean that isn't its
// weekday's (booked longer, or moved to a day the card has no length
// for), as neighbours of other weekdays aren't alike to compare and would
// hide it
export const cleansSayingLength = <
  Clean extends { startsAt: string; hoursOnSite: number },
>(
  days: { startsAt: string; hoursOnSite: number }[],
  cleans: Clean[],
) => {
  const oneLength =
    alike(days, (d) => `${quarterHours(d.hoursOnSite)}`).length === 1;
  // a clean moved off the plan's weekdays runs as the card says if it has
  // one length; with several, the card can't say which is its
  const differs = (clean: Clean) => {
    const usual =
      planDayOn(days, dayOfInstant(clean.startsAt)) ??
      (oneLength ? days[0] : undefined);
    return (
      !usual ||
      quarterHours(usual.hoursOnSite) !== quarterHours(clean.hoursOnSite)
    );
  };
  return oneLength && cleans.some(differs)
    ? new Set(cleans)
    : new Set(cleans.filter(differs));
};

// how long a Client's cleans run, to the quarter hour, on their plan and on
// the quote that offers it: one fact while every clean reads alike, else one
// for each length, naming its weekdays, so none is read as a sum or matched
// to a weekday by its place. Weekdays the same to the quarter hour read
// alike, "About" if any of them isn't exactly that
export function HowLongFacts({
  days,
}: {
  days: { startsAt: string; hoursOnSite: number }[];
}) {
  const t = useSaid(words);
  return (
    <>
      {alike(days, (d) => `${quarterHours(d.hoursOnSite)}`).map(
        (these, _, kinds) => (
          <Fact
            key={these[0]!.startsAt}
            icon={Clock}
            label={t.howLong}
            value={howLong(
              t,
              (
                these.find(
                  (d) => quarterHours(d.hoursOnSite) !== d.hoursOnSite,
                ) ?? these[0]!
              ).hoursOnSite,
            )}
            line={
              kinds.length > 1
                ? t.howLongOn(t.planDays(these.map((d) => d.startsAt)))
                : undefined
            }
          />
        ),
      )}
    </>
  );
}

// The plan as its Client and the Office read it, its details card: when,
// large, every weekday of it (one answer to "when is my clean?"), then its
// facts (UX pass, #96), and anything else below
export function PlanCard({
  plan,
  forClient,
  label,
  badge,
  children,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  forClient: boolean;
  label: string;
  // its status, beside how often, where the page doesn't say it already
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const t = useSaid(words);
  const [one] = plan.days;
  const several = plan.days.length > 1;
  const ended = plan.status === "ended";
  const each = several ? t.w.eachWeek : t.w.eachClean;
  return (
    <DetailsCard
      label={label}
      tile={<IconTile icon={CalendarClock} size="lg" />}
      kicker={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {t.recurrenceLabel[plan.recurrence]}
          {badge}
        </span>
      }
      title={plan.days.map((day) => (
        <Line
          key={day.startsAt}
          parts={[
            t.planDayWhen(day.startsAt),
            several && (
              <span key="service" className="font-normal text-fg-muted">
                {day.serviceName}
              </span>
            ),
          ]}
        />
      ))}
      line={!several && one!.serviceName}
    >
      <Facts>
        <Fact
          icon={Receipt}
          label={each}
          value={t.formatMoney(
            several ? plan.roundTotalCents : one!.totalCents,
          )}
          line={
            plan.discountPercent > 0
              ? t.w.taxOff(each, plan.discountPercent)
              : t.taxIncludedOf(each)
          }
        />
        {/* how long: the Client's to the quarter hour, the Office's to
            the minute, with its crew, as the Schedule books it; once a
            plan's weekdays differ in what the reader reads, each kind is
            its own fact, naming its days, so nothing is matched by position
            or read as a sum: "On site Mondays and Fridays, with 2 cleaners" */}
        {forClient ? (
          <HowLongFacts days={plan.days} />
        ) : (
          alike(
            plan.days,
            (d) => `${formatHours(d.hoursOnSite)} ${d.crewSize}`,
          ).map((days, _, kinds) => (
            <Fact
              key={days[0]!.startsAt}
              icon={Clock}
              label={t.onSite}
              value={formatHours(days[0]!.hoursOnSite)}
              line={
                kinds.length > 1
                  ? t.onSiteOnWith(
                      t.planDays(days.map((d) => d.startsAt)),
                      t.cleaners(days[0]!.crewSize),
                    )
                  : t.onSiteWith(t.cleaners(days[0]!.crewSize))
              }
            />
          ))
        )}
        <Fact
          icon={CirclePlus}
          label={t.extras}
          value={plan.addOns.length > 0 ? plan.addOns.join(", ") : t.none}
        />
        <Fact
          icon={PiggyBank}
          label={t.deposit}
          value={
            plan.depositCents === 0 ? t.none : t.formatMoney(plan.depositCents)
          }
          line={
            plan.depositCents === 0
              ? t.deposit
              : ended
                ? t.w.towardsLast
                : forClient
                  ? t.w.offLast
                  : "Deposit, comes off the last clean"
          }
        />
      </Facts>
      <p className="text-sm text-fg-muted">
        <Line
          parts={[
            t.w.started(t.formatDate(plan.startedAt)),
            plan.endedAt && t.w.endedAt(t.formatDate(plan.endedAt)),
          ]}
        />
      </p>
      {children}
    </DetailsCard>
  );
}

import type { ReactNode } from "react";
import {
  CalendarClock,
  CircleStop,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt,
  Users,
} from "lucide-react";
import {
  CANCELLATION_CUTOFF_HOURS,
  type EndPlanTerms,
  type ServicePlanView,
  catalog,
  oneStop,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogTrigger,
  IconTile,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../api.ts";
import type { AppHref } from "../links.ts";
import { useAction } from "./action.ts";
import { formatHours } from "./format.ts";
import { Fact } from "./Fact.tsx";
import { type Said, useSaid } from "./words.ts";

// what the Client reads, in their language (ADR-0025); what only the
// Office reads stays English, where it's said
const words = catalog({
  en: {
    cleanOn: (when: string, amount: string) =>
      `the clean on ${when} (${amount})`,
    payForClean: "Pay for that clean",
    billN: (n: string, amount: string) => `bill ${n} (${amount})`,
    payBill: (n: string) => `Pay bill ${n}`,
    paused: "Your plan is paused.",
    couldntTake: "We couldn't take payment for ",
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
    ended: "Ended",
    endedOn: (day: string) =>
      `Your cleaning plan ended on ${day}. No more cleans are booked for it.`,
    hasEnded: "Your cleaning plan has ended",
    ending: "Ending your plan",
    endPlan: "End plan",
    endQ: "End your cleaning plan?",
    cantRestart: "An ended plan can't be started again.",
    keep: "Keep my plan",
    endAnyTime: "End your plan at any time: you'll see what it cancels first.",
    eachWeek: "Each week",
    eachClean: "Each clean",
    taxOff: (each: string, percent: number) =>
      `${each}, tax included, ${percent}% off`,
    onSite: "On site",
    onSiteEachDay: "On site, each day",
    about: (hours: string) => `About ${hours}`,
    onSiteWith: (cleaners: string) => `On site, ${cleaners}`,
    extras: "Extras",
    none: "None",
    deposit: "Deposit",
    towardsLast: "Deposit, put towards the last clean",
    offLast: "Deposit, comes off your last clean",
    started: (day: string) => `Started ${day}`,
    endedAt: (day: string) => ` · Ended ${day}`,
  },
  es: {
    cleanOn: (when: string, amount: string) =>
      `la limpieza del ${when} (${amount})`,
    payForClean: "Pagar esa limpieza",
    billN: (n: string, amount: string) => `la factura ${n} (${amount})`,
    payBill: (n: string) => `Pagar la factura ${n}`,
    paused: "Su plan está en pausa.",
    couldntTake: "No pudimos cobrar ",
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
    ended: "Finalizado",
    endedOn: (day: string) =>
      `Su plan de limpieza finalizó el ${day}. No hay más limpiezas reservadas.`,
    hasEnded: "Su plan de limpieza finalizó",
    ending: "Finalizar su plan",
    endPlan: "Finalizar plan",
    endQ: "¿Finalizar su plan de limpieza?",
    cantRestart: "Un plan finalizado no se puede volver a empezar.",
    keep: "Mantener mi plan",
    endAnyTime: "Finalice su plan cuando quiera: primero verá lo que cancela.",
    eachWeek: "Cada semana",
    eachClean: "Cada limpieza",
    taxOff: (each: string, percent: number) =>
      `${each}, impuestos incluidos, ${percent}% de descuento`,
    onSite: "En el lugar",
    onSiteEachDay: "En el lugar, cada día",
    about: (hours: string) => `Unas ${hours}`,
    onSiteWith: (cleaners: string) => `En el lugar, ${cleaners}`,
    extras: "Adicionales",
    none: "Ninguno",
    deposit: "Depósito",
    towardsLast: "Depósito, aplicado a la última limpieza",
    offLast: "Depósito, se descuenta de su última limpieza",
    started: (day: string) => `Empezó el ${day}`,
    endedAt: (day: string) => ` · Finalizó el ${day}`,
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

// why a plan is On Hold: a Notice for each Unpaid Job or Bill, its one
// action the way to it (UX pass, #96). The first says what the hold means
export function OnHold({
  plan,
  forClient,
  jobHref,
  billHref,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  billHref: (billId: string) => AppHref;
} & Omit<Viewer, "endPath">) {
  const t = useSaid(words);
  if (plan.status !== "on_hold") return null;
  const unpaid = [
    ...plan.unpaid.map((u) => ({
      key: u.jobId,
      what: forClient
        ? t.w.cleanOn(t.formatDateTime(u.startsAt), t.formatMoney(u.owedCents))
        : `the clean on ${t.formatDateTime(u.startsAt)} (${t.formatMoney(u.owedCents)})`,
      href: jobHref(u.jobId),
      label: forClient ? t.w.payForClean : "See the job",
    })),
    ...plan.unpaidBills.map((b) => ({
      key: b.billId,
      what: forClient
        ? t.w.billN(b.number, t.formatMoney(b.totalCents))
        : `bill ${b.number} (${t.formatMoney(b.totalCents)})`,
      href: billHref(b.billId),
      label: forClient ? t.w.payBill(b.number) : `See bill ${b.number}`,
    })),
  ];
  return (
    <div className="flex flex-col gap-3">
      {unpaid.map((u, i) => (
        <Notice
          key={u.key}
          tone="danger"
          action={
            <ButtonLink variant="danger-text" href={u.href}>
              {u.label}
            </ButtonLink>
          }
        >
          <p>
            {i === 0 && (
              <>
                <strong>{forClient ? t.w.paused : "Paused."}</strong>{" "}
              </>
            )}
            {forClient
              ? t.w.couldntTake
              : "The client's payment didn't go through for "}
            {u.what}.
            {i === 0 &&
              (forClient
                ? ` ${t.BOOKED_GO_AHEAD}`
                : " Jobs already booked still go ahead, but no more are booked until it's paid.")}
          </p>
        </Notice>
      ))}
    </div>
  );
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

// Ending a plan, at any time: the button, and what it does now in the
// dialog that confirms it
export function EndPlan({
  plan,
  forClient,
  endPath,
}: { plan: Omit<ServicePlanView, "upcoming"> } & Omit<Viewer, "jobHref">) {
  const t = useSaid(words);
  // what Ending does may have changed since the page loaded
  const action = useAction(
    forClient ? t.w.notEnded : "The plan wasn't ended. Please try again.",
    {
      reloadOnFailure: true,
    },
  );
  if (plan.status === "ended") {
    return (
      <Section title={forClient ? t.w.ended : "Ended"}>
        <Card>
          <p>
            {forClient
              ? t.w.endedOn(t.formatDate(plan.endedAt!))
              : `This cleaning plan ended on ${t.formatDate(plan.endedAt!)}. No more cleans are booked for it.`}
          </p>
        </Card>
      </Section>
    );
  }
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
    <Section title={forClient ? t.w.ending : "Ending the plan"}>
      <Card>
        <ActionRow
          actions={
            <DialogTrigger>
              <Button variant="danger">
                <CircleStop aria-hidden size={18} />
                {forClient ? t.w.endPlan : "End plan"}
              </Button>
              <Dialog
                title={forClient ? t.w.endQ : "End this cleaning plan?"}
                role="alertdialog"
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
                    {action.problem && (
                      <Notice tone="danger">{action.problem}</Notice>
                    )}
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
            </DialogTrigger>
          }
        >
          <p>
            {forClient
              ? t.w.endAnyTime
              : "End it for the client at any time: you'll see what it cancels first."}
          </p>
        </ActionRow>
      </Card>
    </Section>
  );
}

// The plan as its Client and the Office read it: when, large, every weekday of it (one
// answer to "when is my clean?"), then its facts in even columns across, each
// an icon, a value and what the value is. Three text styles, no more.
// (UX pass, #96)
export function PlanFacts({
  plan,
  forClient,
  badge,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  forClient: boolean;
  // its status, beside how often, where the page doesn't say it already
  badge?: ReactNode;
}) {
  const t = useSaid(words);
  const [one] = plan.days;
  const several = plan.days.length > 1;
  const ended = plan.status === "ended";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-fg-muted">
              {t.recurrenceLabel[plan.recurrence]}
            </p>
            {badge}
          </div>
          {plan.days.map((day) => (
            <p key={day.startsAt} className="text-xl font-semibold text-fg">
              {t.planDayWhen(day.startsAt)}
              {several && (
                <span className="font-normal text-fg-muted">
                  {" "}
                  · {day.serviceName}
                </span>
              )}
            </p>
          ))}
          {!several && <p className="text-fg-muted">{one!.serviceName}</p>}
        </div>
      </div>
      {/* the columns follow the card's width, not the screen's: on the
          Office's page for a home it shares the screen with the History */}
      <div className="@container">
        <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
          <Fact
            icon={Receipt}
            label={several ? t.w.eachWeek : t.w.eachClean}
            value={t.formatMoney(
              several ? plan.roundTotalCents : one!.totalCents,
            )}
            line={t.w.taxOff(
              several ? t.w.eachWeek : t.w.eachClean,
              plan.discountPercent,
            )}
          />
          {several ? (
            <Fact
              icon={Users}
              label={t.w.onSite}
              value={plan.days
                .map((d) => formatHours(d.hoursOnSite))
                .join(" + ")}
              line={t.w.onSiteEachDay}
            />
          ) : (
            <Fact
              icon={Clock}
              label={t.w.onSite}
              value={t.w.about(formatHours(one!.hoursOnSite))}
              line={t.w.onSiteWith(t.cleaners(one!.crewSize))}
            />
          )}
          <Fact
            icon={CirclePlus}
            label={t.w.extras}
            value={plan.addOns.length > 0 ? plan.addOns.join(", ") : t.w.none}
          />
          <Fact
            icon={PiggyBank}
            label={t.w.deposit}
            value={
              plan.depositCents === 0
                ? t.w.none
                : t.formatMoney(plan.depositCents)
            }
            line={
              plan.depositCents === 0
                ? t.w.deposit
                : ended
                  ? t.w.towardsLast
                  : forClient
                    ? t.w.offLast
                    : "Deposit, comes off the last clean"
            }
          />
        </dl>
      </div>
      <p className="text-sm text-fg-muted">
        {t.w.started(t.formatDate(plan.startedAt))}
        {plan.endedAt && t.w.endedAt(t.formatDate(plan.endedAt))}
      </p>
    </div>
  );
}

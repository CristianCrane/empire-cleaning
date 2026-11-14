import { MessageSquarePlus } from "lucide-react";
import type { Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  type ClientView,
  type ServicePlanView,
  catalog,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Form,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TextField,
  RecordPage,
  type DialogState,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { formatHours } from "../format.ts";
import { useSaid } from "../words.ts";
import {
  PlanCard,
  PlanStatusBadge,
  useEndPlanAction,
  useOnHold,
} from "../PlanParts.tsx";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    details: "Plan details",
    reminder: "We email a reminder the day before.",
    upcoming: "Your upcoming cleans",
    ahead: "Each clean goes on the schedule about 4 weeks ahead.",
    noneBooked: "No cleans booked.",
    noneJustNow:
      "No cleans booked just now. We'll be in touch about your next one.",
    aboutOnSite: (hours: string) => `About ${hours} on site`,
    didntSend: "That didn't send. Please try again.",
    sent: "Sent. We'll send you a new cleaning plan quote.",
    askToChange: "Ask to change",
    askTitle: "Ask to change your plan",
    what: "What would you like to change?",
    tellUs:
      "A different day, how often, or what's included? Tell us, and we'll send you a new cleaning plan quote. Nothing changes until you accept it.",
  },
  es: {
    details: "Detalles del plan",
    reminder: "Le enviamos un recordatorio por correo el día antes.",
    upcoming: "Sus próximas limpiezas",
    ahead: "Cada limpieza se agenda unas 4 semanas antes.",
    noneBooked: "No hay limpiezas reservadas.",
    noneJustNow:
      "Por ahora no hay limpiezas reservadas. Le contactaremos sobre la próxima.",
    aboutOnSite: (hours: string) => `Cerca de ${hours} en el lugar`,
    didntSend: "No se envió. Vuelva a intentarlo.",
    sent: "Enviado. Le enviaremos una nueva cotización de plan de limpieza.",
    askToChange: "Pedir un cambio",
    askTitle: "Pedir un cambio en su plan",
    what: "¿Qué le gustaría cambiar?",
    tellUs:
      "¿Otro día, otra frecuencia u otra cosa incluida? Cuéntenos y le enviaremos una nueva cotización de plan de limpieza. Nada cambia hasta que la acepte.",
  },
});

// one of the Client's Service Plans, a Record (docs/ux.md): its terms,
// what each clean costs, the Deposit held for it, and its cleans on the
// Schedule; why it's On Hold, if it is; asking for different terms; and
// Ending it
export function PortalPlan() {
  const t = useSaid(words);
  const plan = useLoaderData({ from: "/portal/plans/$planId" });
  const navigate = useNavigate();
  const openJob = (id: Key) =>
    navigate({ to: "/portal/jobs/$jobId", params: { jobId: String(id) } });
  const onHold = useOnHold(plan, {
    forClient: true,
    jobHref: (jobId) =>
      linkTo({ to: "/portal/jobs/$jobId", params: { jobId } }),
    billHref: (billId) =>
      linkTo({ to: "/portal/bills/$billId", params: { billId } }),
  });

  const endPlan = useEndPlanAction(plan, {
    forClient: true,
    endPath: `/api/service-plans/mine/${plan.id}/end`,
  });

  return (
    <RecordPage
      trail={[
        { label: t.p.yourDetails, href: linkTo({ to: "/portal/details" }) },
        {
          label: plan.property.street,
          href: linkTo({
            to: "/portal/properties/$propertyId",
            params: { propertyId: plan.property.id },
          }),
        },
        { label: t.p.yourPlan },
      ]}
      title={t.p.yourPlan}
      status={<PlanStatusBadge status={plan.status} />}
      actions={[
        plan.status !== "ended" && {
          label: t.w.askToChange,
          icon: MessageSquarePlus,
          dialog: (state) => <AskToChange plan={plan} {...state} />,
        },
        endPlan,
      ]}
      alerts={onHold}
      details={
        <PlanCard plan={plan} forClient label={t.w.details}>
          <p className="text-sm text-fg-muted">
            {t.cleansPaid(plan.weeklyBill ?? "per_clean")} {t.w.reminder}
          </p>
        </PlanCard>
      }
    >
      <Section title={t.w.upcoming} description={t.w.ahead}>
        <List
          aria-label={t.w.upcoming}
          onAction={openJob}
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              {plan.status === "ended" ? t.w.noneBooked : t.w.noneJustNow}
            </p>
          )}
        >
          {plan.upcoming.map((job) => (
            <ListItem
              key={job.id}
              id={job.id}
              title={t.formatDateTime(job.startsAt)}
              description={t.w.aboutOnSite(formatHours(job.hoursOnSite))}
              end={
                <StatusBadge tone="info">{t.jobStatusLabel.booked}</StatusBadge>
              }
            />
          ))}
        </List>
      </Section>
    </RecordPage>
  );
}

// A different day, how often, or what's included: the Client says what
// they'd like, which reaches the Office as a Requested Quote for the home. The
// Office answers with a new Service Plan Quote; nothing changes until the
// Client accepts it.
function AskToChange({
  plan,
  ...state
}: { plan: ServicePlanView } & DialogState) {
  const t = useSaid(words);
  const action = useAction(t.w.didntSend);

  const ask = async (notes: string, close: () => void) => {
    const ok = await action.run(async () => {
      // the home's latest Condition, as the Client last gave it
      const me = await getJson<ClientView>("/api/clients/me");
      const home = me.properties.find((p) => p.id === plan.property.id)!;
      await postJson("/api/quotes/ask", {
        property: { existing: plan.property.id },
        serviceKey: plan.serviceKey,
        condition: home.condition,
        wantsRegularService: true,
        notes,
      });
    }, t.w.sent);
    if (ok) close();
  };

  return (
    <Dialog title={t.w.askTitle} {...state}>
      {({ close }) => (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void ask(String(form.get("notes")), close);
          }}
        >
          <p>{t.w.tellUs}</p>
          <TextField
            label={t.w.what}
            name="notes"
            multiline
            isRequired
            autoFocus
          />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {t.p.cancel}
            </Button>
            <Button type="submit" isPending={action.isPending}>
              {t.send}
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

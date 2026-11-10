import type { Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  type ClientView,
  type ServicePlanView,
  catalog,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { addressOf, formatHours } from "../format.ts";
import { useSaid } from "../words.ts";
import { EndPlan, OnHold, PlanFacts, PlanStatusBadge } from "../PlanParts.tsx";

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
    change: "Change your plan",
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
    change: "Cambiar su plan",
    askToChange: "Pedir un cambio",
    askTitle: "Pedir un cambio en su plan",
    what: "¿Qué le gustaría cambiar?",
    tellUs:
      "¿Otro día, otra frecuencia u otra cosa incluida? Cuéntenos y le enviaremos una nueva cotización de plan de limpieza. Nada cambia hasta que la acepte.",
  },
});

// one of the Client's Service Plans: its terms, what each clean costs, the
// Deposit held for it, and its cleans on the Schedule; why it's On Hold, if
// it is; asking for different terms; and Ending it
export function PortalPlan() {
  const t = useSaid(words);
  const plan = useLoaderData({ from: "/portal/plans/$planId" });
  const navigate = useNavigate();
  const openJob = (id: Key) =>
    navigate({ to: "/portal/jobs/$jobId", params: { jobId: String(id) } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
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
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{t.p.yourPlan}</Heading>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p className="text-fg-muted">{addressOf(plan.property)}</p>
      </div>

      <OnHold
        plan={plan}
        forClient
        jobHref={(jobId) =>
          linkTo({ to: "/portal/jobs/$jobId", params: { jobId } })
        }
        billHref={(billId) =>
          linkTo({ to: "/portal/bills/$billId", params: { billId } })
        }
      />

      <Section title={t.w.details}>
        <Card>
          <PlanFacts plan={plan} forClient />
          <p className="border-t border-border pt-4 text-sm text-fg-muted">
            {t.cleansPaid(plan.weeklyBill ?? "per_clean")} {t.w.reminder}
          </p>
        </Card>
      </Section>

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

      {plan.status !== "ended" && <AskToChange plan={plan} />}

      <EndPlan
        plan={plan}
        forClient
        endPath={`/api/service-plans/mine/${plan.id}/end`}
      />
    </div>
  );
}

// A different day, how often, or what's included: the Client says what
// they'd like, which reaches the Office as a Requested Quote for the home. The
// Office answers with a new Service Plan Quote; nothing changes until the
// Client accepts it.
function AskToChange({ plan }: { plan: ServicePlanView }) {
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
    <Section title={t.w.change}>
      <Card>
        <ActionRow
          actions={
            <DialogTrigger>
              <Button variant="secondary">{t.w.askToChange}</Button>
              <Dialog title={t.w.askTitle}>
                {({ close }) => (
                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      void ask(String(form.get("notes")), close);
                    }}
                  >
                    <TextField
                      label={t.w.what}
                      name="notes"
                      multiline
                      isRequired
                      autoFocus
                    />
                    {action.problem && (
                      <Notice tone="danger">{action.problem}</Notice>
                    )}
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
            </DialogTrigger>
          }
        >
          <p>{t.w.tellUs}</p>
        </ActionRow>
      </Card>
    </Section>
  );
}

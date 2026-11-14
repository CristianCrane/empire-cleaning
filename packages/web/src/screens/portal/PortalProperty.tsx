import { catalog } from "@empire-cleaning/models";
import type { Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { CalendarClock, FileText, KeyRound } from "lucide-react";
import { homeIcon } from "../icons.ts";
import type { PropertyView } from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Button,
  ButtonLink,
  Card,
  Dialog,
  Form,
  IconTile,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TextField,
  RecordPage,
  DetailsCard,
  Facts,
  type DialogState,
} from "@empire-cleaning/ui";
import { accessHelp } from "@empire-cleaning/quote-request";
import { patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { addressOf } from "../format.ts";
import { useSaid } from "../words.ts";
import { AccessFact, ConditionFact, FloorAreaFact } from "../Fact.tsx";
import { planWhen, quoteTitle, standingOf } from "./properties.ts";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { ClientQuoteStatusBadge } from "../QuoteParts.tsx";
import { requestQuoteHref } from "./whats-next.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    businessDetails: "Business details",
    homeDetails: "Home details",
    yourBusiness: "Your business",
    conditionLine: "Condition, at the last visit",
    accessLine: "How we get in: only your cleaners see it",
    sizeNote:
      "To change its size or rooms, ask us for a new quote. They set the price.",
    plans: "Cleaning plans",
    nextClean: (when: string) => `next clean ${when}`,
    noPlan:
      "No cleaning plan here yet. Ask for a quote for regular cleans, with money off each one.",
    quotes: "Quotes",
    sent: (day: string) => `Sent ${day}`,
    askedFor: (day: string) => `Asked for ${day}`,
    notSaved: "How we get in wasn't saved. Please try again.",
    saved: "Saved how we get in",
    edit: "Edit how we get in",
    howDoWe: "How do we get in?",
    save: "Save",
  },
  es: {
    businessDetails: "Datos del negocio",
    homeDetails: "Datos de la casa",
    yourBusiness: "Su negocio",
    conditionLine: "Estado, en la última visita",
    accessLine: "Cómo entramos: solo sus limpiadores lo ven",
    sizeNote:
      "Para cambiar su tamaño o habitaciones, pídanos una nueva cotización: de eso depende el precio.",
    plans: "Planes de limpieza",
    nextClean: (when: string) => `próxima limpieza el ${when}`,
    noPlan:
      "Aún no hay plan de limpieza aquí. Pida una cotización para limpiezas regulares, con un descuento en cada una.",
    quotes: "Cotizaciones",
    sent: (day: string) => `Enviada el ${day}`,
    askedFor: (day: string) => `Pedida el ${day}`,
    notSaved: "No se guardó cómo entramos. Vuelva a intentarlo.",
    saved: "Se guardó cómo entramos",
    edit: "Editar cómo entramos",
    howDoWe: "¿Cómo entramos?",
    save: "Guardar",
  },
});

// One of the Client's homes, as their plan's and cleans' pages read: what it
// is, large, then its facts across, with how we get in, changed in a dialog;
// then its Service Plans and Quotes. Its size and rooms change only with a
// new Quote, which prices them. (UX pass, #96)
export function PortalProperty() {
  const data = useLoaderData({ from: "/portal/properties/$propertyId" });
  const { property: p } = data;
  const navigate = useNavigate();
  const t = useSaid(words);
  const { w } = t;
  const standing = standingOf(t.lang, p, data);
  const premises = p.kind === "commercial";
  const plans = data.plans
    .filter((plan) => plan.property.id === p.id)
    // an Ended plan after the live one
    .sort(
      (a, b) => Number(a.status === "ended") - Number(b.status === "ended"),
    );
  const quotes = data.quotes.filter((q) => q.property.id === p.id);

  return (
    <RecordPage
      trail={[
        { label: t.p.yourDetails, href: linkTo({ to: "/portal/details" }) },
        { label: p.street },
      ]}
      title={p.street}
      status={<StatusBadge tone={standing.tone}>{standing.label}</StatusBadge>}
      actions={[
        {
          label: w.edit,
          icon: KeyRound,
          dialog: (state) => <EditAccess property={p} {...state} />,
        },
      ]}
      details={
        <DetailsCard
          label={premises ? w.businessDetails : w.homeDetails}
          tile={<IconTile icon={homeIcon(p.kind)} size="lg" />}
          kicker={premises ? w.yourBusiness : t.p.yourHome}
          title={t.propertySummary(p)}
          line={addressOf(p)}
        >
          <Facts>
            <FloorAreaFact property={p} />
            <ConditionFact property={p} line={w.conditionLine} />
            <AccessFact
              property={p}
              line={w.accessLine}
              className="col-span-full"
            />
          </Facts>
          <p className="text-sm text-fg-muted">{w.sizeNote}</p>
        </DetailsCard>
      }
    >
      <Section title={plans.length > 1 ? w.plans : t.p.cleaningPlan}>
        {plans.length > 0 ? (
          <List
            aria-label={w.plans}
            onAction={(id: Key) =>
              navigate({
                to: "/portal/plans/$planId",
                params: { planId: String(id) },
              })
            }
          >
            {plans.map((plan) => (
              <ListItem
                key={plan.id}
                id={plan.id}
                start={<IconTile icon={CalendarClock} />}
                title={`${t.recurrenceLabel[plan.recurrence]}, ${planWhen(t.lang, plan)}`}
                description={[
                  [...new Set(plan.days.map((d) => d.serviceName))].join(", "),
                  plan.nextStartsAt &&
                    w.nextClean(t.formatDateTime(plan.nextStartsAt)),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={<PlanStatusBadge status={plan.status} />}
              />
            ))}
          </List>
        ) : (
          <Card>
            <ActionRow
              actions={
                <ButtonLink variant="secondary" href={requestQuoteHref}>
                  {t.REQUEST_A_QUOTE}
                </ButtonLink>
              }
            >
              <p>{w.noPlan}</p>
            </ActionRow>
          </Card>
        )}
      </Section>

      {quotes.length > 0 && (
        <Section title={w.quotes}>
          <List
            aria-label={w.quotes}
            onAction={(id: Key) =>
              navigate({
                to: "/portal/quotes/$quoteId",
                params: { quoteId: String(id) },
              })
            }
          >
            {quotes.map((q) => (
              <ListItem
                key={q.id}
                id={q.id}
                start={<IconTile icon={FileText} />}
                title={quoteTitle(t.lang, q)}
                description={
                  q.sentAt
                    ? w.sent(t.shortDayOf(q.sentAt))
                    : w.askedFor(t.shortDayOf(q.createdAt))
                }
                end={<ClientQuoteStatusBadge status={q.status} />}
              />
            ))}
          </List>
        </Section>
      )}
    </RecordPage>
  );
}

function EditAccess({
  property,
  ...state
}: { property: PropertyView } & DialogState) {
  const t = useSaid(words);
  const { w } = t;
  const action = useAction(w.notSaved);

  const save = async (text: string, close: () => void) => {
    const ok = await action.run(
      () =>
        patchJson(`/api/properties/${property.id}/access-instructions`, {
          accessInstructions: text || null,
        }),
      w.saved,
    );
    if (ok) close();
  };

  return (
    <Dialog title={t.howWeGetIn} {...state}>
      {({ close }) => (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void save(String(form.get("access")), close);
          }}
        >
          <TextField
            label={w.howDoWe}
            name="access"
            multiline
            autoFocus
            description={accessHelp[t.lang][property.kind]}
            defaultValue={property.accessInstructions ?? ""}
          />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {t.p.cancel}
            </Button>
            <Button type="submit" isPending={action.isPending}>
              {w.save}
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  House,
  Mail,
  Phone,
  SquarePen,
  UserRound,
} from "lucide-react";
import { catalog, type ClientView } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { addressOf } from "../format.ts";
import { useSaid } from "../words.ts";
import { Fact } from "../Fact.tsx";
import { standingOf } from "./properties.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    premises: "Your premises",
    homes: "Your homes",
    contact: "Contact details",
    emailed: (email: string) =>
      `We've emailed a link to ${email}. Your email changes once you open it.`,
    name: "Name",
    whereQuotes: "Where we send your quotes",
    phone: "Phone",
    oneHome: "How we get in, its cleaning plan and quotes are on its page.",
    manyHomes:
      "How we get in, cleaning plans and quotes are on each one's page.",
    notSaved: "Your details weren't saved. Please try again.",
    checkFor: (email: string) => `Check ${email} for a link`,
    saved: "Details saved",
    edit: "Edit",
    yourContact: "Your contact details",
    fullName: "Full name",
    emailNote:
      "Where we send your quotes. We switch to a new one once you open the link we email to it. You still sign in the way you do now.",
    saveDetails: "Save details",
  },
  es: {
    premises: "Su negocio",
    homes: "Sus casas",
    contact: "Datos de contacto",
    emailed: (email: string) =>
      `Le enviamos un enlace a ${email}. Su correo cambia cuando lo abra.`,
    name: "Nombre",
    whereQuotes: "Adonde le enviamos las cotizaciones",
    phone: "Teléfono",
    oneHome:
      "Cómo entramos, su plan de limpieza y cotizaciones están en su página.",
    manyHomes:
      "Cómo entramos, los planes de limpieza y las cotizaciones están en la página de cada una.",
    notSaved: "No se guardaron sus datos. Vuelva a intentarlo.",
    checkFor: (email: string) => `Revise ${email} para ver el enlace`,
    saved: "Datos guardados",
    edit: "Editar",
    yourContact: "Sus datos de contacto",
    fullName: "Nombre completo",
    emailNote:
      "Adonde le enviamos las cotizaciones. Cambiamos al nuevo cuando abra el enlace que le enviamos. Sigue iniciando sesión como ahora.",
    saveDetails: "Guardar datos",
  },
});

// A Client's contact details, read first and changed in a dialog; then
// their homes, a row each saying where it stands, each opening its own page
// (its Access Instructions, Service Plan and Quotes). (UX pass, #96)
export function PortalDetails() {
  const data = useLoaderData({ from: "/portal/details" });
  const { client } = data;
  const navigate = useNavigate();
  const t = useSaid(words);
  const { w } = t;
  const business = client.properties.some((p) => p.kind === "commercial");
  const homes = business
    ? w.premises
    : client.properties.length === 1
      ? t.p.yourHome
      : w.homes;

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {t.p.yourDetails}
      </Heading>

      <Section title={w.contact} actions={<EditContact client={client} />}>
        {client.pendingEmail && (
          <Notice tone="warning">
            <span className="[overflow-wrap:anywhere]">
              {w.emailed(client.pendingEmail)}
            </span>
          </Notice>
        )}
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <Fact
              icon={UserRound}
              label={w.name}
              value={client.name}
              line={client.businessName ?? w.name}
            />
            <Fact
              icon={Mail}
              label={t.email}
              value={
                <span className="[overflow-wrap:anywhere]">{client.email}</span>
              }
              line={w.whereQuotes}
            />
            <Fact icon={Phone} label={w.phone} value={client.phone} />
          </dl>
        </Card>
      </Section>

      <Section
        title={homes}
        description={client.properties.length === 1 ? w.oneHome : w.manyHomes}
      >
        <List
          aria-label={homes}
          onAction={(id) =>
            navigate({
              to: "/portal/properties/$propertyId",
              params: { propertyId: String(id) },
            })
          }
        >
          {client.properties.map((p) => {
            const standing = standingOf(t.lang, p, data);
            return (
              <ListItem
                key={p.id}
                id={p.id}
                start={
                  <IconTile
                    icon={p.kind === "commercial" ? Building2 : House}
                  />
                }
                title={addressOf(p)}
                description={[t.propertySummary(p), standing.line]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  <StatusBadge tone={standing.tone}>
                    {standing.label}
                  </StatusBadge>
                }
              />
            );
          })}
        </List>
      </Section>
    </div>
  );
}

function EditContact({ client }: { client: ClientView }) {
  const t = useSaid(words);
  const { w } = t;
  const action = useAction(w.notSaved);

  const save = async (form: FormData, close: () => void) => {
    const ok = await action.run(
      async () => {
        const saved = await patchJson<ClientView>("/api/clients/me", {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        });
        return saved;
      },
      // a new email is theirs once they open the link sent to it (#243);
      (saved) =>
        saved.pendingEmail && saved.pendingEmail !== client.pendingEmail
          ? w.checkFor(saved.pendingEmail)
          : w.saved,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">
        <SquarePen aria-hidden size={18} />
        {w.edit}
      </Button>
      <Dialog title={w.yourContact}>
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget), close);
            }}
          >
            <TextField
              label={w.fullName}
              name="name"
              autoComplete="name"
              isRequired
              autoFocus
              defaultValue={client.name}
            />
            <TextField
              label={t.email}
              name="email"
              type="email"
              autoComplete="email"
              isRequired
              description={w.emailNote}
              defaultValue={client.email}
            />
            <TextField
              label={w.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              isRequired
              defaultValue={client.phone}
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                {t.p.cancel}
              </Button>
              <Button type="submit" isPending={action.isPending}>
                {w.saveDetails}
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

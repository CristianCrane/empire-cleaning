import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { homeIcon } from "../icons.ts";
import { catalog, type ClientView } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Form,
  IconTile,
  Notice,
  SettingsList,
  SettingsPage,
  StatusBadge,
  TextField,
  type DialogState,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { addressOf, lineOf } from "../format.ts";
import { useSaid } from "../words.ts";
import { standingOf } from "./properties.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    premises: "Your premises",
    homes: "Your homes",
    contact: "Contact details",
    emailed: (email: string) =>
      `We've emailed a link to ${email}. Your email changes once you open it.`,
    phone: "Phone",
    notSaved: "Your details weren't saved. Please try again.",
    checkFor: (email: string) => `Check ${email} for a link`,
    saved: "Details saved",
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
    phone: "Teléfono",
    notSaved: "No se guardaron sus datos. Vuelva a intentarlo.",
    checkFor: (email: string) => `Revise ${email} para ver el enlace`,
    saved: "Datos guardados",
    fullName: "Nombre completo",
    emailNote:
      "Adonde le enviamos las cotizaciones. Cambiamos al nuevo cuando abra el enlace que le enviamos. Sigue iniciando sesión como ahora.",
    saveDetails: "Guardar datos",
  },
});

// A Client's details, a Settings page (docs/ux.md, Screen types,
// Settings): their contact details as one row opening its dialog; then
// their homes, a row each saying where it stands, each opening its own page
// (its Access Instructions, Service Plan and Quotes). (#436)
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
    <SettingsPage
      title={t.p.yourDetails}
      // a new email waits on them to open its link (#243)
      alerts={[
        !!client.pendingEmail && {
          key: "pending-email",
          tone: "warning",
          children: (
            <span className="[overflow-wrap:anywhere]">
              {w.emailed(client.pendingEmail)}
            </span>
          ),
        },
      ]}
      parts={[
        {
          id: "contact",
          title: w.contact,
          summary: [client.name, client.email, client.phone].join(" · "),
          dialog: (state) => <EditContact client={client} {...state} />,
        },
      ]}
    >
      <SettingsList
        title={homes}
        rows={client.properties.map((p) => {
          const standing = standingOf(t.lang, p, data);
          return {
            id: p.id,
            title: addressOf(p),
            start: <IconTile icon={homeIcon(p.kind)} />,
            description: lineOf([t.propertySummary(p), standing.line]),
            badges: [
              <StatusBadge key="standing" tone={standing.tone}>
                {standing.label}
              </StatusBadge>,
            ],
            onOpen: () =>
              void navigate({
                to: "/portal/properties/$propertyId",
                params: { propertyId: String(p.id) },
              }),
          };
        })}
      />
    </SettingsPage>
  );
}

function EditContact({
  client,
  ...state
}: { client: ClientView } & DialogState) {
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
    <Dialog title={w.contact} {...state}>
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
  );
}

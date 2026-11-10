import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  House,
  Languages,
  Mail,
  Phone,
  SquarePen,
  UserRound,
} from "lucide-react";
import {
  catalog,
  type ClientView,
  type Language,
  LANGUAGES,
  languageNames,
} from "@empire-cleaning/models";
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
  Select,
  SelectItem,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { patchJson, putJson } from "../../api.ts";
import { forgetAccount } from "../../session.ts";
import { useAction } from "../action.ts";
import { addressOf } from "../format.ts";
import { useSaid } from "../words.ts";
import { Fact } from "../Fact.tsx";
import { standingOf } from "./properties.ts";

// in the Client's language (ADR-0025)
export const words = catalog({
  en: {
    premises: "Your premises",
    homes: "Your homes",
    contact: "Contact details",
    emailed: (email: string) =>
      `We've emailed a link to ${email}. Your email changes once you open it.`,
    name: "Name",
    whereQuotes: "Where we send your quotes",
    phone: "Phone",
    language: "Language",
    languageLine: "Your screens and emails",
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
    languageNote: "We'll show the app and send our emails in it.",
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
    language: "Idioma",
    languageLine: "Sus pantallas y correos",
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
    languageNote:
      "Le mostramos la aplicación y le enviamos los correos en este idioma.",
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
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Fact
              icon={Languages}
              label={w.language}
              value={languageNames[client.preferredLanguage]}
              line={w.languageLine}
            />
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
  const [language, setLanguage] = useState<Language>(client.preferredLanguage);

  const save = async (form: FormData, close: () => void) => {
    const ok = await action.run(
      async () => {
        const saved = await patchJson<ClientView>("/api/clients/me", {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        });
        // their own language, on every record they are (ADR-0025): the
        // portal follows it once the Account is asked for again
        if (language !== client.preferredLanguage) {
          await putJson("/api/me/language", { language });
          forgetAccount();
        }
        return saved;
      },
      // a new email is theirs once they open the link sent to it (#243);
      // said in the language they chose, which the page turns to
      (saved) =>
        saved.pendingEmail && saved.pendingEmail !== client.pendingEmail
          ? words[language].checkFor(saved.pendingEmail)
          : words[language].saved,
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
            <Select
              label={w.language}
              description={w.languageNote}
              selectedKey={language}
              onSelectionChange={(key) => setLanguage(key as Language)}
            >
              {LANGUAGES.map((lang) => (
                <SelectItem
                  key={lang}
                  id={lang}
                  textValue={languageNames[lang]}
                >
                  <span lang={lang}>{languageNames[lang]}</span>
                </SelectItem>
              ))}
            </Select>
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

import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  House,
  Mail,
  Phone,
  SquarePen,
  UserRound,
} from "lucide-react";
import type { ClientView } from "@empire-cleaning/models";
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
import { addressOf, propertySummary } from "../format.ts";
import { Fact } from "../Fact.tsx";
import { standingOf } from "./properties.ts";

// A Client's contact details, read first and changed in a dialog; then
// their homes, a row each saying where it stands, each opening its own page
// (its Access Instructions, Service Plan and Quotes). (UX pass, #96)
export function PortalDetails() {
  const data = useLoaderData({ from: "/portal/details" });
  const { client } = data;
  const navigate = useNavigate();
  const business = client.properties.some((p) => p.kind === "commercial");
  const homes = business
    ? "Your premises"
    : client.properties.length === 1
      ? "Your home"
      : "Your homes";

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        Your details
      </Heading>

      <Section
        title="Contact details"
        actions={<EditContact client={client} />}
      >
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <Fact
              icon={UserRound}
              label="Name"
              value={client.name}
              line={client.businessName ?? "Name"}
            />
            <Fact
              icon={Mail}
              label="Email"
              value={
                <span className="[overflow-wrap:anywhere]">{client.email}</span>
              }
              line="Where we send your Quotes"
            />
            <Fact icon={Phone} label="Phone" value={client.phone} />
          </dl>
        </Card>
      </Section>

      <Section
        title={homes}
        description={
          client.properties.length === 1
            ? "How we get in, its Service Plan and Quotes are on its page."
            : "How we get in, Service Plans and Quotes are on each one's page."
        }
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
            const standing = standingOf(p, data);
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
                description={[propertySummary(p), standing.line]
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
  const action = useAction("Your details weren't saved. Please try again.");

  const save = async (form: FormData, close: () => void) => {
    const ok = await action.run(
      () =>
        patchJson("/api/clients/me", {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
      "Details saved",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">
        <SquarePen aria-hidden size={18} />
        Edit
      </Button>
      <Dialog title="Your contact details">
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget), close);
            }}
          >
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              isRequired
              autoFocus
              defaultValue={client.name}
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              isRequired
              description="Where we send your Quotes. You still sign in the way you do now."
              defaultValue={client.email}
            />
            <TextField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              isRequired
              defaultValue={client.phone}
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Save details
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

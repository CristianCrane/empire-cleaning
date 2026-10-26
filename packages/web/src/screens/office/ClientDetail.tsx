import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type { OfficeClientView, PropertyStatus } from "@empire-cleaning/models";
import {
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
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { addressOf, formatDateTime, homeSummary } from "../format.ts";

// a Client for the Office: their contact details, which Office Staff can
// correct (or add an email to), and their homes, each with where it stands
// and opening its own page, which holds its history; and quoting them
// afresh, as when they phone (#34)
export function ClientDetail() {
  const client = useLoaderData({ from: "/office/clients/$clientId" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Clients", href: linkTo({ to: "/office/clients" }) },
            { label: client.name },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level={1}>{client.name}</Heading>
          <Button
            onPress={() =>
              void navigate({
                to: "/office/quotes/new",
                search: { clientId: client.id },
              })
            }
          >
            New Quote
          </Button>
        </div>
      </div>

      <Card title="Contact details" actions={<EditContact client={client} />}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Email</dt>
          <dd className="[overflow-wrap:anywhere]">
            {client.email ??
              "None yet: Quotes can't be sent to them until one is added."}
          </dd>
          <dt className="font-semibold">Phone</dt>
          <dd>{client.phone}</dd>
        </dl>
      </Card>

      <Card title="Properties">
        <List
          aria-label={`${client.name}'s Properties`}
          renderEmptyState={() => (
            <p className="p-4 text-center text-fg-muted">No Properties yet.</p>
          )}
        >
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={`${statusLine(home.status)} · ${homeSummary(home)}`}
              onAction={() =>
                void navigate({
                  to: "/office/properties/$propertyId",
                  params: { propertyId: home.id },
                })
              }
            />
          ))}
        </List>
      </Card>
    </div>
  );
}

const statusLine = (status: PropertyStatus) => {
  switch (status.kind) {
    case "request_waiting":
      return "Quote Request waiting";
    case "quote_sent":
      return status.quoteKind === "service_plan"
        ? "Service Plan Quote sent"
        : "Quote sent";
    case "job_booked":
      return `Job booked ${formatDateTime(status.startsAt)}`;
    case "first_clean_done":
      return "First Clean done";
    case "nothing_booked":
      return "Nothing booked";
  }
};

// Office Staff correcting a Client's name, email or phone. An email can be
// added or changed but not removed: Quotes and notices go there.
function EditContact({ client }: { client: OfficeClientView }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [isSaving, setSaving] = useState(false);

  const save = async (form: FormData, close: () => void) => {
    setSaving(true);
    setProblem(undefined);
    try {
      await patchJson<OfficeClientView>(`/api/clients/${client.id}`, {
        name: form.get("name"),
        email: form.get("email") || null,
        phone: form.get("phone"),
      });
      showToast({ tone: "success", title: "Contact details saved" });
      close();
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setProblem("The details weren't saved. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">Edit</Button>
      <Dialog title="Edit contact details">
        {({ close }) => (
          <Form
            validationErrors={fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget), close);
            }}
          >
            <TextField
              label="Full name"
              name="name"
              defaultValue={client.name}
              isRequired
              autoFocus
            />
            <TextField
              label={client.email ? "Email" : "Email (optional)"}
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={client.email ?? ""}
              isRequired={client.email !== null}
              description="Their Quotes and notices go here."
            />
            <TextField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="off"
              defaultValue={client.phone}
              isRequired
            />
            {problem && <Notice tone="danger">{problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={isSaving}>
                Save
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type {
  BillPayment,
  OfficeClientView,
  PropertyStatus,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, patchJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { BillStatusBadge, billLine } from "../BillParts.tsx";
import {
  addressOf,
  clientName,
  formatDateTime,
  formatDay,
  propertySummary,
} from "../format.ts";

// a Client for the Office: their contact details, which Office Staff can
// correct (or add an email to), and their homes, each with where it stands
// and opening its own page, which holds its history; quoting them afresh,
// as when they phone (#34); and for a business, how they're billed and their
// weekly Bills (ADR-0016)
export function ClientDetail() {
  const { client, bills } = useLoaderData({
    from: "/office/clients/$clientId",
  });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Clients", href: linkTo({ to: "/office/clients" }) },
            { label: clientName(client) },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level={1}>{clientName(client)}</Heading>
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
          {client.businessName && (
            <>
              <dt className="font-semibold">Business</dt>
              <dd>{client.businessName}</dd>
              <dt className="font-semibold">Contact</dt>
              <dd>{client.name}</dd>
            </>
          )}
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
          aria-label={`${clientName(client)}'s Properties`}
          renderEmptyState={() => (
            <p className="p-4 text-center text-fg-muted">No Properties yet.</p>
          )}
        >
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={`${statusLine(home.status)} · ${propertySummary(home)}`}
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

      {(client.billing.canBillWeekly || client.billing.weeklyFrom) && (
        <Billing client={client} />
      )}

      {bills.length > 0 && (
        <Card title="Bills" description="Newest first.">
          <List
            aria-label={`${clientName(client)}'s Bills`}
            onAction={(id) =>
              void navigate({
                to: "/office/bills/$billId",
                params: { billId: String(id) },
              })
            }
          >
            {bills.map((bill) => (
              <ListItem
                key={bill.id}
                id={bill.id}
                title={bill.number}
                description={billLine(bill)}
                end={<BillStatusBadge bill={bill} />}
              />
            ))}
          </List>
        </Card>
      )}
    </div>
  );
}

// how a commercial Client is billed (ADR-0016): per Job, as every Client is
// until Office Staff switch them to weekly Bills, and how they pay those
function Billing({ client }: { client: OfficeClientView }) {
  const { billing } = client;
  return (
    <Card title="Billing" actions={<EditBilling client={client} />}>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Billed</dt>
        <dd>
          {billing.weeklyFrom
            ? `Weekly, from the week of ${formatDay(billing.weeklyFrom)}`
            : "Per Job, when each is done"}
        </dd>
        {billing.weeklyFrom && (
          <>
            <dt className="font-semibold">Pays</dt>
            <dd>
              {billing.payment === "automatic"
                ? "Charged to their saved Payment Method when each Bill is made"
                : `On each Bill's page within ${billing.termsDays} ${billing.termsDays === 1 ? "day" : "days"}, by card or bank debit`}
            </dd>
          </>
        )}
        <dt className="font-semibold">Billing email</dt>
        <dd className="[overflow-wrap:anywhere]">
          {billing.billingEmail ?? "None: Bills go to their own email"}
        </dd>
      </dl>
    </Card>
  );
}

function EditBilling({ client }: { client: OfficeClientView }) {
  const router = useRouter();
  const { billing } = client;
  const [weekly, setWeekly] = useState(billing.weeklyFrom !== null);
  const [payment, setPayment] = useState<BillPayment>(billing.payment);
  const [termsDays, setTermsDays] = useState(billing.termsDays);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [isSaving, setSaving] = useState(false);

  const save = async (form: FormData, close: () => void) => {
    setSaving(true);
    setProblem(undefined);
    setFieldErrors({});
    try {
      await putJson<OfficeClientView>(`/api/clients/${client.id}/billing`, {
        weekly,
        payment,
        termsDays,
        billingEmail: String(form.get("billingEmail") ?? "").trim() || null,
      });
      showToast({ tone: "success", title: "Billing saved" });
      close();
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setProblem(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "Billing wasn't saved. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">Edit</Button>
      <Dialog title="Billing">
        {({ close }) => (
          <Form
            validationErrors={fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget), close);
            }}
          >
            <Checkbox isSelected={weekly} onChange={setWeekly}>
              Bill weekly
            </Checkbox>
            <p className="text-sm text-fg-muted">
              {weekly
                ? "Everything they owe for a week, Monday to Sunday, goes on one Bill made the following Monday, from this week on."
                : billing.weeklyFrom
                  ? "Bills already made stay due. Anything not billed yet is charged per Job."
                  : "Each Job is charged to their card when it's done."}
            </p>
            {weekly && (
              <>
                <RadioGroup
                  label="How they pay"
                  value={payment}
                  onChange={(value) => setPayment(value as BillPayment)}
                >
                  <Radio
                    value="automatic"
                    description="Each Bill is charged to their saved Payment Method when it's made, and emailed as a receipt."
                  >
                    Charged automatically
                  </Radio>
                  <Radio
                    value="on_page"
                    description="They pay each Bill on its page, by card or bank debit, by its due date."
                  >
                    On the Bill's page
                  </Radio>
                </RadioGroup>
                {payment === "on_page" && (
                  <NumberField
                    label="Terms, in days"
                    name="termsDays"
                    description="From the Monday a Bill is made to its due date."
                    minValue={1}
                    maxValue={90}
                    value={termsDays}
                    onChange={(days) =>
                      setTermsDays(Number.isNaN(days) ? 14 : days)
                    }
                    className="max-w-xs"
                  />
                )}
              </>
            )}
            <TextField
              label="Billing email (optional)"
              name="billingEmail"
              type="email"
              autoComplete="off"
              defaultValue={billing.billingEmail ?? ""}
              description={`Bills and their receipts go here instead of ${client.email ?? "their own email"}.`}
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

// Office Staff correcting a Client's name, business name, email or phone.
// An email can be added or changed but not removed: Quotes and notices go
// there.
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
        businessName: form.get("businessName") || null,
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
              label={client.businessName ? "Contact's full name" : "Full name"}
              name="name"
              defaultValue={client.name}
              isRequired
              autoFocus
            />
            <TextField
              label="Business name (optional)"
              name="businessName"
              autoComplete="off"
              defaultValue={client.businessName ?? ""}
              description="For a business: the name above is the person they deal with there."
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

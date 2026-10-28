import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type {
  BillPayment,
  ClientBillingSaved,
  OfficeClientView,
  PropertyStatus,
  SettledJobView,
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
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { patchJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { BillStatusBadge, billLine } from "../BillParts.tsx";
import {
  addressOf,
  clientName,
  formatDateTime,
  formatDay,
  formatMoney,
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

      <Section
        title="Contact details"
        actions={<EditContact client={client} />}
      >
        <Card>
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
      </Section>

      <Section title="Properties">
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
      </Section>

      {(client.billing.canBillWeekly || client.billing.weeklyFrom) && (
        <Billing client={client} />
      )}

      {bills.length > 0 && (
        <Section title="Bills" description="Newest first.">
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
        </Section>
      )}
    </div>
  );
}

// how a commercial Client is billed (ADR-0016): per Job, as every Client is
// until Office Staff switch them to weekly Bills, and how they pay those
function Billing({ client }: { client: OfficeClientView }) {
  const { billing } = client;
  return (
    <Section title="Billing" actions={<EditBilling client={client} />}>
      <Card>
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
    </Section>
  );
}

function EditBilling({ client }: { client: OfficeClientView }) {
  const { billing } = client;
  const [weekly, setWeekly] = useState(billing.weeklyFrom !== null);
  const [payment, setPayment] = useState<BillPayment>(billing.payment);
  const [termsDays, setTermsDays] = useState(billing.termsDays);
  const action = useAction("Billing wasn't saved. Please try again.");
  // what switching weekly billing off settled per Job, shown once saved
  const [settled, setSettled] = useState<SettledJobView[]>([]);

  const save = (form: FormData, close: () => void) =>
    action.run(async () => {
      const saved = await putJson<ClientBillingSaved>(
        `/api/clients/${client.id}/billing`,
        {
          weekly,
          payment,
          termsDays,
          billingEmail: String(form.get("billingEmail") ?? "").trim() || null,
        },
      );
      if (saved.settled.length > 0) setSettled(saved.settled);
      else close();
    }, "Billing saved");

  return (
    <DialogTrigger onOpenChange={(isOpen) => !isOpen && setSettled([])}>
      <Button variant="secondary">Edit</Button>
      <Dialog title="Billing">
        {({ close }) =>
          settled.length > 0 ? (
            <Settled settled={settled} close={close} />
          ) : (
            <Form
              validationErrors={action.fieldErrors}
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
              {action.problem && (
                <Notice tone="danger">{action.problem}</Notice>
              )}
              <Actions>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>
                <Button type="submit" isPending={action.isPending}>
                  Save
                </Button>
              </Actions>
            </Form>
          )
        }
      </Dialog>
    </DialogTrigger>
  );
}

// what switching weekly billing off charged, refunded or left Unpaid, per
// Job; the Client is emailed the same
function Settled({
  settled,
  close,
}: {
  settled: SettledJobView[];
  close: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p>
        Anything no Bill had taken yet is now settled per Job. We've emailed the
        Client what we did:
      </p>
      <ul className="flex flex-col gap-2">
        {settled.map((s) => (
          <li key={s.jobId}>
            <p>{s.label}</p>
            <p className="text-sm text-fg-muted">
              {[
                s.chargedCents > 0 && `Charged ${formatMoney(s.chargedCents)}`,
                s.refundedCents > 0 &&
                  `Refunded ${formatMoney(s.refundedCents)}`,
                s.unpaidCents !== null &&
                  `Unpaid: couldn't charge ${formatMoney(s.unpaidCents)}`,
              ]
                .filter(Boolean)
                .join(". ")}
            </p>
          </li>
        ))}
      </ul>
      <Actions>
        <Button onPress={close}>Done</Button>
      </Actions>
    </div>
  );
}

const statusLine = (status: PropertyStatus) => {
  switch (status.kind) {
    case "quote_requested":
      return "Quote asked for";
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
  const action = useAction("The details weren't saved. Please try again.");

  const save = async (form: FormData, close: () => void) => {
    const ok = await action.run(
      () =>
        patchJson<OfficeClientView>(`/api/clients/${client.id}`, {
          name: form.get("name"),
          businessName: form.get("businessName") || null,
          email: form.get("email") || null,
          phone: form.get("phone"),
        }),
      "Contact details saved",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">Edit</Button>
      <Dialog title="Edit contact details">
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
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
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Save
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

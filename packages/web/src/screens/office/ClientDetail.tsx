import { useState } from "react";
import {
  Pencil,
  UserRound,
  Mail,
  Phone,
  Languages,
  Star,
  CalendarRange,
  CreditCard,
} from "lucide-react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  type BillPayment,
  type ClientBillingSaved,
  type OfficeClientView,
  type PropertyStatus,
  type SettledJobView,
  formats,
  cleansPaidForOffice,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  LanguageName,
  LanguagePicker,
  List,
  ListItem,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Section,
  TextField,
  RecordPage,
  DetailsCard,
  Facts,
  Fact,
  type DialogState,
} from "@empire-cleaning/ui";
import { patchJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import { useAction } from "../action.ts";
import { BillStatusBadge, billLine } from "../BillParts.tsx";
import { addressOf, clientName, screenWords } from "../format.ts";
import { NEW_QUOTE } from "./NewQuoteScreen.tsx";
import { clientTrail } from "./trails.ts";

const { propertySummary } = screenWords.en;

const { formatDate, formatDateTime, formatDay, formatMoney } = formats.en;

// a Client for the Office, a Record (docs/ux.md): their contact details,
// which Office Staff can correct (or add an email to), and their homes,
// each with where it stands and opening its own page, which holds its
// history; quoting them afresh, as when they phone (#34); and for a
// business, how they're billed and their weekly Bills (ADR-0016)
export function ClientDetail() {
  const { client, bills } = useLoaderData({
    from: "/office/clients/$clientId",
  });
  const navigate = useNavigate();
  const trail = clientTrail(client);

  return (
    <RecordPage
      trail={[trail[0]!, { label: clientName(client) }]}
      title={clientName(client)}
      actions={[
        {
          label: NEW_QUOTE,
          icon: QuoteIcon,
          href: linkTo({
            to: "/office/quotes/new",
            search: { clientId: client.id },
          }),
        },
        {
          label: "Edit contact details",
          icon: Pencil,
          dialog: (state) => <EditContact client={client} {...state} />,
        },
      ]}
      details={
        // WEB-H: their contact details as icon facts
        <DetailsCard label="Contact details">
          <Facts>
            {client.businessName && (
              <Fact icon={UserRound} label="Contact" value={client.name} />
            )}
            <Fact
              icon={Mail}
              label="Email"
              value={
                client.email ??
                "None yet: quotes can't be sent until one is added"
              }
            />
            <Fact icon={Phone} label="Phone" value={client.phone} />
            <Fact
              icon={Languages}
              label="Preferred language"
              value={<LanguageName language={client.preferredLanguage} />}
            />
            {client.reviewRequestedAt && (
              <Fact
                icon={Star}
                label="Google review"
                value={formatDate(client.reviewRequestedAt)}
                line="Google review asked for"
              />
            )}
          </Facts>
        </DetailsCard>
      }
    >
      <Section title="Properties">
        <List
          aria-label={`${clientName(client)}'s properties`}
          renderEmptyState={() => (
            <p className="p-4 text-center text-fg-muted">No properties yet.</p>
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
            aria-label={`${clientName(client)}'s bills`}
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
                description={billLine("en", bill)}
                end={<BillStatusBadge bill={bill} />}
              />
            ))}
          </List>
        </Section>
      )}
    </RecordPage>
  );
}

// how a commercial Client is billed (ADR-0016): per Job, as every Client is
// until Office Staff switch them to weekly Bills, and how they pay those
function Billing({ client }: { client: OfficeClientView }) {
  const { billing } = client;
  return (
    <Section title="Billing" actions={<EditBilling client={client} />}>
      <Card>
        <Facts>
          <Fact
            icon={CalendarRange}
            label="Billed"
            value={
              billing.weeklyFrom
                ? `Weekly, from the week of ${formatDay(billing.weeklyFrom)}`
                : "Per job, when each is done"
            }
          />
          {billing.weeklyFrom && (
            <Fact
              icon={CreditCard}
              label="Pays"
              value={
                billing.payment === "automatic"
                  ? "Charged to their card when each bill is made"
                  : `On each bill's page within ${billing.termsDays} ${billing.termsDays === 1 ? "day" : "days"}, by card or bank`
              }
            />
          )}
          <Fact
            icon={Mail}
            label="Billing email"
            value={billing.billingEmail ?? "None: bills go to their own email"}
          />
        </Facts>
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
      <Button variant="text" size="sm">
        <Pencil aria-hidden size={16} />
        Edit
      </Button>
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
                  ? "Everything they owe for a week, Monday to Sunday, goes on one bill made the following Monday, from this week on."
                  : billing.weeklyFrom
                    ? "Bills already made still need paying. Anything not billed yet is charged per job."
                    : cleansPaidForOffice("per_clean")}
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
                      description="Each bill is charged to their card when it's made, and emailed as a receipt."
                    >
                      Charged automatically
                    </Radio>
                    <Radio
                      value="on_page"
                      description="They pay each bill on its page, by card or bank, by its due date."
                    >
                      On the bill's page
                    </Radio>
                  </RadioGroup>
                  {payment === "on_page" && (
                    <NumberField
                      label="Days to pay"
                      name="termsDays"
                      description="From the Monday a bill is made to its due date."
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
                <Button variant="quiet" onPress={close}>
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
        Anything not on a bill yet is now charged per job. We've emailed the
        client what we did:
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
                  `Unpaid: ${formatMoney(s.unpaidCents)} didn't go through`,
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
        ? "Cleaning plan quote sent"
        : "Quote sent";
    case "job_booked":
      return `Job booked ${formatDateTime(status.startsAt)}`;
    case "first_clean_done":
      return "First clean done";
    case "nothing_booked":
      return "Nothing booked";
  }
};

// Office Staff correcting a Client's name, business name, email, phone or
// Preferred Language, which is this Client's alone (ADR-0025).
// An email can be added or changed but not removed: Quotes and notices go
// there.
function EditContact({
  client,
  ...state
}: { client: OfficeClientView } & DialogState) {
  const action = useAction("The details weren't saved. Please try again.");

  const save = async (form: FormData, close: () => void) => {
    const ok = await action.run(
      () =>
        patchJson<OfficeClientView>(`/api/clients/${client.id}`, {
          name: form.get("name"),
          businessName: form.get("businessName") || null,
          email: form.get("email") || null,
          phone: form.get("phone"),
          preferredLanguage: form.get("preferredLanguage"),
        }),
      "Contact details saved",
    );
    if (ok) close();
  };

  return (
    <Dialog title="Edit contact details" {...state}>
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
            description="Their quotes and notices go here."
          />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="off"
            defaultValue={client.phone}
            isRequired
          />
          <LanguagePicker
            name="preferredLanguage"
            defaultValue={client.preferredLanguage}
          />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button type="submit" isPending={action.isPending}>
              Save
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

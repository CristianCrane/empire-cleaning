import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import type { ClientView, PropertyView } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  ButtonLink,
  Card,
  Form,
  Heading,
  Notice,
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { HomeWithPlan } from "./portal-home.prototype.tsx";
import { addressOf, propertySummary } from "../format.ts";

// a Client's own contact details and Access Instructions. A home's size and
// Condition are read-only here: changing them needs a new Quote.
export function PortalDetails() {
  // PROTOTYPE: loads Home's data, for the plans
  const { client } = useLoaderData({ from: "/portal/details" });

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Your details</Heading>
      <ContactDetails client={client} />
      {/* PROTOTYPE: the home and its Service Plan live here now */}
      <Section
        title={client.properties.length === 1 ? "Your home" : "Your homes"}
      >
        <HomeWithPlan />
        {client.properties.map((home) => (
          <AccessInstructions key={home.id} home={home} />
        ))}
      </Section>
      <Card
        title="Payment Method"
        description="The card your Deposits and cleans are charged to."
      >
        <ButtonLink
          variant="secondary"
          className="self-start"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          Manage your card
        </ButtonLink>
      </Card>
    </div>
  );
}

function ContactDetails({ client }: { client: ClientView }) {
  const [details, setDetails] = useState({
    name: client.name,
    email: client.email,
    phone: client.phone,
  });
  const action = useAction("Your details weren't saved. Please try again.");

  const save = () =>
    action.run(() => patchJson("/api/clients/me", details), "Details saved");

  return (
    <Card title="Contact details">
      <Form
        validationErrors={action.fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          isRequired
          value={details.name}
          onChange={(name) => setDetails({ ...details, name })}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          isRequired
          description="Where we send your Quotes. You still sign in the way you do now."
          value={details.email}
          onChange={(email) => setDetails({ ...details, email })}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          isRequired
          value={details.phone}
          onChange={(phone) => setDetails({ ...details, phone })}
        />
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button type="submit" isPending={action.isPending}>
            Save details
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

function AccessInstructions({ home }: { home: PropertyView }) {
  const [text, setText] = useState(home.accessInstructions ?? "");
  const action = useAction(
    "Your Access Instructions weren't saved. Please try again.",
  );

  const save = () =>
    action.run(
      () =>
        patchJson(`/api/properties/${home.id}/access-instructions`, {
          accessInstructions: text || null,
        }),
      "Access Instructions saved",
    );

  return (
    <Card title={addressOf(home)} description={propertySummary(home)}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="How do we get in?"
          multiline
          description="Door codes, where the key is, parking. Only your Cleaners see this."
          value={text}
          onChange={setText}
        />
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            type="submit"
            variant="secondary"
            isPending={action.isPending}
          >
            Save Access Instructions
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

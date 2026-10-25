import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type { ClientView, PropertyView } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  ButtonLink,
  Card,
  Form,
  Heading,
  Notice,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { addressOf, homeSummary } from "../format.ts";

// a Client's own contact details and Access Instructions. A home's size and
// Condition are read-only here: changing them needs a new Quote.
export function PortalDetails() {
  const client = useLoaderData({ from: "/portal/details" });

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Your details</Heading>
      <ContactDetails client={client} />
      {client.properties.map((home) => (
        <AccessInstructions key={home.id} home={home} />
      ))}
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
  const router = useRouter();
  const [details, setDetails] = useState({
    name: client.name,
    email: client.email,
    phone: client.phone,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await patchJson("/api/clients/me", details);
      setFieldErrors({});
      showToast({ tone: "success", title: "Details saved" });
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setFailed(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Contact details">
      <Form
        validationErrors={fieldErrors}
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
        {failed && (
          <Notice tone="danger">
            Your details weren't saved. Please try again.
          </Notice>
        )}
        <Actions>
          <Button type="submit" isPending={isSaving}>
            Save details
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

function AccessInstructions({ home }: { home: PropertyView }) {
  const router = useRouter();
  const [text, setText] = useState(home.accessInstructions ?? "");
  const [isSaving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await patchJson(`/api/properties/${home.id}/access-instructions`, {
        accessInstructions: text || null,
      });
      showToast({ tone: "success", title: "Access Instructions saved" });
      await router.invalidate();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={addressOf(home)} description={homeSummary(home)}>
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
        {failed && (
          <Notice tone="danger">
            Your Access Instructions weren't saved. Please try again.
          </Notice>
        )}
        <Actions>
          <Button type="submit" variant="secondary" isPending={isSaving}>
            Save Access Instructions
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

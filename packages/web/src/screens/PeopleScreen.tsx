import { useState } from "react";
import { useLoaderData, useSearch } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import type { AccountRole, DemoPerson } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Button,
  Card,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  Logo,
  Notice,
  TextField,
  buttonStyles,
} from "@empire-cleaning/ui";
import { authClient, signOut } from "../session.ts";

const roleLabels: Record<AccountRole, string> = {
  office_staff: "Office",
  cleaner: "Cleaner",
  client: "Client",
};

const firstName = (person: DemoPerson) => person.name.split(" ")[0]!;

// the person a link asks for by first name (?as=helen)
export const personAsked = (people: DemoPerson[], as: string | undefined) =>
  as
    ? people.find((p) => firstName(p).toLowerCase() === as.toLowerCase())
    : undefined;

// Gmail's search for mail to this address, when it's a Gmail address: the
// test site's sign-in links all land in the business's Gmail inbox
const gmailSearchFor = (email: string) =>
  email.endsWith("@gmail.com")
    ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`to:${email}`)}`
    : undefined;

// The test site's people from the demo, to sign in as any of them: the
// guided tours link here with the person a step needs first. Not on the real
// site, whose API has no demo people.
export function PeopleScreen() {
  const { people, account } = useLoaderData({ from: "/people" });
  const { as, next } = useSearch({ from: "/people" });
  const [sentTo, setSentTo] = useState<string>();
  const [isSending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const wanted = personAsked(people, as);
  const others = people.filter((p) => p !== wanted);
  const you = account?.email;

  // signs out whoever is in, then emails the person's sign-in link, which
  // brings them back to the page the tour asked for
  const become = async (email: string) => {
    setSending(true);
    setSendFailed(false);
    if (account) await signOut();
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${window.location.origin}${next ?? "/"}`,
      errorCallbackURL: `${window.location.origin}/sign-in`,
    });
    setSending(false);
    if (error) setSendFailed(true);
    else setSentTo(email);
  };

  if (sentTo) {
    const gmail = gmailSearchFor(sentTo);
    return (
      <Page>
        <Card>
          <Heading level={1} size={2}>
            Check your email
          </Heading>
          <div className="flex items-start gap-3">
            <IconTile icon={MailCheck} tone="success" />
            <p>
              A sign-in link is on its way to{" "}
              <strong className="break-all">{sentTo}</strong>. It works once,
              for 15 minutes.
            </p>
          </div>
          <Actions>
            <Button variant="text" onPress={() => setSentTo(undefined)}>
              Pick someone else
            </Button>
            {gmail && (
              <a
                href={gmail}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: "primary" })}
              >
                Open it in Gmail
              </a>
            )}
          </Actions>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Heading level={1} size={2}>
        Who do you want to be?
      </Heading>
      {sendFailed && (
        <Notice tone="danger">
          Sending the sign-in link didn't work. Please try again.
        </Notice>
      )}

      {wanted && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{wanted.name}</p>
              <p className="text-sm text-fg-muted">{about(wanted)}</p>
            </div>
          </div>
          <Button
            className="w-full"
            isPending={isSending}
            onPress={() => void become(wanted.email)}
          >
            Be {firstName(wanted)}
          </Button>
          {account && (
            <p className="text-sm text-fg-muted">
              This signs you out as {account.name}.
            </p>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <Heading level={2} size={4}>
          {wanted ? "Or someone else" : "Pick a person"}
        </Heading>
        <List
          aria-label="People"
          onAction={(email) => void become(String(email))}
          disabledKeys={you ? [you] : []}
        >
          {others.map((p) => (
            <ListItem
              key={p.email}
              id={p.email}
              title={p.email === you ? `${p.name} (you)` : p.name}
              description={about(p)}
              start={<Avatar />}
            />
          ))}
        </List>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={2} size={4}>
          Anyone else
        </Heading>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get("email");
            void become(String(email));
          }}
        >
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            isRequired
          />
          <Button type="submit" variant="secondary" isPending={isSending}>
            Email me a sign-in link
          </Button>
        </Form>
      </section>
    </Page>
  );
}

const about = (person: DemoPerson) =>
  `${roleLabels[person.role]} · ${person.shows}`;

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4">
      <Logo className="mx-auto w-44" />
      {children}
    </main>
  );
}

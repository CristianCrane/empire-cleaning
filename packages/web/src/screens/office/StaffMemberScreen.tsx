import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { parseDate, type CalendarDate } from "@internationalized/date";
import type { StaffDetail } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  DatePicker,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  NumberField,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { deleteJson, postJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { formatDay, formatHours, roleLabel, today } from "../format.ts";
import { MemberStatus } from "./StaffScreen.tsx";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const hoursFormat = { maximumFractionDigits: 2 } as const;

// one Staff member: who they are, their availability, and deactivating them
export function StaffMemberScreen() {
  const member = useLoaderData({ from: "/office/staff/$staffId" });
  const isCleaner = member.roles.includes("cleaner");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Staff", href: linkTo({ to: "/office/staff" }) },
            { label: member.name },
          ]}
        />
        <div className="flex items-center gap-4">
          <Avatar src={member.imageUrl} size="lg" />
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>{member.name}</Heading>
            <MemberStatus member={member} />
          </div>
        </div>
      </div>

      <Card title="Details">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Email</dt>
          <dd>{member.email}</dd>
          <dt className="font-semibold">Roles</dt>
          <dd>{member.roles.map((r) => roleLabel[r]).join(" and ")}</dd>
          <dt className="font-semibold">Signed up</dt>
          <dd>{member.signedUp ? "Yes" : "Not yet: invitation sent"}</dd>
        </dl>
        {member.active && <Deactivate member={member} />}
      </Card>

      {member.active && isCleaner && (
        <>
          {/* a save starts the form afresh from what was saved */}
          <UsualWeek
            key={member.availability.usualWeek.join()}
            member={member}
          />
          <Exceptions member={member} />
        </>
      )}
      {member.active && !isCleaner && (
        <Notice>
          Only Cleaners' hours count towards the Schedule, so there's no
          availability to set for {member.name}.
        </Notice>
      )}
    </div>
  );
}

function Deactivate({ member }: { member: StaffDetail }) {
  const action = useAction("They weren't deactivated. Please try again.");

  const deactivate = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/staff/${member.id}/deactivate`),
      `${member.name} deactivated`,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="secondary" className="self-start">
        Deactivate
      </Button>
      <Dialog title={`Deactivate ${member.name}?`} role="alertdialog">
        {({ close }) => (
          <>
            <p>
              They'll lose Staff access straight away. Anything they do as a
              Client is unaffected. You can invite them again later.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void deactivate(close)}
              >
                Deactivate
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

function UsualWeek({ member }: { member: StaffDetail }) {
  const [week, setWeek] = useState(member.availability.usualWeek);
  const action = useAction("The usual week wasn't saved. Please try again.");

  const save = () =>
    action.run(
      () =>
        putJson(`/api/staff/${member.id}/usual-week`, {
          usualWeek: week.map((h) => (Number.isNaN(h) ? 0 : h)),
        }),
      "Usual week saved",
    );

  return (
    <Card
      title="Usual week"
      description="The hours they can usually work each day. Days off are 0."
    >
      <Form
        validationErrors={action.fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {/* as many days to a row as fit at a readable width, not a fixed
            count: the field's − and + buttons alone take 88px */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
          {weekdays.map((day, i) => (
            <NumberField
              key={day}
              label={day}
              name={`usualWeek.${i}`}
              minValue={0}
              maxValue={24}
              step={0.25}
              formatOptions={hoursFormat}
              value={week[i]}
              onChange={(hours) =>
                setWeek((current) =>
                  current.map((h, j) => (j === i ? hours : h)),
                )
              }
            />
          ))}
        </div>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            type="submit"
            variant="secondary"
            isPending={action.isPending}
          >
            Save usual week
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

function Exceptions({ member }: { member: StaffDetail }) {
  const router = useRouter();
  const [date, setDate] = useState<CalendarDate | null>(null);
  const [hours, setHours] = useState(0);
  const [note, setNote] = useState("");
  const action = useAction("That day wasn't saved. Please try again.");
  const { exceptions } = member.availability;

  const add = async () => {
    if (!date) {
      action.fail(undefined, { date: "Choose a day" });
      return;
    }
    await action.run(
      async () => {
        await putJson(`/api/staff/${member.id}/exceptions/${date.toString()}`, {
          hours: Number.isNaN(hours) ? 0 : hours,
          note,
        });
        setDate(null);
        setHours(0);
        setNote("");
      },
      `${formatDay(date.toString())} saved`,
    );
  };

  const remove = async (day: string) => {
    try {
      await deleteJson(`/api/staff/${member.id}/exceptions/${day}`);
      showToast({
        tone: "success",
        title: `${formatDay(day)} is back to the usual week`,
      });
      await router.invalidate();
    } catch {
      showToast({ tone: "danger", title: "That day wasn't removed" });
    }
  };

  return (
    <Card
      title="Days off and extra days"
      description="A day here replaces their usual hours for that day, e.g. 0 for a holiday."
    >
      {exceptions.length > 0 && (
        <List aria-label="Days that differ from the usual week">
          {exceptions.map((exception) => (
            <ListItem
              key={exception.date}
              id={exception.date}
              textValue={formatDay(exception.date)}
              title={`${formatDay(exception.date)}: ${formatHours(exception.hours)}`}
              description={exception.note ?? undefined}
              end={
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={`Remove ${formatDay(exception.date)}`}
                  onPress={() => void remove(exception.date)}
                >
                  Remove
                </Button>
              }
            />
          ))}
        </List>
      )}
      <Form
        validationErrors={action.fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <DatePicker
            label="Day"
            name="date"
            value={date}
            onChange={setDate}
            minValue={parseDate(today())}
            isInvalid={Boolean(action.fieldErrors.date)}
            errorMessage={action.fieldErrors.date}
          />
          <NumberField
            label="Hours that day"
            name="hours"
            minValue={0}
            maxValue={24}
            step={0.25}
            formatOptions={hoursFormat}
            value={hours}
            onChange={setHours}
          />
          <TextField
            label="Note (optional)"
            name="note"
            value={note}
            onChange={setNote}
          />
        </div>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            type="submit"
            variant="secondary"
            isPending={action.isPending}
          >
            Save day
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

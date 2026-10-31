import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Mail,
  SquarePen,
  UserCheck,
  UserRound,
} from "lucide-react";
import type { StaffDetail, StaffRole } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Notice,
  NumberField,
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { deleteJson, patchJson, postJson, putJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { formatDay, roleLabel, today } from "../format.ts";
import { Fact } from "../Fact.tsx";
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

// a day's hours as a calendar cell says them
const hoursLabel = (hours: number) => (hours === 0 ? "Off" : `${hours} h`);

// One Staff member (UX pass, #96): who they are, changed in a dialog; a
// Cleaner's availability as a month calendar, a day opening its dialog;
// and deactivating them
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Avatar src={member.imageUrl} size="lg" />
            <div className="flex flex-wrap items-center gap-3">
              <Heading level={1}>{member.name}</Heading>
              <MemberStatus member={member} />
            </div>
          </div>
          {member.active && <Deactivate member={member} />}
        </div>
      </div>

      {!member.active && (
        <Notice>
          {member.name} has no Staff access. Invite them again to bring them
          back.
        </Notice>
      )}
      {member.active && !isCleaner && (
        <Notice>
          Only Cleaners' hours count towards the Schedule, so there's no
          availability to set for {member.name}.
        </Notice>
      )}

      <Section
        title="Details"
        actions={member.active && <EditStaff member={member} />}
      >
        <Card>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              <Fact icon={Mail} label="Email" value={member.email} />
              <Fact
                icon={UserRound}
                label="Roles"
                value={member.roles.map((r) => roleLabel[r]).join(" and ")}
              />
              <Fact
                icon={UserCheck}
                label="Signed up"
                value={
                  member.signedUp ? "Signed up" : "Not yet: invitation sent"
                }
                line="Their account"
              />
            </dl>
          </div>
        </Card>
      </Section>

      {member.active && isCleaner && <Availability member={member} />}
    </div>
  );
}

// their name and roles; their email is how their account connects, so it
// stays (ADR-0006)
function EditStaff({ member }: { member: StaffDetail }) {
  const [roles, setRoles] = useState<StaffRole[]>(member.roles);
  const action = useAction("The changes weren't saved. Please try again.");

  const toggle = (role: StaffRole, on: boolean) =>
    setRoles((current) =>
      on ? [...current, role] : current.filter((r) => r !== role),
    );

  return (
    <DialogTrigger onOpenChange={(open) => open && setRoles(member.roles)}>
      <Button variant="text" size="sm">
        <SquarePen aria-hidden size={16} />
        Edit
      </Button>
      <Dialog title={`Edit ${member.name}`}>
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await action.run(
                  () =>
                    patchJson(`/api/staff/${member.id}`, {
                      name: form.get("name"),
                      roles,
                    }),
                  "Changes saved",
                )
              )
                close();
            }}
          >
            <TextField
              label="Name"
              name="name"
              defaultValue={member.name}
              isRequired
              autoFocus
            />
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-semibold">Roles</legend>
              <Checkbox
                isSelected={roles.includes("cleaner")}
                onChange={(on) => toggle("cleaner", on)}
              >
                Cleaner: carries out Jobs
              </Checkbox>
              <Checkbox
                isSelected={roles.includes("office_staff")}
                onChange={(on) => toggle("office_staff", on)}
              >
                Office Staff: runs the Office workspace
              </Checkbox>
            </fieldset>
            {action.fieldErrors.roles && (
              <Notice tone="danger">{action.fieldErrors.roles}</Notice>
            )}
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Save changes
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
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
      <Button variant="danger-text" size="sm">
        <Ban aria-hidden size={16} />
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
              <Button variant="quiet" onPress={close}>
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

// "2026-11" for a day
const monthOf = (day: string) => day.slice(0, 7);

const monthName = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// the month after (or before) one, as "2026-12"
const stepMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

// each day of a month, Monday first, with blanks before the 1st
const daysOf = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // getUTCDay is Sunday first
  const blanks = (first.getUTCDay() + 6) % 7;
  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
};

// Mon=0 … Sun=6, as the usual week is kept
const weekdayIndex = (day: string) =>
  (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

// Their usual week and the days that differ, on a month calendar: each day
// its hours, the days that differ tinted, past days dimmed. A day from today
// on opens its dialog; the usual week is changed from the header.
function Availability({ member }: { member: StaffDetail }) {
  const now = today();
  const [month, setMonth] = useState(monthOf(now));
  const [open, setOpen] = useState<string | null>(null);
  const { usualWeek, exceptions } = member.availability;
  const exceptionOn = (day: string) => exceptions.find((e) => e.date === day);

  return (
    <Section
      title="Availability"
      description="Their usual week, and the days that differ. Pick a day to change it."
      actions={
        <UsualWeek key={usualWeek.join()} member={member} usual={usualWeek} />
      }
    >
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-fg">
              {monthName.format(new Date(`${month}-01T00:00:00Z`))}
            </p>
            <div className="flex gap-1">
              <Button
                variant="quiet"
                size="icon"
                aria-label="Previous month"
                isDisabled={month <= monthOf(now)}
                onPress={() => setMonth(stepMonth(month, -1))}
              >
                <ChevronLeft aria-hidden size={18} />
              </Button>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Next month"
                onPress={() => setMonth(stepMonth(month, 1))}
              >
                <ChevronRight aria-hidden size={18} />
              </Button>
            </div>
          </div>
          <div
            aria-hidden
            className="grid grid-cols-7 gap-1 text-center text-sm text-fg-muted"
          >
            {weekdays.map((d) => (
              <span key={d}>{d.slice(0, 3)}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {daysOf(month).map((day, i) => {
              if (day === null) return <span key={`blank ${i}`} />;
              const exception = exceptionOn(day);
              const hours = exception?.hours ?? usualWeek[weekdayIndex(day)]!;
              const past = day < now;
              const tone = exception
                ? hours > 0
                  ? "bg-info-subtle"
                  : "bg-warning-subtle"
                : hours > 0
                  ? "bg-surface"
                  : "bg-surface-sunken text-fg-muted";
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  onClick={() => setOpen(day)}
                  className={`flex min-h-14 min-w-0 flex-col items-start rounded-md border border-border p-1.5 text-start outline-focus focus-visible:outline-2 sm:p-2 ${tone} ${past ? "opacity-50" : "hover:border-primary"}`}
                >
                  {/* named by what it shows, with the weekday and month
                      said, not shown: "Sun, Nov 15 Off" */}
                  <span className="text-sm">
                    <span className="sr-only">
                      {formatDay(day).replace(/ \d+$/, "")}{" "}
                    </span>
                    {Number(day.slice(8))}
                  </span>
                  <span className="text-sm font-semibold sm:text-base">
                    {" "}
                    {hoursLabel(hours)}
                    {exception && (
                      <span className="sr-only">
                        (differs from the usual week)
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-fg-muted">
            Tinted days differ from the usual week: amber for time off, blue for
            extra hours.
          </p>
        </div>
      </Card>
      {open && (
        <DayDialog
          member={member}
          day={open}
          usual={usualWeek[weekdayIndex(open)]!}
          exception={exceptionOn(open)}
          close={() => setOpen(null)}
        />
      )}
    </Section>
  );
}

// the hours they can usually work each weekday, in a dialog
function UsualWeek({
  member,
  usual,
}: {
  member: StaffDetail;
  usual: number[];
}) {
  const [week, setWeek] = useState(usual);
  const action = useAction("The usual week wasn't saved. Please try again.");

  return (
    <DialogTrigger onOpenChange={(open) => open && setWeek(usual)}>
      <Button variant="text" size="sm">
        <SquarePen aria-hidden size={16} />
        Edit usual week
      </Button>
      <Dialog title="Usual week" size="lg">
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action.run(
                  () =>
                    putJson(`/api/staff/${member.id}/usual-week`, {
                      usualWeek: week.map((h) => (Number.isNaN(h) ? 0 : h)),
                    }),
                  "Usual week saved",
                )
              )
                close();
            }}
          >
            <p className="text-sm text-fg-muted">
              The hours they can usually work each day. Days off are 0.
            </p>
            {/* as many days to a row as fit at a readable width: the
                field's − and + buttons alone take 88px */}
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
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Save usual week
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// one day's hours: saved as a day that differs, or, if it differs already,
// back to the usual week
function DayDialog({
  member,
  day,
  usual,
  exception,
  close,
}: {
  member: StaffDetail;
  day: string;
  usual: number;
  exception: StaffDetail["availability"]["exceptions"][number] | undefined;
  close: () => void;
}) {
  const [hours, setHours] = useState(exception?.hours ?? usual);
  const [note, setNote] = useState(exception?.note ?? "");
  const action = useAction("That day wasn't saved. Please try again.");
  const path = `/api/staff/${member.id}/exceptions/${day}`;

  const save = async () => {
    if (
      await action.run(
        () =>
          putJson(path, {
            hours: Number.isNaN(hours) ? 0 : hours,
            note,
          }),
        `${formatDay(day)} saved`,
      )
    )
      close();
  };
  const backToUsual = async () => {
    if (
      await action.run(
        () => deleteJson(path),
        `${formatDay(day)} is back to the usual week`,
        "usual",
      )
    )
      close();
  };

  return (
    <Dialog
      title={formatDay(day)}
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <Form
        validationErrors={action.fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm text-fg-muted">
          Usually {hoursLabel(usual).toLowerCase()} on a{" "}
          {weekdays[weekdayIndex(day)]}.
        </p>
        <NumberField
          label="Hours that day"
          name="hours"
          minValue={0}
          maxValue={24}
          step={0.25}
          formatOptions={hoursFormat}
          value={hours}
          onChange={setHours}
          autoFocus
        />
        <TextField
          label="Note (optional)"
          name="note"
          description="For example, a holiday."
          value={note}
          onChange={setNote}
        />
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          {exception ? (
            <Button
              variant="quiet"
              isPending={action.pending === "usual"}
              onPress={() => void backToUsual()}
            >
              Back to the usual week
            </Button>
          ) : (
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
          )}
          <Button type="submit" isPending={action.pending === "run"}>
            Save day
          </Button>
        </Actions>
      </Form>
    </Dialog>
  );
}

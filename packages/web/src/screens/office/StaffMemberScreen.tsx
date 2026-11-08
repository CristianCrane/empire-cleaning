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
import type {
  StaffDetail,
  StaffHolding,
  StaffRole,
} from "@empire-cleaning/models";
import { hasSiteVisit } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Breadcrumbs,
  Button,
  ButtonLink,
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
import {
  dayOfInstant,
  formatDateTime,
  formatDay,
  roleLabel,
  today,
} from "../format.ts";
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
          {member.name} can't sign in as staff any more. Invite them again to
          bring them back.
        </Notice>
      )}
      {member.active && !isCleaner && (
        <Notice>
          Only cleaners have working hours, so there's nothing to set for{" "}
          {member.name}.
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
                Cleaner: does the cleaning
              </Checkbox>
              <Checkbox
                isSelected={roles.includes("office_staff")}
                onChange={(on) => toggle("office_staff", on)}
              >
                Office staff: runs the business here
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

const jobsOf = (held: StaffHolding[]) => held.filter((h) => h.kind === "job");
const visitsOf = (held: StaffHolding[]) =>
  held.filter((h) => h.kind === "site_visit");

// what they hold on the days a change leaves them no hours. Office Staff
// need none to make a Site Visit, so only a Cleaner's visits are caught.
const heldOnDaysOff = (
  member: StaffDetail,
  isOff: (day: string) => boolean,
) => {
  const held = member.holding.filter((h) => isOff(dayOfInstant(h.startsAt)));
  return {
    jobs: jobsOf(held),
    visits: member.roles.includes("office_staff") ? [] : visitsOf(held),
  };
};

// Hours typed into a field count only once it's left, so saving straight
// from it would free Jobs before the Office saw which. A save that frees
// Jobs they haven't been shown stops there instead, and its Button asks
// again.
const useSecondLook = (jobs: StaffHolding[]) => {
  const freeing = jobs.map((p) => p.id).join();
  const [shown, setShown] = useState("");
  return {
    // whether this press only shows what it frees
    stops: () => {
      if (freeing === "" || freeing === shown) return false;
      setShown(freeing);
      return true;
    },
    label: (save: string) =>
      freeing !== "" && freeing === shown
        ? `Take them off ${jobs.length === 1 ? "it" : "them"} and save`
        : save,
  };
};

// "Deep Clean at 120 Bedford Ave, Tue, Nov 4, 9:00 AM"
const heldLabel = (h: StaffHolding) =>
  `${h.what} at ${h.where}, ${formatDateTime(h.startsAt)}`;

/**
 * What a change frees, said before it's saved (#158, #242): their
 * Assignments there are Released, opening to every other free Cleaner. A Site Visit
 * can't be: it has to go to someone else first, so it blocks the change,
 * and the Notice opens it.
 */
function WhatItFrees({
  member,
  jobs,
  visits,
  saving,
}: {
  member: StaffDetail;
  jobs: StaffHolding[];
  visits: StaffHolding[];
  // what does it: "Saving", "Deactivating"
  saving: string;
}) {
  const [firstName] = member.name.split(" ");
  const [visit] = visits;
  if (visit) {
    return (
      <Notice
        tone="danger"
        action={
          <ButtonLink
            variant="danger-text"
            href={linkTo({
              to: "/office/site-visits/$visitId",
              params: { visitId: visit.id },
            })}
          >
            Open Site Visit
          </ButtonLink>
        }
      >
        <p>
          {hasSiteVisit(
            firstName!,
            visit.where,
            formatDateTime(visit.startsAt),
          )}
        </p>
      </Notice>
    );
  }
  if (jobs.length === 0) return null;
  return (
    <Notice tone="warning">
      {jobs.length === 1 ? (
        <p>
          {firstName} is on {heldLabel(jobs[0]!)}. {saving} opens it to other
          cleaners.
        </p>
      ) : (
        <>
          <p>{firstName} is on:</p>
          <ul className="list-disc ps-5">
            {jobs.map((p) => (
              <li key={p.id}>{heldLabel(p)}</li>
            ))}
          </ul>
          <p>{saving} opens them to other cleaners.</p>
        </>
      )}
    </Notice>
  );
}

function Deactivate({ member }: { member: StaffDetail }) {
  const action = useAction("They weren't deactivated. Please try again.");
  // Office Staff or not, a Site Visit of theirs needs someone else
  const jobs = jobsOf(member.holding);
  const visits = visitsOf(member.holding);

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
              They won't be able to sign in as staff any more. If they're a
              client too, that still works. You can invite them again later.
            </p>
            <WhatItFrees
              member={member}
              jobs={jobs}
              visits={visits}
              saving="Deactivating them"
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                isDisabled={visits.length > 0}
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
      title="Working hours"
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
  // a day that differs keeps its own hours
  const { exceptions } = member.availability;
  const { jobs, visits } = heldOnDaysOff(
    member,
    (day) =>
      !exceptions.some((e) => e.date === day) &&
      !(week[weekdayIndex(day)]! > 0),
  );
  const secondLook = useSecondLook(jobs);

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
              if (secondLook.stops()) return;
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
            <WhatItFrees
              member={member}
              jobs={jobs}
              visits={visits}
              saving="Saving"
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                isPending={action.isPending}
                isDisabled={visits.length > 0}
              >
                {secondLook.label("Save usual week")}
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
  const held = heldOnDaysOff(member, (d) => d === day);
  const none = { jobs: [], visits: [] };
  // what saving frees, or else, on a usual day off, going back to it
  const bySaving = hours > 0 ? none : held;
  const byUsual = exception && usual === 0 ? held : none;
  const secondLook = useSecondLook(bySaving.jobs);

  const save = async () => {
    if (secondLook.stops()) return;
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
        {hours > 0 ? (
          <WhatItFrees
            member={member}
            {...byUsual}
            saving="Going back to the usual week"
          />
        ) : (
          <WhatItFrees member={member} {...bySaving} saving="Saving" />
        )}
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          {exception ? (
            <Button
              variant="quiet"
              isPending={action.pending === "usual"}
              isDisabled={byUsual.visits.length > 0}
              onPress={() => void backToUsual()}
            >
              Back to the usual week
            </Button>
          ) : (
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            isPending={action.pending === "run"}
            isDisabled={bySaving.visits.length > 0}
          >
            {secondLook.label("Save day")}
          </Button>
        </Actions>
      </Form>
    </Dialog>
  );
}

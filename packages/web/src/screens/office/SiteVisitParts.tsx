import { formats } from "@empire-cleaning/models";
import { useState } from "react";
import { CalendarPlus, ClipboardCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  Condition,
  OfficeSiteVisit,
  PremisesTypeChoice,
  PropertyView,
  SiteVisitBooking,
  SiteVisitStatus,
  SiteVisitView,
  StaffMember,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  DatePicker,
  Dialog,
  DialogTrigger,
  Form,
  Notice,
  NumberField,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  TimeField,
  type StatusTone,
  type DialogState,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { useLoaded } from "../load.ts";
import {
  dayOfInstant,
  formatMinutes,
  siteVisitStatusLabel,
  timeOfDay,
  timeOfField,
} from "../format.ts";
import { useAction, type Action } from "../action.ts";
import {
  ConditionField,
  HomeFloorAreaField,
  PetsField,
  PlaceTiles,
  PremisesFloorAreaField,
  PremisesTypeField,
  RoomFields,
} from "./PropertyFields.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";

const { formatDateTime } = formats.en;

// Site Visits (#73, ADR-0015): free visits by one Staff member to see a
// Property before it's quoted. Office Staff book, move and cancel them, and
// record what they found.

const statusTone: Record<SiteVisitStatus, StatusTone> = {
  booked: "info",
  done: "success",
  cancelled: "neutral",
};

export function SiteVisitBadge({ status }: { status: SiteVisitStatus }) {
  return (
    <StatusBadge tone={statusTone[status]}>
      {siteVisitStatusLabel[status]}
    </StatusBadge>
  );
}

// "Tue, Jan 6, 10:00 AM · 30 min · Olive Owner", or for findings recorded
// with no visit, when they were
export const visitSummary = (visit: SiteVisitView) =>
  visit.startsAt
    ? [
        formatDateTime(visit.startsAt),
        formatMinutes(visit.minutes),
        visit.visitor?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : `Findings recorded ${formatDateTime(visit.doneAt!)}, with no visit`;

// everyone active on the Staff, who can make a Site Visit
const useStaff = () => {
  const { value: staff, failed: problem } = useLoaded("staff", () =>
    getJson<StaffMember[]>("/api/staff").then((all) =>
      all.filter((s) => s.active),
    ),
  );
  return { staff, problem };
};

/**
 * When, who visits, and for how long. A Cleaner visiting on a day they work
 * takes room like a one-person Job, so their times without a Cleaner free
 * are marked on the Schedule; Office Staff take no room.
 */
function BookingForm({
  initial,
  submitLabel,
  visitId,
  onSubmit,
  close,
  action,
}: {
  initial?: OfficeSiteVisit;
  submitLabel: string;
  visitId?: string;
  onSubmit: (booking: SiteVisitBooking) => Promise<void>;
  close: () => void;
  action: Action;
}) {
  const { staff, problem } = useStaff();
  const [staffId, setStaffId] = useState(initial?.visitor?.id);
  const [date, setDate] = useState<CalendarDate | null>(
    initial?.startsAt ? parseDate(dayOfInstant(initial.startsAt)) : null,
  );
  const [time, setTime] = useState<Time | null>(
    initial?.startsAt ? parseTime(timeOfDay(initial.startsAt)) : null,
  );
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  const visitor = staff?.find((s) => s.id === staffId);
  const chosen = staffId && date && time && !Number.isNaN(minutes);

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        if (!chosen) return;
        void onSubmit({
          staffId,
          date: date.toString(),
          time: timeOfField(time),
          minutes,
        });
      }}
    >
      {problem && (
        <Notice tone="danger">
          The staff list didn't load. Please try again.
        </Notice>
      )}
      <Select
        label="Who visits"
        name="staffId"
        placeholder={staff ? "Pick someone" : "Loading…"}
        selectedKey={staffId ?? null}
        onSelectionChange={(key) => setStaffId(String(key))}
      >
        {(staff ?? []).map((s) => (
          <SelectItem key={s.id} id={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </Select>
      {/* as many to a row as fit the dialog, not the screen: three squeeze
          the date and the stepper out of sight */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        <DatePicker label="Day" name="date" value={date} onChange={setDate} />
        <TimeField
          label="Start time"
          name="time"
          description="New York time."
          value={time}
          onChange={setTime}
        />
        <NumberField
          label="How long, in minutes"
          name="minutes"
          minValue={15}
          maxValue={480}
          step={15}
          value={minutes}
          onChange={setMinutes}
        />
      </div>
      <PickFromSchedule
        date={date?.toString()}
        time={timeOfField(time)}
        hoursOnSite={minutes / 60}
        crew={
          visitor?.roles.includes("cleaner")
            ? { labourHours: minutes / 60, crewSize: 1, siteVisitId: visitId }
            : undefined
        }
        current={
          initial?.startsAt
            ? {
                date: dayOfInstant(initial.startsAt),
                time: timeOfDay(initial.startsAt),
              }
            : undefined
        }
        label="Site visit"
        inline
        onPick={(at) => {
          setDate(parseDate(at.date));
          setTime(parseTime(at.time));
        }}
      />
      <p className="text-sm text-fg-muted">
        {visitor?.roles.includes("cleaner")
          ? "A cleaner's visit uses their working hours that day. "
          : visitor
            ? "Office staff visits don't use any cleaner hours. "
            : ""}
        We'll email the client, who can call us to change it.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending} isDisabled={!chosen}>
          {submitLabel}
        </Button>
      </Actions>
    </Form>
  );
}

export const BOOK_A_SITE_VISIT = "Book a site visit";

// books a Site Visit for a Quote, at its Property, then opens it: a page
// action's dialog (the Quote's), or BookSiteVisit's
export function BookSiteVisitDialog({
  quoteId,
  ...state
}: { quoteId: string } & DialogState) {
  const navigate = useNavigate();
  const action = useAction("The site visit wasn't booked. Please try again.");
  return (
    <Dialog title={BOOK_A_SITE_VISIT} size="wide" {...state}>
      {({ close }) => (
        <BookingForm
          submitLabel="Book site visit"
          action={action}
          close={close}
          onSubmit={async (booking) => {
            let booked: OfficeSiteVisit | undefined;
            await action.run(async () => {
              booked = await postJson<OfficeSiteVisit>("/api/site-visits", {
                ...booking,
                quoteId,
              });
            }, "Site visit booked");
            if (booked) {
              close();
              await navigate({
                to: "/office/site-visits/$visitId",
                params: { visitId: booked.id },
              });
            }
          }}
        />
      )}
    </Dialog>
  );
}

// the same, from its own button: on a part (a home's Site visit) or in a
// Notice
export function BookSiteVisit({
  quoteId,
  primary = false,
}: {
  quoteId: string;
  primary?: boolean;
}) {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={primary ? "primary" : "text"}
        size={primary ? "md" : "sm"}
        onPress={() => setOpen(true)}
      >
        <CalendarPlus aria-hidden size={primary ? 18 : 16} />
        {BOOK_A_SITE_VISIT}
      </Button>
      <BookSiteVisitDialog
        quoteId={quoteId}
        isOpen={isOpen}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function MoveSiteVisit({
  visit,
  ...state
}: { visit: OfficeSiteVisit } & DialogState) {
  const action = useAction("The site visit wasn't changed. Please try again.");
  return (
    <Dialog title="Move this site visit" size="wide" {...state}>
      {({ close }) => (
        <BookingForm
          initial={visit}
          visitId={visit.id}
          submitLabel="Save and tell the client"
          action={action}
          close={close}
          onSubmit={async (booking) => {
            if (
              await action.run(
                () => postJson(`/api/site-visits/${visit.id}/move`, booking),
                "Site visit changed",
              )
            )
              close();
          }}
        />
      )}
    </Dialog>
  );
}

export function CancelSiteVisit({
  visit,
  ...state
}: { visit: OfficeSiteVisit } & DialogState) {
  const action = useAction(
    "The site visit wasn't cancelled. Please try again.",
  );
  return (
    <Dialog title="Cancel this site visit?" role="alertdialog" {...state}>
      {({ close }) => (
        <>
          <p>
            We'll email the client that it's cancelled. Book another when
            they're ready.
          </p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              Keep it
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={async () => {
                if (
                  await action.run(
                    () => postJson(`/api/site-visits/${visit.id}/cancel`),
                    "Site visit cancelled",
                  )
                )
                  close();
              }}
            >
              Cancel site visit
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

/**
 * What a visit found, pre-filled from the Property as it is: business
 * premises' Premises Type, floor area and Condition, or a home's rooms and
 * Condition, with the Office's notes. Saving updates the Property.
 */
function FindingsForm({
  property,
  officeNotes,
  premisesTypes,
  submitLabel,
  onSubmit,
  close,
  action,
}: {
  property: PropertyView;
  officeNotes: string | null;
  premisesTypes: PremisesTypeChoice[];
  submitLabel: string;
  onSubmit: (findings: object) => Promise<void>;
  close: () => void;
  action: Action;
}) {
  const [condition, setCondition] = useState<Condition | null>(
    property.condition,
  );
  const [notes, setNotes] = useState(officeNotes ?? "");
  const [floorArea, setFloorArea] = useState(property.floorArea ?? Number.NaN);
  const [premisesType, setPremisesType] = useState(
    property.kind === "commercial" ? property.premisesType.key : undefined,
  );
  const [home, setHome] = useState(
    property.kind === "residential"
      ? {
          type: property.type,
          // a home not yet described by its rooms: the visit counts them
          bedrooms: property.bedrooms ?? Number.NaN,
          bathrooms: property.bathrooms ?? Number.NaN,
          storeys: property.storeys ?? Number.NaN,
          pets: property.pets ?? false,
        }
      : undefined,
  );
  const area = Number.isNaN(floorArea) ? null : floorArea;
  const choices =
    property.kind === "commercial" &&
    !premisesTypes.some((t) => t.key === property.premisesType.key)
      ? [property.premisesType, ...premisesTypes]
      : premisesTypes;

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          ...(home ?? { premisesType }),
          floorArea: area,
          condition,
          officeNotes: notes,
        });
      }}
    >
      {property.kind === "commercial" ? (
        <>
          <PlaceTiles value="commercial" />
          <PremisesTypeField
            value={premisesType ?? null}
            choices={choices}
            onChange={setPremisesType}
          />
          <PremisesFloorAreaField
            value={floorArea}
            onChange={setFloorArea}
            isRequired
          />
        </>
      ) : (
        home && (
          <>
            <PlaceTiles
              value={home.type}
              onChange={(type) => setHome({ ...home, type })}
            />
            <RoomFields
              rooms={home}
              onChange={(room, count) => setHome({ ...home, [room]: count })}
              isRequired
            />
            <HomeFloorAreaField value={floorArea} onChange={setFloorArea} />
            <PetsField
              value={home.pets}
              onChange={(pets) => setHome({ ...home, pets })}
            />
          </>
        )
      )}
      <ConditionField value={condition} onChange={setCondition} />
      <TextField
        label="Office notes (optional)"
        name="officeNotes"
        description="Only office staff see these."
        multiline
        value={notes}
        onChange={setNotes}
      />
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending}>
          {submitLabel}
        </Button>
      </Actions>
    </Form>
  );
}

// records a booked visit's findings, and it's Done
export function RecordFindings({
  visit,
  premisesTypes,
  primary = true,
}: {
  visit: OfficeSiteVisit;
  premisesTypes: PremisesTypeChoice[];
  // the page's one thing to do once the visit has been; before, secondary
  primary?: boolean;
}) {
  const action = useAction("The findings weren't saved. Please try again.");
  return (
    <DialogTrigger>
      <Button variant={primary ? "primary" : "secondary"}>
        <ClipboardCheck aria-hidden size={18} />
        Record findings
      </Button>
      <Dialog title="What the site visit found" size="lg">
        {({ close }) => (
          <FindingsForm
            property={visit.property}
            officeNotes={visit.officeNotes}
            premisesTypes={premisesTypes}
            submitLabel="Save findings"
            action={action}
            close={close}
            onSubmit={async (findings) => {
              if (
                await action.run(
                  () =>
                    postJson(`/api/site-visits/${visit.id}/findings`, findings),
                  "Findings recorded",
                )
              )
                close();
            }}
          />
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// for premises the Office already knows, such as an existing Client's: the
// findings, with no visit booked
export function RecordFindingsWithoutVisit({
  property,
  officeNotes,
  premisesTypes,
}: {
  property: PropertyView;
  officeNotes: string | null;
  premisesTypes: PremisesTypeChoice[];
}) {
  const action = useAction("The findings weren't saved. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="secondary">Record findings without a visit</Button>
      <Dialog title="Record findings without a visit" size="lg">
        {({ close }) => (
          <>
            <p className="text-sm text-fg-muted">
              For a place you already know. It counts as a done site visit, so
              you can send a quote.
            </p>
            <FindingsForm
              property={property}
              officeNotes={officeNotes}
              premisesTypes={premisesTypes}
              submitLabel="Save findings"
              action={action}
              close={close}
              onSubmit={async (findings) => {
                if (
                  await action.run(
                    () =>
                      postJson(
                        `/api/properties/${property.id}/findings`,
                        findings,
                      ),
                    "Findings recorded",
                  )
                )
                  close();
              }}
            />
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

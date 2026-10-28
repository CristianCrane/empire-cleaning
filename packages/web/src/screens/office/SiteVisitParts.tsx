import { useEffect, useState } from "react";
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
  PropertyType,
  PropertyView,
  SiteVisitBooking,
  SiteVisitStatus,
  SiteVisitView,
  StaffMember,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  DialogTrigger,
  Form,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
  TimeField,
  type StatusTone,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import {
  dayOfInstant,
  formatDateTime,
  formatMinutes,
  siteVisitStatusLabel,
  timeOfDay,
} from "../format.ts";
import { useAction, type Action } from "../action.ts";
import { PickFromSchedule } from "./SchedulePicker.tsx";

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
  const [staff, setStaff] = useState<StaffMember[]>();
  const [problem, setProblem] = useState(false);
  useEffect(() => {
    let current = true;
    getJson<StaffMember[]>("/api/staff")
      .then((all) => current && setStaff(all.filter((s) => s.active)))
      .catch(() => current && setProblem(true));
    return () => {
      current = false;
    };
  }, []);
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
          time: time.toString().slice(0, 5),
          minutes,
        });
      }}
    >
      {problem && (
        <Notice tone="danger">
          The Staff couldn't be loaded. Please try again.
        </Notice>
      )}
      <Select
        label="Who visits"
        name="staffId"
        placeholder={staff ? "Choose someone" : "Loading…"}
        selectedKey={staffId ?? null}
        onSelectionChange={(key) => setStaffId(String(key))}
      >
        {(staff ?? []).map((s) => (
          <SelectItem key={s.id} id={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-3">
        <DatePicker label="Day" name="date" value={date} onChange={setDate} />
        <TimeField
          label="Start time"
          name="time"
          description="New York time."
          value={time}
          onChange={setTime}
        />
        <NumberField
          label="Length in minutes"
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
        time={time?.toString().slice(0, 5)}
        hoursOnSite={minutes / 60}
        crew={
          visitor?.roles.includes("cleaner")
            ? { crewSize: 1, siteVisitId: visitId }
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
        label="Site Visit"
        onPick={(at) => {
          setDate(parseDate(at.date));
          setTime(parseTime(at.time));
        }}
      />
      <p className="text-sm text-fg-muted">
        {visitor?.roles.includes("cleaner")
          ? "A Cleaner's visit takes their hours that day, like a one-person Job. "
          : visitor
            ? "Office Staff's visits take no Cleaner hours. "
            : ""}
        The Client is emailed, and calls to change it.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending} isDisabled={!chosen}>
          {submitLabel}
        </Button>
      </Actions>
    </Form>
  );
}

// books a Site Visit for a Quote, at its Property, then opens it
export function BookSiteVisit({
  quoteId,
  primary = false,
}: {
  quoteId: string;
  primary?: boolean;
}) {
  const navigate = useNavigate();
  const action = useAction("The Site Visit wasn't booked. Please try again.");
  return (
    <DialogTrigger>
      <Button variant={primary ? "primary" : "secondary"}>
        Book a Site Visit
      </Button>
      <Dialog title="Book a Site Visit">
        {({ close }) => (
          <BookingForm
            submitLabel="Book Site Visit"
            action={action}
            close={close}
            onSubmit={async (booking) => {
              let booked: OfficeSiteVisit | undefined;
              await action.run(async () => {
                booked = await postJson<OfficeSiteVisit>("/api/site-visits", {
                  ...booking,
                  quoteId,
                });
              }, "Site Visit booked");
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
    </DialogTrigger>
  );
}

export function MoveSiteVisit({ visit }: { visit: OfficeSiteVisit }) {
  const action = useAction("The Site Visit wasn't changed. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="secondary">Move or change</Button>
      <Dialog title="Move this Site Visit">
        {({ close }) => (
          <BookingForm
            initial={visit}
            visitId={visit.id}
            submitLabel="Save and tell the Client"
            action={action}
            close={close}
            onSubmit={async (booking) => {
              if (
                await action.run(
                  () => postJson(`/api/site-visits/${visit.id}/move`, booking),
                  "Site Visit changed",
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

export function CancelSiteVisit({ visit }: { visit: OfficeSiteVisit }) {
  const action = useAction(
    "The Site Visit wasn't cancelled. Please try again.",
  );
  return (
    <DialogTrigger>
      <Button variant="secondary">Cancel visit</Button>
      <Dialog title="Cancel this Site Visit?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              The Client is emailed that it's cancelled. Book another when
              they're ready.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={async () => {
                  if (
                    await action.run(
                      () => postJson(`/api/site-visits/${visit.id}/cancel`),
                      "Site Visit cancelled",
                    )
                  )
                    close();
                }}
              >
                Cancel Site Visit
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

const conditionChoices = (
  <>
    <SelectItem id="light">Light</SelectItem>
    <SelectItem id="moderate">Moderate</SelectItem>
    <SelectItem id="heavy">Heavy</SelectItem>
  </>
);

/**
 * What a visit found, pre-filled from the Property as it is: business
 * premises' Premises Type, floor area and Condition, or a home's rooms and
 * Condition, with the Office's notes. Saving updates the Property.
 */
export function FindingsForm({
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
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          storeys: property.storeys,
          pets: property.pets,
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
          <Select
            label="Type of premises"
            name="premisesType"
            selectedKey={premisesType ?? null}
            onSelectionChange={(key) => setPremisesType(String(key))}
          >
            {choices.map((t) => (
              <SelectItem key={t.key} id={t.key}>
                {t.name}
              </SelectItem>
            ))}
          </Select>
          <NumberField
            label="Floor area in sq ft"
            name="floorArea"
            isRequired
            minValue={100}
            maxValue={1_000_000}
            step={100}
            value={floorArea}
            onChange={setFloorArea}
          />
        </>
      ) : (
        home && (
          <>
            <RadioGroup
              label="Type of home"
              orientation="horizontal"
              value={home.type}
              onChange={(type) =>
                setHome({ ...home, type: type as PropertyType })
              }
            >
              <Radio value="house">House</Radio>
              <Radio value="apartment">Apartment</Radio>
              <Radio value="townhouse">Townhouse</Radio>
            </RadioGroup>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
              <NumberField
                label="Bedrooms"
                name="bedrooms"
                minValue={0}
                maxValue={20}
                value={home.bedrooms}
                onChange={(bedrooms) => setHome({ ...home, bedrooms })}
              />
              <NumberField
                label="Bathrooms"
                name="bathrooms"
                minValue={0.5}
                maxValue={20}
                step={0.5}
                value={home.bathrooms}
                onChange={(bathrooms) => setHome({ ...home, bathrooms })}
              />
              <NumberField
                label="Floors"
                name="storeys"
                minValue={1}
                maxValue={5}
                value={home.storeys}
                onChange={(storeys) => setHome({ ...home, storeys })}
              />
            </div>
            <NumberField
              label="Floor area in sq ft (optional)"
              name="floorArea"
              minValue={100}
              maxValue={100_000}
              step={50}
              value={floorArea}
              onChange={setFloorArea}
            />
            <Checkbox
              isSelected={home.pets}
              onChange={(pets) => setHome({ ...home, pets })}
            >
              There are pets at home
            </Checkbox>
          </>
        )
      )}
      <Select
        label="Condition"
        name="condition"
        placeholder="Choose one"
        selectedKey={condition}
        onSelectionChange={(key) => setCondition(key as Condition)}
      >
        {conditionChoices}
      </Select>
      <TextField
        label="Office notes (optional)"
        name="officeNotes"
        description="Only Office Staff see these."
        multiline
        value={notes}
        onChange={setNotes}
      />
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={close}>
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
}: {
  visit: OfficeSiteVisit;
  premisesTypes: PremisesTypeChoice[];
}) {
  const action = useAction("The findings weren't saved. Please try again.");
  return (
    <DialogTrigger>
      <Button>Record findings</Button>
      <Dialog title="What the Site Visit found">
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
      <Dialog title="Record findings without a visit">
        {({ close }) => (
          <>
            <p className="text-sm text-fg-muted">
              For premises you know already. It counts as a Site Visit Done, so
              a Quote can be sent.
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

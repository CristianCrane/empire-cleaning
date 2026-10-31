import { useState } from "react";
import { CalendarCheck, CalendarClock, CalendarSync } from "lucide-react";
import type { OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  IconAction,
  Notice,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { formatDateTime } from "../format.ts";
import { ChooseNewTime, costForOffice } from "../RescheduleParts.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import type { TimePickerProps } from "../CalendarGrid.tsx";
import { useAction } from "../action.ts";
import { MoveJob } from "./JobMove.tsx";

// the Schedule in the dialog itself, never a dialog on a dialog (#96)
const PickInSchedule = (props: TimePickerProps) => (
  <PickFromSchedule {...props} inline />
);

// Office Staff move the Job themselves, at no charge to the Client, or ask
// for a new time on the Client's behalf, e.g. by phone, so moving costs
// what it would cost them. Neither while a request waits for an answer.
export function MoveActions({ job }: { job: OfficeJob }) {
  const terms = job.rescheduleTerms;
  if (!terms) return null;
  const onPlan = job.servicePlanId !== null;
  return (
    <>
      <MoveJob
        job={job}
        trigger={<IconAction icon={CalendarSync} label="Move Job" />}
      />
      <ChooseNewTime
        job={job}
        terms={terms}
        base={`/api/jobs/${job.id}`}
        label="Ask for a new time"
        describeCost={(cost, feeCents) => costForOffice(cost, feeCents, onPlan)}
        done="Reschedule Request made"
        Picker={PickInSchedule}
        size="wide"
        trigger={<IconAction icon={CalendarClock} label="Ask for a new time" />}
      />
    </>
  );
}

// Office Staff confirm or turn down a pending Reschedule Request, in a
// dialog: the one action of its Notice. Turning it down asks why, as a
// step in the same dialog.
export function AnswerRequest({ job }: { job: OfficeJob }) {
  const [turningDown, setTurningDown] = useState(false);
  return (
    <DialogTrigger onOpenChange={(open) => !open && setTurningDown(false)}>
      <Button variant="text" size="sm">
        <CalendarCheck aria-hidden size={16} />
        Answer
      </Button>
      <Dialog
        title={turningDown ? "Turn down this request?" : "Move this Job?"}
        role={turningDown ? "alertdialog" : "dialog"}
      >
        {({ close }) =>
          turningDown ? (
            <TurnDown
              job={job}
              close={close}
              back={() => setTurningDown(false)}
            />
          ) : (
            <Confirm
              job={job}
              close={close}
              turnDown={() => setTurningDown(true)}
            />
          )
        }
      </Dialog>
    </DialogTrigger>
  );
}

const pathOf = (job: OfficeJob) => `/api/jobs/${job.id}/reschedule-request`;

function Confirm({
  job,
  close,
  turnDown,
}: {
  job: OfficeJob;
  close: () => void;
  turnDown: () => void;
}) {
  const request = job.rescheduleRequest!;
  const action = useAction("That didn't work. Please try again.");
  return (
    <>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">From</dt>
        <dd>{formatDateTime(request.fromStartsAt)}</dd>
        <dt className="font-semibold">To</dt>
        <dd>{formatDateTime(request.startsAt)}</dd>
        <dt className="font-semibold">Cost</dt>
        <dd>
          {costForOffice(
            request.cost,
            request.feeCents,
            job.servicePlanId !== null,
          )}
        </dd>
      </dl>
      <p className="text-sm text-fg-muted">
        Confirming moves the Job and Offers it afresh to its crew. The Client
        and the crew are emailed.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={turnDown}>
          Turn down
        </Button>
        <Button
          isPending={action.isPending}
          onPress={() =>
            void action
              .run(() => postJson(`${pathOf(job)}/confirm`), "Job moved")
              .then((ok) => ok && close())
          }
        >
          Confirm move
        </Button>
      </Actions>
    </>
  );
}

function TurnDown({
  job,
  close,
  back,
}: {
  job: OfficeJob;
  close: () => void;
  back: () => void;
}) {
  const [reason, setReason] = useState("");
  const action = useAction("The request wasn't turned down. Please try again.");

  const turnDown = async () => {
    if (
      await action.run(
        () => postJson(`${pathOf(job)}/turn-down`, { reason }),
        "Request turned down",
      )
    )
      close();
  };

  return (
    <>
      <p>
        The Job keeps its current time, the held hours are freed, and there's no
        charge.
      </p>
      <TextField
        label="Why? (told to the Client, optional)"
        value={reason}
        onChange={setReason}
        multiline
      />
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={back}>
          Back
        </Button>
        <Button
          variant="danger"
          isPending={action.isPending}
          onPress={() => void turnDown()}
        >
          Turn down
        </Button>
      </Actions>
    </>
  );
}

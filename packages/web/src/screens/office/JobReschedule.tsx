import { formats } from "@empire-cleaning/models";
import { useState } from "react";
import { CalendarCheck, CalendarClock, Banknote } from "lucide-react";
import type { OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
  TextField,
  Fact,
  Facts,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { ChooseNewTime, costForOffice } from "../RescheduleParts.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import type { TimePickerProps } from "../CalendarGrid.tsx";
import { useAction } from "../action.ts";

const { formatDateTime } = formats.en;

// the Schedule in the dialog itself, never a dialog on a dialog (#96)
const PickInSchedule = (props: TimePickerProps) => (
  <PickFromSchedule {...props} inline />
);

// Office Staff ask for a new time on the Client's behalf, e.g. by phone, so
// moving costs what it would cost them (moving it themselves is MoveJob, at
// no charge). Neither while a request waits for an answer: then the Job has
// no rescheduleTerms
export function AskForNewTime({
  job,
  isOpen,
  onOpenChange,
}: {
  job: OfficeJob;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const terms = job.rescheduleTerms;
  if (!terms) return null;
  return (
    <ChooseNewTime
      job={job}
      terms={terms}
      base={`/api/jobs/${job.id}`}
      describeCost={(cost, feeCents) => costForOffice(cost, feeCents, job)}
      done="Request to move sent"
      Picker={PickInSchedule}
      size="wide"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
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
        title={turningDown ? "Turn down this request?" : "Move this job?"}
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
      <Facts>
        <Fact
          icon={CalendarClock}
          label="From"
          value={formatDateTime(request.fromStartsAt)}
        />
        <Fact
          icon={CalendarCheck}
          label="To"
          value={formatDateTime(request.startsAt)}
        />
        <Fact
          icon={Banknote}
          label="Cost"
          value={costForOffice(request.cost, request.feeCents, job)}
        />
      </Facts>
      <p className="text-sm text-fg-muted">
        Its cleaners are asked to confirm the new time, and we'll email them and
        the client.
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
      <p>The job stays at its current time, and there's no charge.</p>
      <TextField
        label="Why? (optional, we'll tell the client)"
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

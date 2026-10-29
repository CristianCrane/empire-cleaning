import { useState } from "react";
import { CalendarClock } from "lucide-react";
import type { OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { formatDateTime } from "../format.ts";
import { ChooseNewTime, costForOffice } from "../RescheduleParts.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import { useAction } from "../action.ts";
import { MoveJob } from "./JobMove.tsx";

// Office Staff move the Job themselves, at no charge to the Client, or ask
// for a new time on the Client's behalf, e.g. by phone, so moving costs
// what it would cost them. Neither while a request waits for an answer.
export function MoveActions({ job }: { job: OfficeJob }) {
  const terms = job.rescheduleTerms;
  if (!terms) return null;
  const onPlan = job.servicePlanId !== null;
  return (
    <>
      <MoveJob job={job} variant="text" />
      <ChooseNewTime
        job={job}
        terms={terms}
        base={`/api/jobs/${job.id}`}
        label="Ask for a new time"
        describeCost={(cost, feeCents) => costForOffice(cost, feeCents, onPlan)}
        done="Reschedule Request made"
        Picker={PickFromSchedule}
        variant="text"
      />
    </>
  );
}

// Office Staff confirm or turn down a pending Reschedule Request, in a
// dialog: the one action of its Notice
export function AnswerRequest({ job }: { job: OfficeJob }) {
  const request = job.rescheduleRequest!;
  const path = `/api/jobs/${job.id}/reschedule-request`;
  const action = useAction("That didn't work. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <CalendarClock aria-hidden size={16} />
        Answer
      </Button>
      <Dialog title="Move this Job?">
        {({ close }) => (
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
              Confirming moves the Job and Offers every place on it afresh. The
              Client and the crew are emailed.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <TurnDown path={`${path}/turn-down`} />
              <Button
                isPending={action.isPending}
                onPress={() =>
                  void action
                    .run(() => postJson(`${path}/confirm`), "Job moved")
                    .then((ok) => ok && close())
                }
              >
                Confirm move
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

function TurnDown({ path }: { path: string }) {
  const [reason, setReason] = useState("");
  const action = useAction("The request wasn't turned down. Please try again.");

  const turnDown = async (close: () => void) => {
    if (
      await action.run(() => postJson(path, { reason }), "Request turned down")
    )
      close();
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">Turn down</Button>
      <Dialog title="Turn down this request?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              The Job keeps its current time, the held hours are freed, and
              there's no charge.
            </p>
            <TextField
              label="Why? (told to the Client, optional)"
              value={reason}
              onChange={setReason}
              multiline
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void turnDown(close)}
              >
                Turn down
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

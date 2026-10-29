import { useState } from "react";
import type { OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
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

const answered = {
  confirmed: "Moved",
  turned_down: "Turned down",
  withdrawn: "Withdrawn by the Client",
};

// Office Staff confirm or turn down a pending Reschedule Request; otherwise
// they move the Job themselves, or ask for a new time on the Client's behalf,
// e.g. by phone
export function JobReschedule({ job }: { job: OfficeJob }) {
  const request = job.rescheduleRequest;
  const onPlan = job.servicePlanId !== null;
  const action = useAction("That didn't work. Please try again.");

  if (request?.status === "pending") {
    const path = `/api/jobs/${job.id}/reschedule-request`;
    return (
      <Card
        title="Reschedule Request"
        description={`Asked ${formatDateTime(request.requestedAt)}${request.byClient ? " by the Client" : " by the Office"}. The new time is held until you answer.`}
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">From</dt>
          <dd>{formatDateTime(request.fromStartsAt)}</dd>
          <dt className="font-semibold">To</dt>
          <dd>{formatDateTime(request.startsAt)}</dd>
          <dt className="font-semibold">Cost</dt>
          <dd>{costForOffice(request.cost, request.feeCents, onPlan)}</dd>
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
              void action.run(() => postJson(`${path}/confirm`), "Job moved")
            }
          >
            Confirm move
          </Button>
        </Actions>
      </Card>
    );
  }

  const terms = job.rescheduleTerms;
  if (!terms) return null;
  return (
    <Card
      title="Moving"
      description={`Moving is free until ${formatDateTime(terms.freeUntil)}.`}
    >
      {request && (
        <p className="text-sm text-fg-muted">
          Last request: {formatDateTime(request.fromStartsAt)} to{" "}
          {formatDateTime(request.startsAt)}, {answered[request.status]}
          {request.answeredAt && ` ${formatDateTime(request.answeredAt)}`}.
        </p>
      )}
      <p>If asked now: {costForOffice(terms.cost, terms.feeCents, onPlan)}</p>
      <p className="text-sm text-fg-muted">
        Move Job moves it straight away, at no charge to the Client. If the
        Client has asked to move it, ask for a new time for them instead, so
        moving costs what it would cost them.
      </p>
      <Actions>
        <MoveJob job={job} />
        <ChooseNewTime
          job={job}
          terms={terms}
          base={`/api/jobs/${job.id}`}
          label="Ask for a new time"
          describeCost={(cost, feeCents) =>
            costForOffice(cost, feeCents, onPlan)
          }
          done="Reschedule Request made"
          Picker={PickFromSchedule}
        />
      </Actions>
    </Card>
  );
}

export function TurnDown({ path }: { path: string }) {
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

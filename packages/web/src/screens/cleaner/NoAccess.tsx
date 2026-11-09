import { formats } from "@empire-cleaning/models";
import { useState } from "react";
import { DoorClosed } from "lucide-react";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Notice,
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";

const { formatTime } = formats.en;

// The Cleaner couldn't get into the home. Recording it ends the Job without
// it being Completed, and the Client and the Office are told; the Office
// sorts out what's next.
export function RecordNoAccess({ job }: { job: CleanerJob }) {
  const [reason, setReason] = useState("");
  const action = useAction("That didn't go through. Please try again.");

  const record = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/assignments/mine/${job.id}/no-access`, { reason }),
      "Sent",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="danger-text">
        <DoorClosed aria-hidden size={18} />
        Couldn't get in
      </Button>
      <Dialog title="Couldn't get in?" role="alertdialog">
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void record(close);
            }}
          >
            <p>
              Check how we get in, and try calling the client first. The job
              won't be marked done, and the client and the office are told what
              happened.
            </p>
            <TextField
              label="What happened?"
              name="reason"
              description="For example: nobody answered, and the key wasn't where the instructions say."
              value={reason}
              onChange={setReason}
              multiline
              isRequired
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Go back
              </Button>
              <Button
                type="submit"
                variant="danger"
                isPending={action.isPending}
              >
                Send
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// what was recorded, once it's No Access
export function NoAccessRecorded({ job }: { job: CleanerJob }) {
  const noAccess = job.noAccess!;
  return (
    <Section title="Couldn't get in">
      <Card>
        <p>
          Sent at {formatTime(noAccess.recordedAt)}
          {noAccess.recordedBy && ` by ${noAccess.recordedBy}`}. The client and
          the office have been told.
        </p>
        <p>"{noAccess.reason}"</p>
      </Card>
    </Section>
  );
}

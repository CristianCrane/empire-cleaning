import { useState } from "react";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Notice,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { formatTime } from "../format.ts";

// The Cleaner couldn't get into the home. Recording it ends the Job without
// it being Completed, and the Client and the Office are told; the Office
// sorts out what's next.
export function RecordNoAccess({ job }: { job: CleanerJob }) {
  const [reason, setReason] = useState("");
  const action = useAction("No Access wasn't recorded. Please try again.");

  const record = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/assignments/mine/${job.id}/no-access`, { reason }),
      "No Access recorded",
    );
    if (ok) close();
  };

  return (
    <Card
      title="Can't get in?"
      description="Check the Access Instructions and try the Client's phone first."
    >
      <Actions>
        <DialogTrigger>
          <Button variant="secondary">Record No Access</Button>
          <Dialog title="Record No Access?" role="alertdialog">
            {({ close }) => (
              <Form
                validationErrors={action.fieldErrors}
                onSubmit={(e) => {
                  e.preventDefault();
                  void record(close);
                }}
              >
                <p>
                  The Job won't be Completed. The Client and the Office are told
                  what happened.
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
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button variant="secondary" onPress={close}>
                    Go back
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    isPending={action.isPending}
                  >
                    Record No Access
                  </Button>
                </Actions>
              </Form>
            )}
          </Dialog>
        </DialogTrigger>
      </Actions>
    </Card>
  );
}

// what was recorded, once it's No Access
export function NoAccessRecorded({ job }: { job: CleanerJob }) {
  const noAccess = job.noAccess!;
  return (
    <Card title="No Access">
      <p>
        Recorded at {formatTime(noAccess.recordedAt)}
        {noAccess.recordedBy && ` by ${noAccess.recordedBy}`}. The Client and
        the Office have been told.
      </p>
      <p>"{noAccess.reason}"</p>
    </Card>
  );
}

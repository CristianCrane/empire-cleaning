import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { formatTime } from "../format.ts";

// The Cleaner couldn't get into the home. Recording it ends the Job without
// it being Completed, and the Client and the Office are told; the Office
// sorts out what's next.
export function RecordNoAccess({ job }: { job: CleanerJob }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const record = async (close: () => void) => {
    setPending(true);
    setProblem(undefined);
    setFieldErrors({});
    try {
      await postJson(`/api/assignments/mine/${job.id}/no-access`, { reason });
      showToast({ tone: "success", title: "No Access recorded" });
      close();
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
      } else {
        setProblem(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "No Access wasn't recorded. Please try again.",
        );
      }
    } finally {
      setPending(false);
    }
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
                validationErrors={fieldErrors}
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
                {problem && <Notice tone="danger">{problem}</Notice>}
                <Actions>
                  <Button variant="secondary" onPress={close}>
                    Go back
                  </Button>
                  <Button type="submit" variant="danger" isPending={isPending}>
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

import { catalog, oneStop, theTimeEs } from "@empire-cleaning/models";
import { useState } from "react";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  Form,
  Facts,
  Notice,
  TextField,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { useSaid } from "../words.ts";
import { byWhom } from "./CompleteJob.tsx";
import { AccessFact, ClientNumberFact } from "./JobLead.tsx";

const words = catalog({
  en: {
    notSent: "That didn't go through. Please try again.",
    sent: "Sent",
    told: "The job won't be marked done, and the client and the office are told what happened.",
    whatHappened: "What happened?",
    example:
      "The client reads it as you write it. For example: nobody answered, and the key wasn't where we were told.",
    youSent: (time: string) =>
      `You sent this at ${time}. The client and the office have been told.`,
    theySent: (name: string, time: string) =>
      `${name} sent this at ${time}. The client and the office have been told.`,
    sentAt: (time: string) =>
      `Sent at ${time}. The client and the office have been told.`,
  },
  es: {
    notSent: "No se envió. Vuelve a intentarlo.",
    sent: "Enviado",
    told: "El trabajo no se marcará como terminado, y se les avisa al cliente y a la oficina lo que pasó.",
    whatHappened: "¿Qué pasó?",
    example:
      "El cliente lo lee tal como lo escribes. Por ejemplo: nadie contestó, y la llave no estaba donde nos dijeron.",
    youSent: (time: string) =>
      oneStop(
        `Lo enviaste a ${theTimeEs(time)}. Ya se les avisó al cliente y a la oficina.`,
      ),
    theySent: (name: string, time: string) =>
      oneStop(
        `${name} lo envió a ${theTimeEs(time)}. Ya se les avisó al cliente y a la oficina.`,
      ),
    sentAt: (time: string) =>
      oneStop(
        `Enviado a ${theTimeEs(time)}. Ya se les avisó al cliente y a la oficina.`,
      ),
  },
});

// The Cleaner couldn't get into the home. Recording it ends the Job without
// it being Completed, and the Client and the Office are told; the Office
// sorts out what's next. Behind the page's split button on site, its sheet
// shows the two things to try first, how we get in and the client's
// number, rather than sending them back to the page for them
export function RecordNoAccess({
  job,
  ...state
}: { job: CleanerJob } & DialogState) {
  const [reason, setReason] = useState("");
  const t = useSaid(words);
  const { c, w } = t;
  const action = useAction(w.notSent);

  const record = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/assignments/mine/${job.id}/no-access`, { reason }),
      w.sent,
    );
    if (ok) close();
  };

  return (
    <Dialog title={t.jobStatusLabel.no_access} role="alertdialog" {...state}>
      {({ close }) => (
        <Form
          validationErrors={action.fieldErrors}
          onSubmit={(e) => {
            e.preventDefault();
            void record(close);
          }}
        >
          {job.onTheDay && (
            <Facts>
              <AccessFact note={job.onTheDay.accessInstructions} />
              <ClientNumberFact phone={job.onTheDay.phone} />
            </Facts>
          )}
          <p>{w.told}</p>
          <TextField
            label={w.whatHappened}
            name="reason"
            description={w.example}
            value={reason}
            onChange={setReason}
            multiline
            isRequired
          />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {c.goBack}
            </Button>
            <Button type="submit" variant="danger" isPending={action.isPending}>
              {t.send}
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
  );
}

// what was sent, once it's No Access, first on the page: who sent it, as
// the reader calls them, and their words as a quote
export function NoAccessRecorded({ job }: { job: CleanerJob }) {
  const noAccess = job.noAccess!;
  const t = useSaid(words);
  const { w } = t;
  const at = t.formatTime(noAccess.recordedAt);
  return (
    <Card hiddenTitle={t.jobStatusLabel.no_access}>
      <p className="text-lg">
        {byWhom(noAccess.recordedBy, {
          anyone: w.sentAt(at),
          you: w.youSent(at),
          them: (name) => w.theySent(name, at),
        })}
      </p>
      <blockquote className="border-l-4 border-border-strong pl-4 whitespace-pre-line text-fg-muted">
        {noAccess.reason}
      </blockquote>
    </Card>
  );
}

import { catalog, oneStop, theTimeEs } from "@empire-cleaning/models";
import { useState } from "react";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  Form,
  Notice,
  Section,
  TextField,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { useSaid } from "../words.ts";

const words = catalog({
  en: {
    notSent: "That didn't go through. Please try again.",
    sent: "Sent",
    first:
      "Check how we get in, and try calling the client first. The job won't be marked done, and the client and the office are told what happened.",
    whatHappened: "What happened?",
    example:
      "For example: nobody answered, and the key wasn't where the instructions say.",
    sentAt: (time: string, by: string) =>
      `Sent at ${time}${by}. The client and the office have been told.`,
  },
  es: {
    notSent: "No se envió. Vuelve a intentarlo.",
    sent: "Enviado",
    first:
      "Primero revisa cómo entramos y prueba a llamar al cliente. El trabajo no se marcará como terminado, y se les avisa al cliente y a la oficina lo que pasó.",
    whatHappened: "¿Qué pasó?",
    example:
      "Por ejemplo: nadie contestó, y la llave no estaba donde dicen las instrucciones.",
    sentAt: (time: string, by: string) =>
      oneStop(
        `Enviado a ${theTimeEs(time)}${by}. Ya se les avisó al cliente y a la oficina.`,
      ),
  },
});

// The Cleaner couldn't get into the home. Recording it ends the Job without
// it being Completed, and the Client and the Office are told; the Office
// sorts out what's next. One of the page's actions
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
    <Dialog title={c.couldntGetIn} role="alertdialog" {...state}>
      {({ close }) => (
        <Form
          validationErrors={action.fieldErrors}
          onSubmit={(e) => {
            e.preventDefault();
            void record(close);
          }}
        >
          <p>{w.first}</p>
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

// what was recorded, once it's No Access
export function NoAccessRecorded({ job }: { job: CleanerJob }) {
  const noAccess = job.noAccess!;
  const t = useSaid(words);
  return (
    <Section title={t.jobStatusLabel.no_access}>
      <Card>
        <p>
          {t.w.sentAt(
            t.formatTime(noAccess.recordedAt),
            t.c.by(noAccess.recordedBy),
          )}
        </p>
        <p>"{noAccess.reason}"</p>
      </Card>
    </Section>
  );
}

// PROTOTYPE: throwaway. Layouts for a Completed Job's Adjustments, picked by
// ?variant= (A is the current list). Each row has one action: pressing it
// opens the Adjustment, where it's reviewed, corrected or removed. What it
// is, what happened, and its price each have their own place.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { AdjustmentView, OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Card,
  Cell,
  Column,
  Dialog,
  Heading,
  List,
  ListItem,
  Row,
  Section,
  Table,
  TableBody,
  TableHeader,
} from "@empire-cleaning/ui";
import { formatDate, formatMoney } from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import {
  Adjustments,
  Correct,
  RemoveAdjustment,
  Review,
  statusBadge,
} from "./JobCompletion.tsx";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Table" },
  { key: "C", name: "Rows, price on the right" },
  { key: "D", name: "Grouped by what it does" },
];

export function AdjustmentsPrototype({ job }: { job: OfficeJob }) {
  const { variant } = useSearch({ from: "/office/jobs/$jobId" });
  const navigate = useNavigate();
  const [open, setOpen] = useState<AdjustmentView | null>(null);
  const pick = (key: string) =>
    void navigate({ to: ".", search: { variant: key }, replace: true });
  const adjustments = job.completion!.adjustments;
  const props = { adjustments, onOpen: setOpen };

  return (
    <>
      {(variant ?? "A") === "A" ? (
        <Adjustments job={job} />
      ) : (
        <Section
          title="Adjustments"
          description="What the Cleaner reported that differs from the Quote. Increases are only charged once the Client approves them."
        >
          {adjustments.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Nothing different from the Quote was reported.
            </p>
          ) : variant === "B" ? (
            <AsTable {...props} />
          ) : variant === "C" ? (
            <AsRows {...props} />
          ) : (
            <Grouped {...props} />
          )}
        </Section>
      )}
      {open && (
        <AdjustmentDialog
          job={job}
          // the latest, after an action reloads the Job
          adjustment={adjustments.find((a) => a.id === open.id) ?? open}
          onClose={() => setOpen(null)}
        />
      )}
      <PrototypeSwitcher
        variants={variants}
        current={variant ?? "A"}
        onChange={pick}
      />
    </>
  );
}

type Props = {
  adjustments: AdjustmentView[];
  onOpen: (a: AdjustmentView) => void;
};

// what it's about: the Add-on, or extra time
const whatOf = (a: AdjustmentView) =>
  a.kind === "extra_time" ? "Extra time" : a.addOnName!;

// what happened to it on the day
const changeOf = (a: AdjustmentView) =>
  a.kind === "extra_time"
    ? `${a.hours} more ${a.hours === 1 ? "hour" : "hours"}, all the crew together`
    : a.kind === "add_on_done"
      ? "Done on the day, not on the Quote"
      : "On the Quote, not done";

const shortChangeOf = (a: AdjustmentView) =>
  a.kind === "extra_time"
    ? `+${a.hours} h`
    : a.kind === "add_on_done"
      ? "Done on the day"
      : "Not done";

// signed, so a reduction reads as one
const signed = (cents: number) =>
  cents < 0 ? `−${formatMoney(-cents)}` : `+${formatMoney(cents)}`;

const Price = ({ a }: { a: AdjustmentView }) => (
  <span className="font-semibold whitespace-nowrap tabular-nums">
    {signed(a.totalCents)}
  </span>
);

// ---- B: a Table, a column each ----

function AsTable({ adjustments, onOpen }: Props) {
  return (
    <Table
      aria-label="Adjustments"
      onRowAction={(key) => onOpen(adjustments.find((a) => a.id === key)!)}
    >
      <TableHeader>
        <Column isRowHeader>What</Column>
        <Column>Change</Column>
        <Column>Price</Column>
        <Column>Status</Column>
      </TableHeader>
      <TableBody items={adjustments}>
        {(a) => (
          <Row id={a.id}>
            <Cell>{whatOf(a)}</Cell>
            <Cell>{shortChangeOf(a)}</Cell>
            <Cell>
              <Price a={a} />
            </Cell>
            <Cell>{statusBadge[a.status]}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

// ---- C: one row each, the price and status on the right ----

function AsRows({ adjustments, onOpen }: Props) {
  return (
    <List
      aria-label="Adjustments"
      onAction={(key) => onOpen(adjustments.find((a) => a.id === key)!)}
    >
      {adjustments.map((a) => (
        <ListItem
          key={a.id}
          id={a.id}
          title={whatOf(a)}
          description={changeOf(a)}
          end={
            <div className="flex flex-col items-end gap-1">
              <Price a={a} />
              {statusBadge[a.status]}
            </div>
          }
        />
      ))}
    </List>
  );
}

// ---- D: grouped by what it does to the price ----

const groups: {
  title: string;
  of: (a: AdjustmentView) => boolean;
}[] = [
  { title: "To review", of: (a) => a.status === "reported" },
  { title: "Waiting on the Client", of: (a) => a.status === "proposed" },
  {
    title: "Changed the price",
    of: (a) => a.status === "applied" || a.status === "approved",
  },
  {
    title: "Not charged",
    of: (a) => ["dismissed", "declined", "lapsed"].includes(a.status),
  },
];

function Grouped({ adjustments, onOpen }: Props) {
  const counted = adjustments
    .filter((a) => a.status === "applied" || a.status === "approved")
    .reduce((sum, a) => sum + a.totalCents, 0);
  return (
    <Card>
      {groups.map(({ title, of }) => {
        const these = adjustments.filter(of);
        if (these.length === 0) return null;
        return (
          <div key={title} className="flex flex-col gap-2">
            <Heading level={3}>{title}</Heading>
            <List
              aria-label={title}
              onAction={(key) => onOpen(these.find((a) => a.id === key)!)}
            >
              {these.map((a) => (
                <ListItem
                  key={a.id}
                  id={a.id}
                  title={whatOf(a)}
                  description={shortChangeOf(a)}
                  end={<Price a={a} />}
                />
              ))}
            </List>
          </div>
        );
      })}
      <p className="flex justify-between border-t border-border pt-3 font-semibold">
        <span>Changes the total by</span>
        <span className="tabular-nums">{signed(counted)}</span>
      </p>
    </Card>
  );
}

// ---- the Adjustment, opened: its story and what can be done to it ----

function AdjustmentDialog({
  job,
  adjustment: a,
  onClose,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={whatOf(a)}
      isOpen
      isDismissable
      onOpenChange={(open) => !open && onClose()}
    >
      <div className="flex items-center gap-2">{statusBadge[a.status]}</div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">What happened</dt>
        <dd>{changeOf(a)}</dd>
        <dt className="font-semibold">The Cleaner said</dt>
        <dd>"{a.reason}"</dd>
        {a.officeReason && (
          <>
            <dt className="font-semibold">The Office said</dt>
            <dd>{a.officeReason}</dd>
          </>
        )}
        <dt className="font-semibold">Price</dt>
        <dd>
          {signed(a.totalCents)} with tax
          {a.priceCents !== a.workedOutCents &&
            ` (worked out at ${formatMoney(Math.abs(a.workedOutCents))} before tax)`}
        </dd>
        {a.lapsesAt && (
          <>
            <dt className="font-semibold">Lapses</dt>
            <dd>{formatDate(a.lapsesAt)}, unless the Client answers</dd>
          </>
        )}
      </dl>
      <Actions>
        <RemoveAdjustment job={job} adjustment={a} />
        {(a.status === "applied" || a.status === "approved") && (
          <Correct job={job} adjustment={a} />
        )}
        {a.status === "reported" && <Review job={job} adjustment={a} />}
      </Actions>
    </Dialog>
  );
}

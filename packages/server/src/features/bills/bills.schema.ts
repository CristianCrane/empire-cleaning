import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { timestamps } from "../../db/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { billPayment, clients } from "../clients/clients.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";

// due until it's paid, or voided by Office Staff; processing while a bank
// debit paying it clears. Unpaid is separate (unpaid_since): a due Bill whose
// automatic Charge failed, or one paid on its page and not by its due date.
export const billStatus = pgEnum("bill_status", [
  "due",
  "processing",
  "paid",
  "void",
]);

// how a paid Bill was paid: its automatic Charge, by the Client on its page
// (card or bank debit), a payment Office Staff recorded (a cheque, a bank
// transfer), or nothing to pay, as when it was a credit
export const billPaidVia = pgEnum("bill_paid_via", [
  "charge",
  "page",
  "outside",
  "nothing_due",
]);

// Everything a Client billed weekly owes for one week, Monday to Sunday in
// New York, made the following Monday (ADR-0016). Like a Sent Quote it never
// changes once made: its lines and total are fixed, and only how it's paid
// moves on. One per Client per week, even once voided: the voided one's lines
// go on the next.
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // shown as EC-000123
    number: integer("number").generatedAlwaysAsIdentity().notNull().unique(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    // the Monday the week starts
    weekStart: date("week_start", { mode: "string" }).notNull(),
    madeAt: timestamp("made_at", { withTimezone: true }).notNull(),
    // how the Client paid Bills then, and the day it's due by
    payment: billPayment("payment").notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    // tax included; below 0 it's a credit on the next Bill
    totalCents: integer("total_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    // the earlier Bill whose credit this one carries, as a line; a voided
    // one gives it back, for the next to carry
    creditFromBillId: uuid("credit_from_bill_id").references(
      (): AnyPgColumn => bills.id,
      { onDelete: "restrict" },
    ),
    status: billStatus("status").notNull().default("due"),
    // when its automatic Charge was first tried, so making Bills again tries
    // one never tried, as after a crash, and nothing twice
    chargeAttemptedAt: timestamp("charge_attempted_at", { withTimezone: true }),
    // Unpaid: since its Charge first failed, and why the latest did; or
    // since the day after it was due, unpaid
    unpaidSince: timestamp("unpaid_since", { withTimezone: true }),
    unpaidReason: text("unpaid_reason"),
    // the payment the Client last started on its page, while a bank debit
    // clears
    paymentRef: text("payment_ref"),
    // when it went to the Client: once made, and charged if it's charged
    // automatically
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // a Bill paid on its page: the day its latest reminder was for, so each
    // goes once
    remindedOn: date("reminded_on", { mode: "string" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidVia: billPaidVia("paid_via"),
    // Office Staff recording a payment made another way
    paymentNote: text("payment_note"),
    recordedBy: uuid("recorded_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => accounts.id, {
      onDelete: "set null",
    }),
    voidReason: text("void_reason"),
    // a credit no Bill followed within 30 days is refunded: how much has
    // been, and when all of it was
    creditRefundedCents: integer("credit_refunded_cents").notNull().default(0),
    creditRefundedAt: timestamp("credit_refunded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("bills_client_week").on(t.clientId, t.weekStart),
    index("bills_credit_from_idx").on(t.creditFromBillId),
    index("bills_unpaid_idx").on(t.unpaidSince),
  ],
);

// One thing a Bill charges or credits, tax included: a Job's price, an
// Adjustment, a fee, a Deposit already paid coming off, or a correction to
// one billed before; or the credit from an earlier Bill. A Job's line has a
// key saying which of these it is (e.g. "price", "adjustment:<id>"), so each
// Bill bills only what changed since the last.
export const billLines = pgTable(
  "bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    ...timestamps,
  },
  (t) => [
    index("bill_lines_bill_id_idx").on(t.billId),
    index("bill_lines_job_id_idx").on(t.jobId),
  ],
);

export type Bill = typeof bills.$inferSelect;
export type BillLine = typeof billLines.$inferSelect;

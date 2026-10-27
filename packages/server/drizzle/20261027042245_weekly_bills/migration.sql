CREATE TYPE "bill_paid_via" AS ENUM('charge', 'page', 'outside', 'nothing_due');--> statement-breakpoint
CREATE TYPE "bill_status" AS ENUM('due', 'processing', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "bill_payment" AS ENUM('automatic', 'on_page');--> statement-breakpoint
ALTER TYPE "charge_kind" ADD VALUE 'bill';--> statement-breakpoint
CREATE TABLE "bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"bill_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"job_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" integer UNIQUE GENERATED ALWAYS AS IDENTITY (sequence name "bills_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"made_at" timestamp with time zone NOT NULL,
	"payment" "bill_payment" NOT NULL,
	"due_on" date NOT NULL,
	"total_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"credit_from_bill_id" uuid,
	"status" "bill_status" DEFAULT 'due'::"bill_status" NOT NULL,
	"charge_attempted_at" timestamp with time zone,
	"unpaid_since" timestamp with time zone,
	"unpaid_reason" text,
	"payment_ref" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_via" "bill_paid_via",
	"payment_note" text,
	"recorded_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"credit_refunded_cents" integer DEFAULT 0 NOT NULL,
	"credit_refunded_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bills_client_week" UNIQUE("client_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "charges" DROP CONSTRAINT "charges_job_or_service_plan";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billed_weekly_from" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "bill_payment" "bill_payment" DEFAULT 'automatic'::"bill_payment" NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "bill_terms_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "bill_id" uuid;--> statement-breakpoint
CREATE INDEX "bill_lines_bill_id_idx" ON "bill_lines" ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_lines_job_id_idx" ON "bill_lines" ("job_id");--> statement-breakpoint
CREATE INDEX "bills_credit_from_idx" ON "bills" ("credit_from_bill_id");--> statement-breakpoint
CREATE INDEX "bills_unpaid_idx" ON "bills" ("unpaid_since");--> statement-breakpoint
CREATE INDEX "charges_bill_id_idx" ON "charges" ("bill_id");--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_credit_from_bill_id_bills_id_fkey" FOREIGN KEY ("credit_from_bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_recorded_by_accounts_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_voided_by_accounts_id_fkey" FOREIGN KEY ("voided_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_bill_id_bills_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_job_or_service_plan_or_bill" CHECK (num_nonnulls("job_id", "service_plan_id", "bill_id") = 1);
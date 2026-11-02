ALTER TABLE "refunds" ADD COLUMN "at_provider" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_gateway_ref_idx" ON "refunds" ("gateway_ref");
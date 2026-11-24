-- When each Quote was asked and each Price List and Service version saved,
-- on the server's Clock, as the screens show it (#520). created_at stays the
-- database's record of the write. Each one so far was made when it was
-- written, as far as anything recorded says; created_at holds UTC
ALTER TABLE "price_lists" ADD COLUMN "made_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "made_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "made_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "price_lists" SET "made_at" = "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
UPDATE "quotes" SET "made_at" = "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
UPDATE "services" SET "made_at" = "created_at" AT TIME ZONE 'UTC';

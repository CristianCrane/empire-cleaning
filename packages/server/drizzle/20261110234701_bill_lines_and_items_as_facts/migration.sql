-- A Bill's lines and a Charge's item keep what happened, not English words,
-- so each is worded as it's read, in the reader's language (#395). The rows
-- already made are read back from their words: a line's "Corrected: "
-- prefixes, a fee's name, a price change from its Adjustment where it's
-- still there, and otherwise from the words' known endings, with no Add-on
-- key (its words then give the English name it was stored with)
ALTER TABLE "bill_lines" ADD COLUMN "corrected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD COLUMN "fee" text;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD COLUMN "change" jsonb;--> statement-breakpoint
UPDATE "bill_lines" SET "corrected" = "label" LIKE 'Corrected: %';--> statement-breakpoint
UPDATE "bill_lines" SET "fee" =
  CASE WHEN regexp_replace("label", '^(Corrected: )+', '') LIKE 'Late cancellation fee: %'
    THEN 'cancelled' ELSE 'no_access' END
WHERE "key" = 'fee';--> statement-breakpoint
UPDATE "bill_lines" SET "change" = jsonb_build_object(
  'kind', a."kind", 'addOnKey', a."add_on_key", 'addOnName', a."add_on_name", 'hours', a."hours")
FROM "adjustments" a
WHERE "bill_lines"."key" = 'adjustment:' || a."id"::text;--> statement-breakpoint
CREATE FUNCTION pg_temp.change_said(said text) RETURNS jsonb LANGUAGE sql STRICT AS $$
  SELECT CASE
    WHEN said ~ ', not done: ' THEN jsonb_build_object('kind', 'add_on_not_done',
      'addOnKey', null, 'addOnName', substring(said from '^(.*), not done: '), 'hours', null)
    WHEN said ~ ', done on the day: ' THEN jsonb_build_object('kind', 'add_on_done',
      'addOnKey', null, 'addOnName', substring(said from '^(.*), done on the day: '), 'hours', null)
    ELSE jsonb_build_object('kind', 'extra_time', 'addOnKey', null, 'addOnName', null,
      'hours', substring(said from '^([0-9.]+) more hour')::numeric)
  END
$$;--> statement-breakpoint
UPDATE "bill_lines"
SET "change" = pg_temp.change_said(regexp_replace("label", '^(Corrected: )+', ''))
WHERE "key" LIKE 'adjustment:%' AND "change" IS NULL;--> statement-breakpoint
ALTER TABLE "bill_lines" DROP COLUMN "label";--> statement-breakpoint
-- "Inside the fridge", "1 more hour", each maybe ", price corrected" or
-- ", taken off": what it was named, not whether it was done, is all its
-- words need
CREATE FUNCTION pg_temp.item_said(said text) RETURNS jsonb LANGUAGE sql STRICT AS $$
  SELECT CASE WHEN what ~ '^[0-9.]+ more hours?$'
    THEN jsonb_build_object('kind', 'extra_time', 'addOnKey', null, 'addOnName', null,
      'hours', substring(what from '^([0-9.]+)')::numeric, 'how', how)
    ELSE jsonb_build_object('kind', 'add_on_done', 'addOnKey', null, 'addOnName', what,
      'hours', null, 'how', how)
  END
  FROM (SELECT regexp_replace(said, ', (price corrected|taken off)$', '') AS what,
    CASE WHEN said LIKE '%, price corrected' THEN 'corrected'
      WHEN said LIKE '%, taken off' THEN 'taken_off' ELSE 'approved' END AS how) s
$$;--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "item" SET DATA TYPE jsonb USING pg_temp.item_said("item");--> statement-breakpoint
ALTER TABLE "refund_attempts" ALTER COLUMN "item" SET DATA TYPE jsonb USING pg_temp.item_said("item");--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "item" SET DATA TYPE jsonb USING pg_temp.item_said("item");

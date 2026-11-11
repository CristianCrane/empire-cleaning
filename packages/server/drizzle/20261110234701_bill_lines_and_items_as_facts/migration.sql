-- A Bill's lines and a Charge's item keep what happened, not English words,
-- so each is worded as it's read, in the reader's language (#395). The rows
-- already made are read back from their words, in every wording they've had
-- ("Corrected: " or "Correction, ", "1 more hour" or "1 extra hour"): a
-- fee's kind from its Job, a price change from its Adjustment where it's
-- still there, and otherwise from the words' known endings, with no Add-on
-- key (its words then give the English name it was stored with). Words it
-- can't read stop the migration rather than turn into a wrong fact
ALTER TABLE "bill_lines" ADD COLUMN "corrected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD COLUMN "fee" text;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD COLUMN "change" jsonb;--> statement-breakpoint
UPDATE "bill_lines" SET "corrected" = "label" ~ '^(Corrected: |Correction, )';--> statement-breakpoint
CREATE FUNCTION pg_temp.unprefixed(said text) RETURNS text LANGUAGE sql STRICT AS $$
  SELECT regexp_replace(said, '^(Corrected: |Correction, )+', '')
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.fee_said(status text, said text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF status IN ('cancelled', 'no_access') THEN RETURN status; END IF;
  IF pg_temp.unprefixed(said) ~* '^late cancellation fee' THEN RETURN 'cancelled'; END IF;
  IF pg_temp.unprefixed(said) ~* '^(no access|couldn''t-get-in) fee' THEN RETURN 'no_access'; END IF;
  RAISE EXCEPTION 'a fee line this migration can''t read: %', said;
END
$$;--> statement-breakpoint
UPDATE "bill_lines" SET "fee" = pg_temp.fee_said(j."status"::text, "bill_lines"."label")
FROM "jobs" j
WHERE "bill_lines"."key" = 'fee' AND j."id" = "bill_lines"."job_id";--> statement-breakpoint
UPDATE "bill_lines" SET "change" = jsonb_build_object(
  'kind', a."kind", 'addOnKey', a."add_on_key", 'addOnName', a."add_on_name", 'hours', a."hours")
FROM "adjustments" a
WHERE "bill_lines"."key" = 'adjustment:' || a."id"::text;--> statement-breakpoint
CREATE FUNCTION pg_temp.change_said(label text) RETURNS jsonb LANGUAGE plpgsql STRICT AS $$
DECLARE said text := pg_temp.unprefixed(label);
BEGIN
  IF said ~ ', not done: ' THEN
    RETURN jsonb_build_object('kind', 'add_on_not_done', 'addOnKey', null,
      'addOnName', substring(said from '^(.*), not done: '), 'hours', null);
  END IF;
  IF said ~ ', done on the day: ' THEN
    RETURN jsonb_build_object('kind', 'add_on_done', 'addOnKey', null,
      'addOnName', substring(said from '^(.*), done on the day: '), 'hours', null);
  END IF;
  IF said ~ '^[0-9.]+ (more|extra) hours?: ' THEN
    RETURN jsonb_build_object('kind', 'extra_time', 'addOnKey', null, 'addOnName', null,
      'hours', substring(said from '^([0-9.]+) ')::numeric);
  END IF;
  RAISE EXCEPTION 'a price change line this migration can''t read: %', label;
END
$$;--> statement-breakpoint
UPDATE "bill_lines" SET "change" = pg_temp.change_said("label")
WHERE "key" LIKE 'adjustment:%' AND "change" IS NULL;--> statement-breakpoint
ALTER TABLE "bill_lines" DROP COLUMN "label";--> statement-breakpoint
-- "Inside the fridge", "1 more hour" (or "1 extra hour"), each maybe ",
-- price corrected" or ", taken off": what it was named, not whether it was
-- done, is all its words need
CREATE FUNCTION pg_temp.item_said(said text) RETURNS jsonb LANGUAGE sql STRICT AS $$
  SELECT CASE WHEN what ~ '^[0-9.]+ (more|extra) hours?$'
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

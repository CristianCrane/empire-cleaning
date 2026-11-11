-- A plan clean cancelled with its plan keeps whether the plan changed or
-- ended, not English words, so each reader's screen says it in their
-- language (#395). The rows already cancelled so are read back from the
-- words they were given, which then go: only Empire Cleaning's own typed
-- reason stays a reason. A Client's cancellation with words it can't read
-- stops the migration rather than turn into a wrong fact
ALTER TABLE "jobs" ADD COLUMN "cancelled_with_plan" text;--> statement-breakpoint
DO $$
DECLARE unread text;
BEGIN
  SELECT "cancellation_reason" INTO unread FROM "jobs"
  WHERE "cancelled_by" = 'client' AND "cancellation_reason" IS NOT NULL
    AND "cancellation_reason" NOT IN ('The cleaning plan changed', 'The cleaning plan ended')
  LIMIT 1;
  IF unread IS NOT NULL THEN
    RAISE EXCEPTION 'a Client''s cancellation this migration can''t read: %', unread;
  END IF;
END
$$;--> statement-breakpoint
UPDATE "jobs" SET
  "cancelled_with_plan" = CASE "cancellation_reason"
    WHEN 'The cleaning plan changed' THEN 'changed' ELSE 'ended' END,
  "cancellation_reason" = NULL
WHERE "cancelled_by" = 'client' AND "cancellation_reason" IS NOT NULL;

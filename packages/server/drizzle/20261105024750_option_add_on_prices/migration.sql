ALTER TABLE "revision_options" ADD COLUMN "add_ons" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- Options priced before this keep the Add-on prices they showed: each
-- Add-on's hours at the option's hourly rate, with its one-off tax.
UPDATE "revision_options" o SET "add_ons" = (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', e.a->>'key',
        'name', e.a->>'name',
        'priceCents', c.cents,
        'taxCents', t.tax,
        'totalCents', c.cents + t.tax
      ) ORDER BY e.ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(o."suggested"->'addOns') WITH ORDINALITY AS e(a, ord)
  CROSS JOIN LATERAL (
    SELECT floor(
      (round((e.a->>'hours')::numeric * 10000) * (o."suggested"->>'hourlyRateCents')::numeric + 5000) / 10000
    )::int AS cents
  ) c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN (e.a->>'taxExempt')::boolean THEN 0
      ELSE floor((c.cents * round((o."suggested"->>'taxPercent')::numeric * 1000) + 50000) / 100000)::int
    END AS tax
  ) t
);

CREATE TYPE "language" AS ENUM('en', 'es');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "preferred_language" "language" DEFAULT 'en'::"language" NOT NULL;--> statement-breakpoint
ALTER TABLE "price_list_add_ons" ADD COLUMN "name_es" text;--> statement-breakpoint
ALTER TABLE "price_list_premises_types" ADD COLUMN "name_es" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "name_es" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "description_es" text;--> statement-breakpoint
-- the Spanish for the starting Services, Add-ons and Premises Types, on
-- every version still named as they started (ADR-0025): a draft the owner
-- checks (#206)
UPDATE "services" SET "name_es" = v.name_es
FROM (VALUES
  ('Standard Clean', 'Limpieza estándar'),
  ('Deep Clean', 'Limpieza profunda'),
  ('Move-in/out Clean', 'Limpieza de mudanza'),
  ('Commercial cleaning', 'Limpieza comercial'),
  ('Painting', 'Pintura')
) AS v(name, name_es)
WHERE "services"."name" = v.name;--> statement-breakpoint
UPDATE "services" SET "description_es" = v.description_es
FROM (VALUES
  ('The regular upkeep that keeps a clean home feeling that way.', 'El mantenimiento regular que hace que una casa limpia se siga sintiendo así.'),
  ('A top-to-bottom clean, inside cabinets, behind appliances and everywhere in between.', 'Una limpieza de arriba abajo, dentro de los gabinetes, detrás de los electrodomésticos y en todo lo demás.'),
  ('An empty home made spotless, ready for keys to change hands.', 'Una casa vacía impecable, lista para entregar las llaves.'),
  ('Workspaces, kitchens and restrooms kept clean for your team and visitors.', 'Espacios de trabajo, cocinas y baños limpios para su equipo y sus visitas.'),
  ('Walls, ceilings and trim painted cleanly, with the room left as we found it.', 'Paredes, techos y molduras pintados con cuidado, y el cuarto queda como lo encontramos.')
) AS v(description, description_es)
WHERE "services"."description" = v.description;--> statement-breakpoint
UPDATE "price_list_add_ons" SET "name_es" = v.name_es
FROM (VALUES
  ('Inside the oven', 'Dentro del horno'),
  ('Inside the fridge', 'Dentro del refrigerador'),
  ('Inside the cabinets', 'Dentro de los gabinetes'),
  ('Interior windows', 'Ventanas por dentro')
) AS v(name, name_es)
WHERE "price_list_add_ons"."name" = v.name;--> statement-breakpoint
UPDATE "price_list_premises_types" SET "name_es" = v.name_es
FROM (VALUES
  ('Office', 'Oficina'),
  ('Retail', 'Tienda'),
  ('Medical', 'Consultorio médico'),
  ('Other', 'Otro')
) AS v(name, name_es)
WHERE "price_list_premises_types"."name" = v.name;

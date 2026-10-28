ALTER TABLE "properties" DROP CONSTRAINT "properties_kind_details", ADD CONSTRAINT "properties_kind_details" CHECK (("kind" = 'residential' and "type" is not null and "premises_type_key" is null
          and (("bedrooms" is not null and "bathrooms" is not null and "storeys" is not null and "pets" is not null)
            or ("bedrooms" is null and "bathrooms" is null and "storeys" is null and "pets" is null)))
        or ("kind" = 'commercial' and "premises_type_key" is not null and "type" is null and "bedrooms" is null and "bathrooms" is null and "storeys" is null and "pets" is null));
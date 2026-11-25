import { prototype } from "../prototype.ts";

// the Quote form a stranger fills on the public site (#505): what each
// service is, shown at its choice, as tiles or as rows
export default prototype({
  layouts: [
    { key: "tiles", name: "Tiles" },
    { key: "rows", name: "Rows" },
  ],
  cases: {
    pick: { name: "Step 1, nothing picked" },
    picked: { name: "Step 1, Deep Clean picked" },
    where: { name: "Step 2, where" },
    zip: { name: "Step 2, ZIP not found" },
    home: { name: "Step 3, an apartment" },
    details: { name: "Step 4, your details" },
    failed: { name: "Send failed" },
    nolist: { name: "Services didn't load" },
    sent: { name: "Sent" },
    spanish: { name: "Spanish, step 1", lang: "es" },
  },
});
